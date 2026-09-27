import { z } from 'zod';
import {
  taskStatusEnum,
  taskPriorityEnum,
  projectStatusEnum,
  recurrenceFrequencyEnum,
  recurrenceEndTypeEnum,
  recurrenceExceptionActionEnum,
} from '../productivityTypes';

export const projectCreateSchema = z.object({
  name: z.string().min(1, 'Name is required').max(100).trim(),
  categoryId: z.string().optional().nullable(),
  description: z.string().max(1000).optional().nullable(),
  color: z.string().max(30).optional().nullable(),
  icon: z.string().max(50).optional().nullable(),
  targetDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Must be YYYY-MM-DD').optional().nullable(),
  sortOrder: z.number().int().optional().default(0),
});

export const projectUpdateSchema = z.object({
  name: z.string().min(1).max(100).trim().optional(),
  categoryId: z.string().optional().nullable(),
  description: z.string().max(1000).optional().nullable(),
  color: z.string().max(30).optional().nullable(),
  icon: z.string().max(50).optional().nullable(),
  status: z.enum(projectStatusEnum).optional(),
  targetDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional().nullable(),
  sortOrder: z.number().int().optional(),
});

export const boardCreateSchema = z.object({
  projectId: z.string().optional().nullable(),
  name: z.string().min(1, 'Name is required').max(100).trim(),
  description: z.string().max(500).optional().nullable(),
  isDefault: z.boolean().optional().default(false),
});

export const boardUpdateSchema = z.object({
  name: z.string().min(1).max(100).trim().optional(),
  description: z.string().max(500).optional().nullable(),
  isDefault: z.boolean().optional(),
});

export const boardColumnCreateSchema = z.object({
  name: z.string().min(1, 'Name is required').max(50).trim(),
  statusMapping: z.enum(taskStatusEnum).default('todo'),
  color: z.string().max(30).optional().nullable(),
  wipLimit: z.number().int().min(1).optional().nullable(),
  sortOrder: z.number().int().optional().default(0),
});

export const boardColumnUpdateSchema = z.object({
  name: z.string().min(1).max(50).trim().optional(),
  statusMapping: z.enum(taskStatusEnum).optional(),
  color: z.string().max(30).optional().nullable(),
  wipLimit: z.number().int().min(1).optional().nullable(),
  sortOrder: z.number().int().optional(),
});

export const recurrenceInlineInputSchema = z.object({
  frequency: z.enum(recurrenceFrequencyEnum),
  interval: z.number().int().min(1).default(1),
  daysOfWeek: z.array(z.number().int().min(0).max(6)).optional().nullable(),
  byDayOfWeek: z.array(z.number().int().min(0).max(6)).optional().nullable(),
  byDayOfMonth: z.number().int().min(1).max(31).optional().nullable(),
  byMonth: z.number().int().min(1).max(12).optional().nullable(),
  endType: z.enum(['never', 'after_count', 'until_date', 'count', 'date']).default('never'),
  endCount: z.number().int().min(1).optional().nullable(),
  endDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional().nullable(),
  timezone: z.string().default('UTC'),
});

export const taskCreateSchema = z.object({
  projectId: z.string().optional().nullable(),
  boardId: z.string().optional().nullable(),
  boardColumnId: z.string().optional().nullable(),
  categoryId: z.string().optional().nullable(),
  parentTaskId: z.string().optional().nullable(),
  title: z.string().min(1, 'Title is required').max(255).trim(),
  description: z.string().optional().nullable(),
  status: z.enum(taskStatusEnum).default('todo'),
  priority: z.enum(taskPriorityEnum).default('medium'),
  dueDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Must be YYYY-MM-DD').optional().nullable(),
  dueTime: z.string().regex(/^\d{2}:\d{2}$/, 'Must be HH:MM').optional().nullable(),
  startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional().nullable(),
  sortOrder: z.number().int().optional().default(0),
  sortOrderBoard: z.number().int().optional().default(0),
  estimatedMinutes: z.number().int().min(0).optional().nullable(),
  actualMinutes: z.number().int().min(0).optional().nullable(),
  recurrence: recurrenceInlineInputSchema.optional().nullable(),
});

export const taskUpdateSchema = z.object({
  projectId: z.string().optional().nullable(),
  boardId: z.string().optional().nullable(),
  boardColumnId: z.string().optional().nullable(),
  categoryId: z.string().optional().nullable(),
  parentTaskId: z.string().optional().nullable(),
  title: z.string().min(1).max(255).trim().optional(),
  description: z.string().optional().nullable(),
  status: z.enum(taskStatusEnum).optional(),
  priority: z.enum(taskPriorityEnum).optional(),
  dueDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional().nullable(),
  dueTime: z.string().regex(/^\d{2}:\d{2}$/).optional().nullable(),
  startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional().nullable(),
  sortOrder: z.number().int().optional(),
  sortOrderBoard: z.number().int().optional(),
  estimatedMinutes: z.number().int().min(0).optional().nullable(),
  actualMinutes: z.number().int().min(0).optional().nullable(),
});

export const taskQuerySchema = z.object({
  status: z.string().optional(), // Comma-separated or single
  priority: z.string().optional(),
  projectId: z.string().optional(),
  boardId: z.string().optional(),
  boardColumnId: z.string().optional(),
  categoryId: z.string().optional(),
  parentTaskId: z.string().optional(), // 'null' for top-level only
  dueBefore: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  dueAfter: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  dueDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  isOverdue: z
    .enum(['true', 'false'])
    .optional()
    .transform((v) => (v === undefined ? undefined : v === 'true')),
  q: z.string().max(100).optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(50),
  sortBy: z.enum(['dueDate', 'priority', 'sortOrder', 'createdAt', 'title']).default('sortOrder'),
  sortDir: z.enum(['asc', 'desc']).default('asc'),
});

export const taskChecklistCreateSchema = z.object({
  title: z.string().min(1, 'Title is required').max(200).trim(),
  sortOrder: z.number().int().optional().default(0),
});

export const taskChecklistUpdateSchema = z.object({
  title: z.string().min(1).max(200).trim().optional(),
  isCompleted: z.boolean().optional(),
  sortOrder: z.number().int().optional(),
});

export const recurrenceRuleCreateSchema = z.object({
  templateTaskId: z.string().min(1),
  frequency: z.enum(recurrenceFrequencyEnum),
  interval: z.number().int().min(1).default(1),
  byDayOfWeek: z.array(z.number().int().min(0).max(6)).optional().nullable(),
  byDayOfMonth: z.number().int().min(1).max(31).optional().nullable(),
  byMonth: z.number().int().min(1).max(12).optional().nullable(),
  endType: z.enum(recurrenceEndTypeEnum).default('never'),
  endCount: z.number().int().min(1).optional().nullable(),
  endDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional().nullable(),
  timezone: z.string().min(1).default('UTC'),
});

export const recurrenceExceptionCreateSchema = z.object({
  occurrenceDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  action: z.enum(recurrenceExceptionActionEnum),
  rescheduledToDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional().nullable(),
  reason: z.string().max(255).optional().nullable(),
});

export const dailyNoteUpsertSchema = z.object({
  content: z.string().default(''),
  summary: z.string().max(255).optional().nullable(),
  mood: z.union([z.string().max(50), z.number()]).optional().nullable(),
  energy: z.number().int().min(1).max(5).optional().nullable(),
  isPinned: z.boolean().optional().default(false),
});

export const noteCreateSchema = z.object({
  categoryId: z.string().optional().nullable(),
  projectId: z.string().optional().nullable(),
  parentNoteId: z.string().optional().nullable(),
  title: z.string().min(1, 'Title is required').max(255).trim(),
  content: z.string().default(''),
  summary: z.string().max(500).optional().nullable(),
  isPinned: z.boolean().optional().default(false),
});

export const noteUpdateSchema = z.object({
  categoryId: z.string().optional().nullable(),
  projectId: z.string().optional().nullable(),
  parentNoteId: z.string().optional().nullable(),
  title: z.string().min(1).max(255).trim().optional(),
  content: z.string().optional(),
  summary: z.string().max(500).optional().nullable(),
  isPinned: z.boolean().optional(),
  isArchived: z.boolean().optional(),
});

export const noteQuerySchema = z.object({
  categoryId: z.string().optional(),
  projectId: z.string().optional(),
  isArchived: z
    .enum(['true', 'false'])
    .optional()
    .transform((v) => (v === undefined ? undefined : v === 'true')),
  isPinned: z
    .enum(['true', 'false'])
    .optional()
    .transform((v) => (v === undefined ? undefined : v === 'true')),
  q: z.string().max(100).optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(30),
});

export const promptVariableSchema = z.object({
  name: z.string().min(1).max(50).trim(),
  description: z.string().max(255).optional(),
  default: z.string().optional(),
});

export const promptCreateSchema = z.object({
  categoryId: z.string().optional().nullable(),
  title: z.string().min(1, 'Title is required').max(200).trim(),
  description: z.string().max(500).optional().nullable(),
  targetModel: z.string().max(100).optional().nullable(),
  template: z.string().min(1, 'Template text is required'),
  systemPrompt: z.string().optional().nullable(),
  variables: z.array(promptVariableSchema).optional().nullable(),
  changeNotes: z.string().max(255).optional().nullable(),
  isFavorite: z.boolean().optional().default(false),
});

export const promptVersionCreateSchema = z.object({
  template: z.string().min(1, 'Template text is required'),
  systemPrompt: z.string().optional().nullable(),
  variables: z.array(promptVariableSchema).optional().nullable(),
  changeNotes: z.string().max(255).optional().nullable(),
});

export const promptUpdateSchema = z.object({
  categoryId: z.string().optional().nullable(),
  title: z.string().min(1).max(200).trim().optional(),
  description: z.string().max(500).optional().nullable(),
  targetModel: z.string().max(100).optional().nullable(),
  isFavorite: z.boolean().optional(),
});
