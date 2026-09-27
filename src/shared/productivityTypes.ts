export const taskStatusEnum = ['todo', 'in_progress', 'blocked', 'done', 'archived'] as const;
export type TaskStatus = (typeof taskStatusEnum)[number];

export const taskPriorityEnum = ['low', 'medium', 'high', 'urgent'] as const;
export type TaskPriority = (typeof taskPriorityEnum)[number];

export const projectStatusEnum = ['active', 'paused', 'completed', 'archived'] as const;
export type ProjectStatus = (typeof projectStatusEnum)[number];

export const recurrenceFrequencyEnum = ['daily', 'weekly', 'monthly', 'yearly'] as const;
export type RecurrenceFrequency = (typeof recurrenceFrequencyEnum)[number];

export const recurrenceEndTypeEnum = ['never', 'after_count', 'until_date'] as const;
export type RecurrenceEndType = (typeof recurrenceEndTypeEnum)[number];

export const recurrenceExceptionActionEnum = ['skip', 'reschedule', 'cancel', 'override'] as const;
export type RecurrenceExceptionAction = (typeof recurrenceExceptionActionEnum)[number];

export interface ProjectData {
  id: string;
  userId: string;
  categoryId?: string | null;
  name: string;
  slug: string;
  description?: string | null;
  color?: string | null;
  icon?: string | null;
  status: ProjectStatus;
  targetDate?: string | null;
  sortOrder: number;
  openTaskCount?: number;
  completedTaskCount?: number;
  boardId?: string | null;
  createdAt: number;
  updatedAt: number;
}

export interface BoardColumnData {
  id: string;
  userId: string;
  boardId: string;
  name: string;
  statusMapping: TaskStatus;
  color?: string | null;
  wipLimit?: number | null;
  sortOrder: number;
  createdAt: number;
  updatedAt: number;
  taskCount?: number;
}

export interface BoardData {
  id: string;
  userId: string;
  projectId?: string | null;
  name: string;
  description?: string | null;
  isDefault: boolean;
  columns?: BoardColumnData[];
  createdAt: number;
  updatedAt: number;
}

export interface TaskChecklistItemData {
  id: string;
  userId: string;
  taskId: string;
  title: string;
  isCompleted: boolean;
  completedAt?: number | null;
  sortOrder: number;
  createdAt: number;
  updatedAt: number;
}

export interface TaskData {
  id: string;
  userId: string;
  projectId?: string | null;
  boardId?: string | null;
  boardColumnId?: string | null;
  categoryId?: string | null;
  parentTaskId?: string | null;
  title: string;
  description?: string | null;
  status: TaskStatus;
  priority: TaskPriority;
  dueDate?: string | null; // YYYY-MM-DD
  dueTime?: string | null; // HH:MM
  dueTimestampMs?: number | null;
  startDate?: string | null;
  completedAt?: number | null;
  archivedAt?: number | null;
  sortOrder: number;
  sortOrderBoard: number;
  estimatedMinutes?: number | null;
  actualMinutes?: number | null;
  recurrenceRuleId?: string | null;
  recurrenceOccurrenceDate?: string | null;
  isRecurringTemplate: boolean;
  subtaskCount?: number;
  completedSubtaskCount?: number;
  checklistCount?: number;
  completedChecklistCount?: number;
  progressPercentage?: number;
  subtasks?: TaskData[];
  checklistItems?: TaskChecklistItemData[];
  createdAt: number;
  updatedAt: number;
}

export interface RecurrenceRuleData {
  id: string;
  userId: string;
  templateTaskId: string;
  frequency: RecurrenceFrequency;
  interval: number;
  byDayOfWeek?: number[] | null;
  byDayOfMonth?: number | null;
  byMonth?: number | null;
  endType: RecurrenceEndType;
  endCount?: number | null;
  endDate?: string | null;
  timezone: string;
  isActive: boolean;
  lastGeneratedDate?: string | null;
  createdAt: number;
  updatedAt: number;
}

export interface RecurrenceExceptionData {
  id: string;
  userId: string;
  recurrenceRuleId: string;
  occurrenceDate: string;
  action: RecurrenceExceptionAction;
  rescheduledToDate?: string | null;
  overrideTaskId?: string | null;
  reason?: string | null;
  createdAt: number;
}

export interface DailyNoteData {
  id: string;
  userId: string;
  date: string; // YYYY-MM-DD
  content: string;
  summary?: string | null;
  mood?: number | null;
  energy?: number | null;
  wordCount: number;
  isPinned: boolean;
  createdAt: number;
  updatedAt: number;
}

export interface NoteData {
  id: string;
  userId: string;
  categoryId?: string | null;
  projectId?: string | null;
  parentNoteId?: string | null;
  title: string;
  slug: string;
  content: string;
  summary?: string | null;
  isPinned: boolean;
  isArchived: boolean;
  wordCount: number;
  readingTimeMinutes: number;
  createdAt: number;
  updatedAt: number;
}

export interface PromptVariable {
  name: string;
  description?: string;
  default?: string;
}

export interface PromptVersionData {
  id: string;
  userId: string;
  promptId: string;
  version: number;
  systemPrompt?: string | null;
  template: string;
  variables?: PromptVariable[] | null;
  changeNotes?: string | null;
  createdAt: number;
}

export interface PromptData {
  id: string;
  userId: string;
  categoryId?: string | null;
  title: string;
  slug: string;
  description?: string | null;
  targetModel?: string | null;
  currentVersion: number;
  isFavorite: boolean;
  latestVersion?: PromptVersionData;
  createdAt: number;
  updatedAt: number;
}

export interface TodayDashboardData {
  date: string; // YYYY-MM-DD
  overdueTasks: TaskData[];
  todayTasks: TaskData[];
  completedTodayTasks: TaskData[];
  completedTodayCount: number;
  totalTodayCount: number;
  dailyNote?: DailyNoteData | null;
  pendingReminders: Array<{
    id: string;
    title: string;
    remindAt: number;
    entityType: string;
    entityId?: string | null;
  }>;
  activeProjects: Array<{
    id: string;
    name: string;
    color?: string | null;
    openTaskCount: number;
  }>;
}
