import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const owners = [
  { name: "Rohan Mehta", phone: "+919876543210", function: "Strategy" },
  { name: "Priya Sharma", phone: "+919876543211", function: "HR" },
  { name: "Arjun Patel", phone: "+919876543212", function: "Sales" },
  { name: "Deepa Nair", phone: "+919876543213", function: "Operations" },
  { name: "Kabir Singh", phone: "+919876543214", function: "Finance" },
  { name: "Ananya Gupta", phone: "+919876543215", function: "Operations" },
  { name: "Vikram Joshi", phone: "+919876543216", function: "Technology" },
];

// User hierarchy with manager relationships
const userRecords = [
  { name: "Rohan Mehta", phone: "+919876543210", role: "CEO", function: "Strategy", managerName: null, managerPhone: null },
  { name: "Priya Sharma", phone: "+919876543211", role: "HEAD", function: "HR", managerName: "Rohan Mehta", managerPhone: "+919876543210" },
  { name: "Arjun Patel", phone: "+919876543212", role: "MANAGER", function: "Sales", managerName: "Rohan Mehta", managerPhone: "+919876543210" },
  { name: "Deepa Nair", phone: "+919876543213", role: "HEAD", function: "Operations", managerName: "Rohan Mehta", managerPhone: "+919876543210" },
  { name: "Kabir Singh", phone: "+919876543214", role: "HEAD", function: "Finance", managerName: "Rohan Mehta", managerPhone: "+919876543210" },
  { name: "Ananya Gupta", phone: "+919876543215", role: "CLUSTER_MANAGER", function: "Operations", managerName: "Deepa Nair", managerPhone: "+919876543213" },
  { name: "Vikram Joshi", phone: "+919876543216", role: "MANAGER", function: "Technology", managerName: "Rohan Mehta", managerPhone: "+919876543210" },
];

const sources = ["Leadership Meeting", "Board Review", "Weekly Sync", "Decision Log", "Client Review", "Quarterly Planning"];

function daysAgo(n: number) {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d;
}

function daysFromNow(n: number) {
  const d = new Date();
  d.setDate(d.getDate() + n);
  return d;
}

async function main() {
  console.log("Seeding database...");

  await prisma.activity.deleteMany();
  await prisma.comment.deleteMany();
  await prisma.reminder.deleteMany();
  await prisma.task.deleteMany();
  await prisma.user.deleteMany();
  await prisma.meetingNote.deleteMany();

  // Seed users
  for (const u of userRecords) {
    await prisma.user.upsert({
      where: { phone: u.phone },
      update: {},
      create: {
        name: u.name,
        phone: u.phone,
        role: u.role,
        function: u.function,
        managerName: u.managerName ?? null,
        managerPhone: u.managerPhone ?? null,
      },
    });
  }
  console.log(`Seeded ${userRecords.length} users.`);

  const tasks = [
    {
      title: "Finalize Q2 hiring plan for Sales team",
      description: "Define headcount, roles, and timelines for Q2 sales expansion. Coordinate with HR for JD approvals.",
      owner: owners[1].name,
      ownerPhone: owners[1].phone,
      function: "HR",
      priority: "HIGH",
      dueDate: daysAgo(5),
      source: sources[0],
      status: "OVERDUE",
      escalationLevel: 2,
      createdAt: daysAgo(14),
    },
    {
      title: "Submit updated pricing deck to CEO",
      description: "Revised pricing model for enterprise segment. Include competitive benchmarks.",
      owner: owners[2].name,
      ownerPhone: owners[2].phone,
      function: "Sales",
      priority: "CRITICAL",
      dueDate: daysAgo(2),
      source: sources[4],
      status: "OVERDUE",
      escalationLevel: 1,
      createdAt: daysAgo(8),
    },
    {
      title: "Complete SOP documentation for onboarding",
      description: "Document step-by-step onboarding SOP for cluster managers. Include checklist and timelines.",
      owner: owners[1].name,
      ownerPhone: owners[1].phone,
      function: "HR",
      priority: "MEDIUM",
      dueDate: daysFromNow(3),
      source: sources[0],
      status: "OPEN",
      escalationLevel: 0,
      createdAt: daysAgo(7),
    },
    {
      title: "Set up weekly ops review cadence",
      description: "Define agenda, attendees, and review template for weekly ops review meetings.",
      owner: owners[3].name,
      ownerPhone: owners[3].phone,
      function: "Operations",
      priority: "MEDIUM",
      dueDate: daysAgo(1),
      source: sources[2],
      status: "OVERDUE",
      escalationLevel: 1,
      createdAt: daysAgo(10),
    },
    {
      title: "Audit vendor contracts due for renewal",
      description: "Review all vendor contracts expiring in next 90 days. Shortlist for renegotiation.",
      owner: owners[4].name,
      ownerPhone: owners[4].phone,
      function: "Finance",
      priority: "HIGH",
      dueDate: daysFromNow(5),
      source: sources[5],
      status: "OPEN",
      escalationLevel: 0,
      createdAt: daysAgo(3),
    },
    {
      title: "Roll out performance review framework",
      description: "Share revised performance review template with all functional heads. Collect feedback.",
      owner: owners[1].name,
      ownerPhone: owners[1].phone,
      function: "HR",
      priority: "HIGH",
      dueDate: daysFromNow(0),
      source: sources[1],
      status: "OPEN",
      escalationLevel: 0,
      createdAt: daysAgo(5),
    },
    {
      title: "Close Q1 revenue reconciliation",
      description: "Reconcile Q1 revenue across all clusters and submit final report to CEO.",
      owner: owners[4].name,
      ownerPhone: owners[4].phone,
      function: "Finance",
      priority: "CRITICAL",
      dueDate: daysAgo(7),
      source: sources[1],
      status: "DONE",
      escalationLevel: 0,
      closedAt: daysAgo(6),
      createdAt: daysAgo(21),
    },
    {
      title: "Launch referral program for cluster managers",
      description: "Define incentive structure and launch internal referral campaign for cluster manager recruitment.",
      owner: owners[5].name,
      ownerPhone: owners[5].phone,
      function: "Operations",
      priority: "MEDIUM",
      dueDate: daysFromNow(7),
      source: sources[0],
      status: "OPEN",
      escalationLevel: 0,
      createdAt: daysAgo(2),
    },
    {
      title: "Build internal task tracking dashboard",
      description: "Create a web-based dashboard for tracking leadership decisions and follow-throughs.",
      owner: owners[6].name,
      ownerPhone: owners[6].phone,
      function: "Technology",
      priority: "HIGH",
      dueDate: daysAgo(3),
      source: sources[3],
      status: "DONE",
      escalationLevel: 0,
      closedAt: daysAgo(3),
      createdAt: daysAgo(14),
    },
    {
      title: "Prepare board deck for April meeting",
      description: "Compile key metrics, highlights, and strategic updates for the April board meeting.",
      owner: owners[0].name,
      ownerPhone: owners[0].phone,
      function: "Strategy",
      priority: "CRITICAL",
      dueDate: daysFromNow(10),
      source: sources[1],
      status: "OPEN",
      escalationLevel: 0,
      createdAt: daysAgo(1),
    },
    {
      title: "Finalize sales target setting for H1",
      description: "Lock H1 sales targets by cluster and individual. Align with Finance on budget.",
      owner: owners[2].name,
      ownerPhone: owners[2].phone,
      function: "Sales",
      priority: "HIGH",
      dueDate: daysAgo(10),
      source: sources[5],
      status: "DONE",
      escalationLevel: 0,
      closedAt: daysAgo(9),
      createdAt: daysAgo(18),
    },
    {
      title: "Deploy CRM update to production",
      description: "Push the latest CRM update including lead scoring module to production environment.",
      owner: owners[6].name,
      ownerPhone: owners[6].phone,
      function: "Technology",
      priority: "HIGH",
      dueDate: daysFromNow(2),
      source: sources[2],
      status: "OPEN",
      escalationLevel: 0,
      createdAt: daysAgo(4),
    },
    {
      title: "Conduct cluster-wise P&L review",
      description: "Review P&L for each cluster with respective cluster managers. Flag underperformers.",
      owner: owners[4].name,
      ownerPhone: owners[4].phone,
      function: "Finance",
      priority: "HIGH",
      dueDate: daysAgo(4),
      source: sources[5],
      status: "OVERDUE",
      escalationLevel: 1,
      createdAt: daysAgo(12),
    },
    {
      title: "Update leave policy documentation",
      description: "Revise leave policy to include new maternity/paternity provisions as per revised law.",
      owner: owners[1].name,
      ownerPhone: owners[1].phone,
      function: "HR",
      priority: "LOW",
      dueDate: daysFromNow(14),
      source: sources[3],
      status: "OPEN",
      escalationLevel: 0,
      createdAt: daysAgo(1),
    },
    {
      title: "Resolve Bangalore cluster ops issues",
      description: "Identify root cause of operational delays in Bangalore cluster and implement fix.",
      owner: owners[5].name,
      ownerPhone: owners[5].phone,
      function: "Operations",
      priority: "CRITICAL",
      dueDate: daysAgo(2),
      source: sources[2],
      status: "DELAYED",
      escalationLevel: 2,
      createdAt: daysAgo(9),
    },
    {
      title: "Set up WhatsApp reminder integration",
      description: "Integrate n8n workflow to send WhatsApp reminders for overdue tasks.",
      owner: owners[6].name,
      ownerPhone: owners[6].phone,
      function: "Technology",
      priority: "MEDIUM",
      dueDate: daysFromNow(6),
      source: sources[3],
      status: "OPEN",
      escalationLevel: 0,
      createdAt: daysAgo(2),
    },
    {
      title: "Conduct exit interviews for Q1 attrition",
      description: "Complete exit interviews for all employees who left in Q1. Summarize findings.",
      owner: owners[1].name,
      ownerPhone: owners[1].phone,
      function: "HR",
      priority: "MEDIUM",
      dueDate: daysAgo(8),
      source: sources[0],
      status: "DONE",
      escalationLevel: 0,
      closedAt: daysAgo(7),
      createdAt: daysAgo(15),
    },
    {
      title: "Negotiate new office lease renewal",
      description: "Engage landlord for Delhi HQ lease renewal. Target 15% cost reduction.",
      owner: owners[3].name,
      ownerPhone: owners[3].phone,
      function: "Operations",
      priority: "HIGH",
      dueDate: daysFromNow(20),
      source: sources[5],
      status: "OPEN",
      escalationLevel: 0,
      createdAt: daysAgo(3),
    },
    {
      title: "Complete competitor analysis for pricing",
      description: "Research top 5 competitors' pricing models and present findings to leadership.",
      owner: owners[2].name,
      ownerPhone: owners[2].phone,
      function: "Sales",
      priority: "MEDIUM",
      dueDate: daysFromNow(4),
      source: sources[4],
      status: "OPEN",
      escalationLevel: 0,
      createdAt: daysAgo(2),
    },
    {
      title: "Define OKRs for Q2 for all functions",
      description: "Facilitate OKR setting workshops with all functional heads for Q2.",
      owner: owners[0].name,
      ownerPhone: owners[0].phone,
      function: "Strategy",
      priority: "CRITICAL",
      dueDate: daysFromNow(0),
      source: sources[5],
      status: "OPEN",
      escalationLevel: 0,
      createdAt: daysAgo(6),
    },
  ];

  for (const taskData of tasks) {
    const { closedAt, ...rest } = taskData as any;
    const task = await prisma.task.create({
      data: {
        ...rest,
        closedAt: closedAt ?? null,
        activities: {
          create: [
            {
              type: "CREATED",
              message: `Task created and assigned to ${taskData.owner}`,
            },
          ],
        },
      },
    });

    if (taskData.status === "OVERDUE" || taskData.status === "DELAYED") {
      await prisma.activity.create({
        data: {
          taskId: task.id,
          type: "STATUS_CHANGE",
          message: `Status changed to ${taskData.status}`,
        },
      });

      if (taskData.escalationLevel >= 1) {
        await prisma.activity.create({
          data: {
            taskId: task.id,
            type: "ESCALATION",
            message: `Escalated to Level ${taskData.escalationLevel} — notified reporting manager`,
          },
        });
        await prisma.reminder.create({
          data: {
            taskId: task.id,
            channel: "WHATSAPP",
            status: "SENT",
            message: `Reminder: "${task.title}" is overdue. Please update status immediately.`,
          },
        });
      }
    }

    if (taskData.status === "DONE") {
      await prisma.activity.create({
        data: {
          taskId: task.id,
          type: "STATUS_CHANGE",
          message: `Task marked as DONE by ${taskData.owner}`,
        },
      });
    }
  }

  console.log(`Seeded ${tasks.length} tasks successfully.`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
