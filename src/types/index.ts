export type Priority = "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";
export type Status = "OPEN" | "DONE" | "DELAYED" | "OVERDUE";
export type EscalationLevel = 0 | 1 | 2;

export interface Task {
  id: string;
  title: string;
  description?: string | null;
  owner: string;
  ownerPhone: string;
  ownerEmail?: string | null;
  function: string;
  priority: Priority;
  dueDate: string | null;
  source?: string | null;
  status: Status;
  initiative?: string;
  escalationLevel: number;
  escalationStatus: string;
  lastEscalatedAt?: string | null;
  closedAt?: string | null;
  createdAt: string;
  updatedAt: string;
  activities?: Activity[];
  comments?: Comment[];
  reminders?: Reminder[];
}

export interface Activity {
  id: string;
  taskId: string;
  type: string;
  action?: string | null;
  actor?: string | null;
  message: string;
  notes?: string | null;
  metadata?: string | null;
  createdAt: string;
}

export interface Comment {
  id: string;
  taskId: string;
  author: string;
  content: string;
  createdAt: string;
}

export interface Reminder {
  id: string;
  taskId: string;
  type: string;
  channel: string;
  recipientName: string;
  recipientPhone: string;
  recipientEmail?: string;
  provider: string;
  status: string;
  message: string;
  metadata?: string | null;
  sentAt: string;
}

export interface PulseTask {
  id: string;
  title: string;
  owner: string;
  dueDate: string | null;
  reason: string;
  urgency: "critical" | "high" | "medium";
  severityTag: "CRITICAL" | "ESCALATED" | "REPEATED_DELAY" | "BLOCKED";
  situation: string;
  whyItMatters?: string;
}

export interface ZombieTask {
  id: string;
  title: string;
  owner: string;
  dueDate: string | null;
  daysSinceActivity: number;
}

export interface PersonReliability {
  owner: string;
  function: string;
  reliabilityLabel: "AT_RISK" | "WATCH" | "STRONG";
  activeTasks: number;
  onTimeRate: number;
  delayed: number;
  silent: number;
  patternInsight: string;
  suggestedAction?: string;
}

export interface DashboardStats {
  totalOpenTasks: number;
  overdueTasks: number;
  dueTodayTasks: number;
  onTimeClosureRate: number;
  ownerStats: OwnerStat[];
  recentTasks: Task[];
  overdueTasksSummary: Task[];
  dueSoonSummary: Task[];
  needsEscalation: Task[];
  silentOverdue: Task[];
  recentReminders: (Reminder & { task: { title: string; owner: string } })[];
  // Pulse View
  needsYouNow: PulseTask[];
  watchList: PulseTask[];
  zombieTasks: ZombieTask[];
  runningFineCount: number;
  topLine: string;
  headlineState: "calm" | "watchful" | "bad" | "critical";
  peopleReliability: PersonReliability[];
}

export interface OwnerStat {
  owner: string;
  function: string;
  total: number;
  open: number;
  done: number;
  overdue: number;
  delayed: number;
  closureRate: number;
  executionScore: number;
}

export interface WeeklyReview {
  periodStart: string;
  periodEnd: string;
  tasksCreated: number;
  tasksClosed: number;
  overdueCount: number;
  ownerStats: OwnerStat[];
  topPerformers: OwnerStat[];
  attentionNeeded: OwnerStat[];
  createdTasks: Task[];
  closedTasks: Task[];
  overdueTasks: Task[];
  whatsappSummaryText?: string;
}

export interface TaskFilters {
  status?: string;
  priority?: string;
  function?: string;
  owner?: string;
  overdueMin?: number;
  search?: string;
}

export interface ExtractedTask {
  title: string;
  description: string;
  ownerName: string;
  ownerPhone: string;
  ownerEmail: string;
  dueDate: string;
  priority: string;
  function: string;
  source: string;
  sourceText?: string;
  confidenceScore: number;
  needsReview: boolean;
  selected?: boolean;
}
