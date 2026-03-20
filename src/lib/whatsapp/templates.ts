import { formatDate } from "@/lib/utils";

export type ReminderType =
  | "task_assigned"
  | "due_in_2_days"
  | "due_today"
  | "overdue_1_day"
  | "escalated_to_manager"
  | "escalated_to_admin"
  | "weekly_summary"
  | "delayed_followup"
  | "midpoint_check"
  | "silence_check"
  | "MANUAL";

interface TaskData {
  title: string;
  owner: string;
  dueDate: string | Date;
  id: string;
  function?: string;
}

export const templates: Record<
  Exclude<ReminderType, "weekly_summary" | "MANUAL">,
  (data: TaskData, extra?: Record<string, string>) => string
> = {
  task_assigned: ({ title, owner, dueDate }) =>
    `Hi ${owner} 👋\n\nYou have been assigned a new task:\n*${title}*\n\nDue: ${formatDate(dueDate)}\n\nReply with:\n• *DONE* — when complete\n• *DELAYED* — if you need more time\n• *NEED HELP* — if you need support`,

  due_in_2_days: ({ title, owner, dueDate }) =>
    `Hi ${owner},\n\n⏰ Reminder: Your task is due in 2 days.\n\n*${title}*\nDue: ${formatDate(dueDate)}\n\nReply *DONE*, *DELAYED*, or *NEED HELP*.`,

  due_today: ({ title, owner, dueDate }) =>
    `Hi ${owner},\n\n🔔 *Due Today:* ${formatDate(dueDate)}\n\n*${title}*\n\nPlease complete and reply *DONE* or *DELAYED* with a revised date.`,

  overdue_1_day: ({ title, owner, dueDate }) =>
    `Hi ${owner},\n\n⚠️ Your task is now *overdue*:\n\n*${title}*\nWas due: ${formatDate(dueDate)}\n\nPlease reply *DONE* to close, *DELAYED* to reschedule, or *NEED HELP* if stuck.`,

  escalated_to_manager: ({ title, owner, dueDate }, extra) =>
    `Hi ${extra?.managerName || "Manager"},\n\n🚨 *Escalation Notice — Level 1*\n\nThe following task assigned to *${owner}* is overdue by 3+ days:\n\n*${title}*\nDue: ${formatDate(dueDate)}\n\nPlease follow up with ${owner} to unblock this.`,

  escalated_to_admin: ({ title, owner, dueDate }) =>
    `🚨 *Escalation — Level 2 (Admin)*\n\nTask overdue by 7+ days:\n\n*${title}*\nOwner: ${owner}\nDue: ${formatDate(dueDate)}\n\nImmediate attention required.`,

  delayed_followup: ({ title, owner }) =>
    `Hi ${owner}, you marked *${title}* as DELAYED.\n\nPlease reply with a revised due date (e.g. "22 Mar") so we can update the record.`,

  midpoint_check: ({ title, owner, dueDate }) =>
    `Hi ${owner},\n\n📍 *Midpoint Check-in*\n\nYou're halfway to the deadline on:\n\n*${title}*\nDue: ${formatDate(dueDate)}\n\nHow is it going?\n• *ON TRACK* — progressing well _(add your next step after a dash)_\n• *BLOCKED* — need help unblocking\n• *DELAYED* — need more time`,

  silence_check: ({ title, owner, dueDate }) =>
    `Hi ${owner},\n\n🔕 *No update received* on this task for a while:\n\n*${title}*\nDue soon: ${formatDate(dueDate)}\n\nPlease reply:\n• *ON TRACK* — progressing\n• *BLOCKED* — stuck, need help\n• *DELAYED* — need more time`,
};

export function buildWeeklySummaryMessage(data: {
  periodStart: string;
  periodEnd: string;
  tasksCreated: number;
  tasksClosed: number;
  overdueCount: number;
  onTimeClosureRate: number;
  topPerformers: Array<{ owner: string; closureRate: number; done: number; total: number }>;
  attentionNeeded: Array<{ owner: string; overdue: number; closureRate: number }>;
  pendingDecisions: Array<{ title: string; owner: string; daysOverdue: number }>;
}): string {
  const lines: string[] = [
    `*Partnr Execution OS — Weekly Summary*`,
    `_${formatDate(data.periodStart)} – ${formatDate(data.periodEnd)}_`,
    ``,
    `📊 *Overview*`,
    `• Created: ${data.tasksCreated} tasks`,
    `• Closed: ${data.tasksClosed} tasks`,
    `• Still Overdue: ${data.overdueCount} tasks`,
    `• On-Time Rate: ${data.onTimeClosureRate}%`,
    ``,
  ];

  if (data.topPerformers.length > 0) {
    lines.push(`🏆 *Top Performers*`);
    data.topPerformers.forEach((p, i) => {
      lines.push(`${i + 1}. ${p.owner} — ${p.closureRate}% (${p.done}/${p.total})`);
    });
    lines.push(``);
  }

  if (data.attentionNeeded.length > 0) {
    lines.push(`⚠️ *Needs Attention*`);
    data.attentionNeeded.forEach((p) => {
      lines.push(`• ${p.owner} — ${p.overdue} overdue, ${p.closureRate}% closed`);
    });
    lines.push(``);
  }

  if (data.pendingDecisions.length > 0) {
    lines.push(`📋 *Pending Decisions*`);
    data.pendingDecisions.slice(0, 5).forEach((t) => {
      const tag = t.daysOverdue > 0 ? ` _(${t.daysOverdue}d overdue)_` : ``;
      lines.push(`• ${t.title} → ${t.owner}${tag}`);
    });
    lines.push(``);
  }

  lines.push(`_Reply or log into Partnr OS for details._`);
  return lines.join("\n");
}
