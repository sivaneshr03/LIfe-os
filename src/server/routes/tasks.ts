import { Hono } from 'hono';
import { z } from 'zod';
import { zValidator } from '@hono/zod-validator';
import { eq, and, sql, desc, asc, inArray, isNull, lt, gte, lte, like, or } from 'drizzle-orm';
import { createDb } from '../db/client';
import {
  tasks,
  taskChecklistItems,
  recurrenceRules,
  recurrenceExceptions,
  userPreferences,
} from '../db/schema';
import { requireAuth } from '../middleware/auth';
import {
  taskCreateSchema,
  taskUpdateSchema,
  taskQuerySchema,
  taskChecklistCreateSchema,
  taskChecklistUpdateSchema,
  recurrenceRuleCreateSchema,
  recurrenceExceptionCreateSchema,
} from '../../shared/schemas/productivity';
import { getTodayCalendarDate, isValidCalendarDate, shiftCalendarDate } from '../../shared/utils/date';
import { sanitizeSearchQuery } from '../../shared/utils/pagination';
import { generateOccurrencesForUser } from '../services/recurrenceService';
import type {
  ApiSuccessResponse,
  ApiPaginatedResponse,
  TaskData,
  TaskChecklistItemData,
  RecurrenceRuleData,
  RecurrenceExceptionData,
  TaskStatus,
  TaskPriority,
  RecurrenceFrequency,
  RecurrenceEndType,
  RecurrenceExceptionAction,
} from '../../shared/types';
import type { AppBindings } from '../index';

export const tasksRouter = new Hono<{ Bindings: AppBindings }>();

tasksRouter.use('*', requireAuth);

function calculateDueTimestamp(dueDate?: string | null, dueTime?: string | null): number | null {
  if (!dueDate || !isValidCalendarDate(dueDate)) return null;
  const [y, m, d] = dueDate.split('-').map(Number);
  const [h, min] = (dueTime || '00:00').split(':').map(Number);
  return Date.UTC(y, m - 1, d, h || 0, min || 0, 0);
}

function computeProgressPercentage(
  checklistCount: number,
  completedChecklistCount: number,
  subtaskCount: number,
  completedSubtaskCount: number,
  status: TaskStatus
): number {
  if (checklistCount > 0) {
    return Math.round((completedChecklistCount / checklistCount) * 100);
  }
  if (subtaskCount > 0) {
    return Math.round((completedSubtaskCount / subtaskCount) * 100);
  }
  return status === 'done' ? 100 : 0;
}

/**
 * GET /api/tasks
 * Filtered, sorted, paginated task list.
 */
tasksRouter.get('/', zValidator('query', taskQuerySchema), async (c) => {
  const user = c.get('user');
  const db = createDb(c.env.DB);
  const q = c.req.valid('query');

  const conditions = [
    eq(tasks.userId, user.id),
    eq(tasks.isRecurringTemplate, 0), // Ordinary tasks exclude templates
  ];

  // Status filter (support comma-separated)
  if (q.status) {
    const statuses = q.status.split(',').map((s) => s.trim()) as TaskStatus[];
    if (statuses.length === 1) {
      conditions.push(eq(tasks.status, statuses[0]));
    } else if (statuses.length > 1) {
      conditions.push(inArray(tasks.status, statuses));
    }
  }

  // Priority filter
  if (q.priority) {
    const priorities = q.priority.split(',').map((p) => p.trim()) as TaskPriority[];
    if (priorities.length === 1) {
      conditions.push(eq(tasks.priority, priorities[0]));
    } else if (priorities.length > 1) {
      conditions.push(inArray(tasks.priority, priorities));
    }
  }

  if (q.projectId) {
    conditions.push(eq(tasks.projectId, q.projectId));
  }

  if (q.boardId) {
    conditions.push(eq(tasks.boardId, q.boardId));
  }

  if (q.boardColumnId) {
    conditions.push(eq(tasks.boardColumnId, q.boardColumnId));
  }

  if (q.categoryId) {
    conditions.push(eq(tasks.categoryId, q.categoryId));
  }

  if (q.parentTaskId) {
    if (q.parentTaskId === 'null' || q.parentTaskId === 'none') {
      conditions.push(isNull(tasks.parentTaskId));
    } else {
      conditions.push(eq(tasks.parentTaskId, q.parentTaskId));
    }
  }

  if (q.dueDate) {
    conditions.push(eq(tasks.dueDate, q.dueDate));
  }

  if (q.dueBefore) {
    conditions.push(lte(tasks.dueDate, q.dueBefore));
  }

  if (q.dueAfter) {
    conditions.push(gte(tasks.dueDate, q.dueAfter));
  }

  if (q.isOverdue) {
    const prefs = (
      await db
        .select({ timezone: userPreferences.timezone })
        .from(userPreferences)
        .where(eq(userPreferences.userId, user.id))
        .limit(1)
    )[0];
    const today = getTodayCalendarDate(prefs?.timezone || 'UTC');
    conditions.push(lt(tasks.dueDate, today));
    conditions.push(sql`${tasks.status} NOT IN ('done', 'archived')`);
  }

  if (q.q && q.q.trim().length > 0) {
    const escaped = sanitizeSearchQuery(q.q.trim());
    const term = `%${escaped}%`;
    conditions.push(or(like(tasks.title, term), like(tasks.description, term))!);
  }

  const whereClause = and(...conditions);

  // Count total matching tasks
  const countRes = await db
    .select({ count: sql<number>`count(*)` })
    .from(tasks)
    .where(whereClause);
  const total = Number(countRes[0]?.count || 0);

  // Sorting
  let orderByClause;
  const dir = q.sortDir === 'desc' ? desc : asc;

  switch (q.sortBy) {
    case 'dueDate':
      orderByClause = dir(tasks.dueDate);
      break;
    case 'priority':
      orderByClause = dir(tasks.priority);
      break;
    case 'createdAt':
      orderByClause = dir(tasks.createdAt);
      break;
    case 'title':
      orderByClause = dir(tasks.title);
      break;
    case 'sortOrder':
    default:
      orderByClause = dir(tasks.sortOrder);
      break;
  }

  const offset = (q.page - 1) * q.pageSize;

  const rows = await db
    .select({
      task: tasks,
      checklistCount: sql<number>`(SELECT count(*) FROM task_checklist_items WHERE task_checklist_items.task_id = tasks.id)`,
      completedChecklistCount: sql<number>`(SELECT count(*) FROM task_checklist_items WHERE task_checklist_items.task_id = tasks.id AND task_checklist_items.is_completed = 1)`,
      subtaskCount: sql<number>`(SELECT count(*) FROM tasks AS sub WHERE sub.parent_task_id = tasks.id)`,
      completedSubtaskCount: sql<number>`(SELECT count(*) FROM tasks AS sub WHERE sub.parent_task_id = tasks.id AND sub.status = 'done')`,
    })
    .from(tasks)
    .where(whereClause)
    .orderBy(orderByClause, desc(tasks.createdAt))
    .limit(q.pageSize)
    .offset(offset);

  const items: TaskData[] = rows.map((r) => {
    const checklistCount = Number(r.checklistCount || 0);
    const completedChecklistCount = Number(r.completedChecklistCount || 0);
    const subtaskCount = Number(r.subtaskCount || 0);
    const completedSubtaskCount = Number(r.completedSubtaskCount || 0);
    const status = r.task.status as TaskStatus;

    return {
      id: r.task.id,
      userId: r.task.userId,
      projectId: r.task.projectId,
      boardId: r.task.boardId,
      boardColumnId: r.task.boardColumnId,
      categoryId: r.task.categoryId,
      parentTaskId: r.task.parentTaskId,
      title: r.task.title,
      description: r.task.description,
      status,
      priority: r.task.priority as TaskPriority,
      dueDate: r.task.dueDate,
      dueTime: r.task.dueTime,
      dueTimestampMs: r.task.dueTimestampMs ? r.task.dueTimestampMs.getTime() : null,
      startDate: r.task.startDate,
      completedAt: r.task.completedAt ? r.task.completedAt.getTime() : null,
      archivedAt: r.task.archivedAt ? r.task.archivedAt.getTime() : null,
      sortOrder: r.task.sortOrder,
      sortOrderBoard: r.task.sortOrderBoard,
      estimatedMinutes: r.task.estimatedMinutes,
      actualMinutes: r.task.actualMinutes,
      recurrenceRuleId: r.task.recurrenceRuleId,
      recurrenceOccurrenceDate: r.task.recurrenceOccurrenceDate,
      isRecurringTemplate: Boolean(r.task.isRecurringTemplate),
      checklistCount,
      completedChecklistCount,
      subtaskCount,
      completedSubtaskCount,
      progressPercentage: computeProgressPercentage(
        checklistCount,
        completedChecklistCount,
        subtaskCount,
        completedSubtaskCount,
        status
      ),
      createdAt: r.task.createdAt.getTime(),
      updatedAt: r.task.updatedAt.getTime(),
    };
  });

  return c.json<ApiPaginatedResponse<TaskData>>({
    success: true,
    data: {
      items,
      pagination: {
        page: q.page,
        pageSize: q.pageSize,
        totalItems: total,
        totalPages: Math.ceil(total / q.pageSize) || 1,
        hasNextPage: offset + items.length < total,
        hasPrevPage: q.page > 1,
      },
    },
  });
});

/**
 * POST /api/tasks
 * Create a new task or subtask.
 */
tasksRouter.post('/', zValidator('json', taskCreateSchema), async (c) => {
  const user = c.get('user');
  const db = createDb(c.env.DB);
  const input = c.req.valid('json');

  const id = `tsk_${crypto.randomUUID()}`;
  const now = new Date();
  const dueTimestampMs = calculateDueTimestamp(input.dueDate, input.dueTime);

  const completedAt = input.status === 'done' ? now : null;
  const archivedAt = input.status === 'archived' ? now : null;

  let ruleId: string | null = null;
  const isTemplate = Boolean(input.recurrence);

  if (input.recurrence) {
    ruleId = `rcr_${crypto.randomUUID()}`;
    const byDay = input.recurrence.byDayOfWeek || input.recurrence.daysOfWeek;
    let endType: RecurrenceEndType = 'never';
    if (input.recurrence.endType === 'count' || input.recurrence.endType === 'after_count') {
      endType = 'after_count';
    } else if (input.recurrence.endType === 'date' || input.recurrence.endType === 'until_date') {
      endType = 'until_date';
    }

    await db.insert(recurrenceRules).values({
      id: ruleId,
      userId: user.id,
      templateTaskId: id,
      frequency: input.recurrence.frequency,
      interval: input.recurrence.interval ?? 1,
      byDayOfWeek: byDay ? JSON.stringify(byDay) : null,
      byDayOfMonth: input.recurrence.byDayOfMonth ?? null,
      byMonth: input.recurrence.byMonth ?? null,
      endType,
      endCount: input.recurrence.endCount ?? null,
      endDate: input.recurrence.endDate ?? null,
      timezone: input.recurrence.timezone || 'UTC',
      isActive: 1,
      createdAt: now,
      updatedAt: now,
    });
  }

  await db.insert(tasks).values({
    id,
    userId: user.id,
    projectId: input.projectId || null,
    boardId: input.boardId || null,
    boardColumnId: input.boardColumnId || null,
    categoryId: input.categoryId || null,
    parentTaskId: input.parentTaskId || null,
    title: input.title,
    description: input.description || null,
    status: input.status,
    priority: input.priority,
    dueDate: input.dueDate || null,
    dueTime: input.dueTime || null,
    dueTimestampMs: dueTimestampMs ? new Date(dueTimestampMs) : null,
    startDate: input.startDate || null,
    completedAt,
    archivedAt,
    sortOrder: input.sortOrder ?? 0,
    sortOrderBoard: input.sortOrderBoard ?? 0,
    estimatedMinutes: input.estimatedMinutes || null,
    actualMinutes: input.actualMinutes || null,
    recurrenceRuleId: ruleId,
    isRecurringTemplate: isTemplate ? 1 : 0,
    createdAt: now,
    updatedAt: now,
  });

  if (isTemplate) {
    const today = getTodayCalendarDate(input.recurrence?.timezone || 'UTC');
    await generateOccurrencesForUser(c.env.DB, user.id, today);
  }

  const created: TaskData = {
    id,
    userId: user.id,
    projectId: input.projectId || null,
    boardId: input.boardId || null,
    boardColumnId: input.boardColumnId || null,
    categoryId: input.categoryId || null,
    parentTaskId: input.parentTaskId || null,
    title: input.title,
    description: input.description || null,
    status: input.status,
    priority: input.priority,
    dueDate: input.dueDate || null,
    dueTime: input.dueTime || null,
    dueTimestampMs,
    startDate: input.startDate || null,
    completedAt: completedAt ? completedAt.getTime() : null,
    archivedAt: archivedAt ? archivedAt.getTime() : null,
    sortOrder: input.sortOrder ?? 0,
    sortOrderBoard: input.sortOrderBoard ?? 0,
    estimatedMinutes: input.estimatedMinutes || null,
    actualMinutes: input.actualMinutes || null,
    recurrenceRuleId: ruleId,
    isRecurringTemplate: isTemplate,
    checklistCount: 0,
    completedChecklistCount: 0,
    subtaskCount: 0,
    completedSubtaskCount: 0,
    progressPercentage: input.status === 'done' ? 100 : 0,
    createdAt: now.getTime(),
    updatedAt: now.getTime(),
  };

  return c.json<ApiSuccessResponse<TaskData>>({ success: true, data: created }, 201);
});

/**
 * GET /api/tasks/:id
 * Detailed task with subtasks and checklist items.
 */
tasksRouter.get('/:id', async (c) => {
  const user = c.get('user');
  const db = createDb(c.env.DB);
  const id = c.req.param('id');

  const taskRow = (
    await db
      .select()
      .from(tasks)
      .where(and(eq(tasks.id, id), eq(tasks.userId, user.id)))
      .limit(1)
  )[0];

  if (!taskRow) {
    return c.json({ success: false, error: { code: 'NOT_FOUND', message: 'Task not found' } }, 404);
  }

  // Fetch checklist items
  const checklistRows = await db
    .select()
    .from(taskChecklistItems)
    .where(and(eq(taskChecklistItems.taskId, id), eq(taskChecklistItems.userId, user.id)))
    .orderBy(taskChecklistItems.sortOrder, taskChecklistItems.createdAt);

  const checklistItems: TaskChecklistItemData[] = checklistRows.map((item) => ({
    id: item.id,
    userId: item.userId,
    taskId: item.taskId,
    title: item.title,
    isCompleted: Boolean(item.isCompleted),
    completedAt: item.completedAt ? item.completedAt.getTime() : null,
    sortOrder: item.sortOrder,
    createdAt: item.createdAt.getTime(),
    updatedAt: item.updatedAt.getTime(),
  }));

  // Fetch direct subtasks
  const subtaskRows = await db
    .select()
    .from(tasks)
    .where(and(eq(tasks.parentTaskId, id), eq(tasks.userId, user.id)))
    .orderBy(tasks.sortOrder, tasks.createdAt);

  const subtasks: TaskData[] = subtaskRows.map((s) => ({
    id: s.id,
    userId: s.userId,
    projectId: s.projectId,
    boardId: s.boardId,
    boardColumnId: s.boardColumnId,
    categoryId: s.categoryId,
    parentTaskId: s.parentTaskId,
    title: s.title,
    description: s.description,
    status: s.status as TaskStatus,
    priority: s.priority as TaskPriority,
    dueDate: s.dueDate,
    dueTime: s.dueTime,
    dueTimestampMs: s.dueTimestampMs ? s.dueTimestampMs.getTime() : null,
    startDate: s.startDate,
    completedAt: s.completedAt ? s.completedAt.getTime() : null,
    archivedAt: s.archivedAt ? s.archivedAt.getTime() : null,
    sortOrder: s.sortOrder,
    sortOrderBoard: s.sortOrderBoard,
    estimatedMinutes: s.estimatedMinutes,
    actualMinutes: s.actualMinutes,
    isRecurringTemplate: Boolean(s.isRecurringTemplate),
    createdAt: s.createdAt.getTime(),
    updatedAt: s.updatedAt.getTime(),
  }));

  const checklistCount = checklistItems.length;
  const completedChecklistCount = checklistItems.filter((i) => i.isCompleted).length;
  const subtaskCount = subtasks.length;
  const completedSubtaskCount = subtasks.filter((s) => s.status === 'done').length;

  const data: TaskData = {
    id: taskRow.id,
    userId: taskRow.userId,
    projectId: taskRow.projectId,
    boardId: taskRow.boardId,
    boardColumnId: taskRow.boardColumnId,
    categoryId: taskRow.categoryId,
    parentTaskId: taskRow.parentTaskId,
    title: taskRow.title,
    description: taskRow.description,
    status: taskRow.status as TaskStatus,
    priority: taskRow.priority as TaskPriority,
    dueDate: taskRow.dueDate,
    dueTime: taskRow.dueTime,
    dueTimestampMs: taskRow.dueTimestampMs ? taskRow.dueTimestampMs.getTime() : null,
    startDate: taskRow.startDate,
    completedAt: taskRow.completedAt ? taskRow.completedAt.getTime() : null,
    archivedAt: taskRow.archivedAt ? taskRow.archivedAt.getTime() : null,
    sortOrder: taskRow.sortOrder,
    sortOrderBoard: taskRow.sortOrderBoard,
    estimatedMinutes: taskRow.estimatedMinutes,
    actualMinutes: taskRow.actualMinutes,
    recurrenceRuleId: taskRow.recurrenceRuleId,
    recurrenceOccurrenceDate: taskRow.recurrenceOccurrenceDate,
    isRecurringTemplate: Boolean(taskRow.isRecurringTemplate),
    checklistCount,
    completedChecklistCount,
    subtaskCount,
    completedSubtaskCount,
    progressPercentage: computeProgressPercentage(
      checklistCount,
      completedChecklistCount,
      subtaskCount,
      completedSubtaskCount,
      taskRow.status as TaskStatus
    ),
    checklistItems,
    subtasks,
    createdAt: taskRow.createdAt.getTime(),
    updatedAt: taskRow.updatedAt.getTime(),
  };

  return c.json<ApiSuccessResponse<TaskData>>({ success: true, data });
});

/**
 * PATCH /api/tasks/:id
 * Update task attributes with automatic status timestamp handling.
 */
tasksRouter.patch('/:id', zValidator('json', taskUpdateSchema), async (c) => {
  const user = c.get('user');
  const db = createDb(c.env.DB);
  const id = c.req.param('id');
  const input = c.req.valid('json');

  const existing = (
    await db
      .select()
      .from(tasks)
      .where(and(eq(tasks.id, id), eq(tasks.userId, user.id)))
      .limit(1)
  )[0];

  if (!existing) {
    return c.json({ success: false, error: { code: 'NOT_FOUND', message: 'Task not found' } }, 404);
  }

  const now = new Date();
  const updateData: Partial<typeof tasks.$inferInsert> = {
    updatedAt: now,
  };

  if (input.title !== undefined) updateData.title = input.title;
  if (input.description !== undefined) updateData.description = input.description;
  if (input.projectId !== undefined) updateData.projectId = input.projectId;
  if (input.boardId !== undefined) updateData.boardId = input.boardId;
  if (input.boardColumnId !== undefined) updateData.boardColumnId = input.boardColumnId;
  if (input.categoryId !== undefined) updateData.categoryId = input.categoryId;
  if (input.parentTaskId !== undefined) updateData.parentTaskId = input.parentTaskId;
  if (input.priority !== undefined) updateData.priority = input.priority;
  if (input.startDate !== undefined) updateData.startDate = input.startDate;
  if (input.sortOrder !== undefined) updateData.sortOrder = input.sortOrder;
  if (input.sortOrderBoard !== undefined) updateData.sortOrderBoard = input.sortOrderBoard;
  if (input.estimatedMinutes !== undefined) updateData.estimatedMinutes = input.estimatedMinutes;
  if (input.actualMinutes !== undefined) updateData.actualMinutes = input.actualMinutes;

  // Handle due date / time calculation
  const newDueDate = input.dueDate !== undefined ? input.dueDate : existing.dueDate;
  const newDueTime = input.dueTime !== undefined ? input.dueTime : existing.dueTime;
  if (input.dueDate !== undefined || input.dueTime !== undefined) {
    updateData.dueDate = newDueDate;
    updateData.dueTime = newDueTime;
    const ts = calculateDueTimestamp(newDueDate, newDueTime);
    updateData.dueTimestampMs = ts ? new Date(ts) : null;
  }

  // Handle status transition timestamps
  if (input.status !== undefined) {
    updateData.status = input.status;
    if (input.status === 'done' && existing.status !== 'done') {
      updateData.completedAt = now;
    } else if (input.status !== 'done' && existing.status === 'done') {
      updateData.completedAt = null;
    }

    if (input.status === 'archived' && existing.status !== 'archived') {
      updateData.archivedAt = now;
    } else if (input.status !== 'archived' && existing.status === 'archived') {
      updateData.archivedAt = null;
    }
  }

  await db.update(tasks).set(updateData).where(eq(tasks.id, id));

  // Retrieve updated row
  const updated = (await db.select().from(tasks).where(eq(tasks.id, id)).limit(1))[0];

  const data: TaskData = {
    id: updated.id,
    userId: updated.userId,
    projectId: updated.projectId,
    boardId: updated.boardId,
    boardColumnId: updated.boardColumnId,
    categoryId: updated.categoryId,
    parentTaskId: updated.parentTaskId,
    title: updated.title,
    description: updated.description,
    status: updated.status as TaskStatus,
    priority: updated.priority as TaskPriority,
    dueDate: updated.dueDate,
    dueTime: updated.dueTime,
    dueTimestampMs: updated.dueTimestampMs ? updated.dueTimestampMs.getTime() : null,
    startDate: updated.startDate,
    completedAt: updated.completedAt ? updated.completedAt.getTime() : null,
    archivedAt: updated.archivedAt ? updated.archivedAt.getTime() : null,
    sortOrder: updated.sortOrder,
    sortOrderBoard: updated.sortOrderBoard,
    estimatedMinutes: updated.estimatedMinutes,
    actualMinutes: updated.actualMinutes,
    recurrenceRuleId: updated.recurrenceRuleId,
    recurrenceOccurrenceDate: updated.recurrenceOccurrenceDate,
    isRecurringTemplate: Boolean(updated.isRecurringTemplate),
    createdAt: updated.createdAt.getTime(),
    updatedAt: updated.updatedAt.getTime(),
  };

  return c.json<ApiSuccessResponse<TaskData>>({ success: true, data });
});

/**
 * DELETE /api/tasks/:id
 */
tasksRouter.delete('/:id', async (c) => {
  const user = c.get('user');
  const db = createDb(c.env.DB);
  const id = c.req.param('id');

  const existing = (
    await db
      .select({ id: tasks.id })
      .from(tasks)
      .where(and(eq(tasks.id, id), eq(tasks.userId, user.id)))
      .limit(1)
  )[0];

  if (!existing) {
    return c.json({ success: false, error: { code: 'NOT_FOUND', message: 'Task not found' } }, 404);
  }

  await db.delete(tasks).where(eq(tasks.id, id));

  return c.json<ApiSuccessResponse<{ id: string }>>({ success: true, data: { id } });
});

// ==========================================
// CHECKLIST ITEMS
// ==========================================

/**
 * POST /api/tasks/:id/checklist
 */
tasksRouter.post('/:id/checklist', zValidator('json', taskChecklistCreateSchema), async (c) => {
  const user = c.get('user');
  const db = createDb(c.env.DB);
  const taskId = c.req.param('id');
  const input = c.req.valid('json');

  const task = (
    await db
      .select({ id: tasks.id })
      .from(tasks)
      .where(and(eq(tasks.id, taskId), eq(tasks.userId, user.id)))
      .limit(1)
  )[0];

  if (!task) {
    return c.json({ success: false, error: { code: 'NOT_FOUND', message: 'Task not found' } }, 404);
  }

  const id = `chk_${crypto.randomUUID()}`;
  const now = new Date();

  await db.insert(taskChecklistItems).values({
    id,
    userId: user.id,
    taskId,
    title: input.title,
    isCompleted: 0,
    sortOrder: input.sortOrder ?? 0,
    createdAt: now,
    updatedAt: now,
  });

  const data: TaskChecklistItemData = {
    id,
    userId: user.id,
    taskId,
    title: input.title,
    isCompleted: false,
    completedAt: null,
    sortOrder: input.sortOrder ?? 0,
    createdAt: now.getTime(),
    updatedAt: now.getTime(),
  };

  return c.json<ApiSuccessResponse<TaskChecklistItemData>>({ success: true, data }, 201);
});

/**
 * PATCH /api/tasks/checklist/:itemId
 */
tasksRouter.patch('/checklist/:itemId', zValidator('json', taskChecklistUpdateSchema), async (c) => {
  const user = c.get('user');
  const db = createDb(c.env.DB);
  const itemId = c.req.param('itemId');
  const input = c.req.valid('json');

  const existing = (
    await db
      .select()
      .from(taskChecklistItems)
      .where(and(eq(taskChecklistItems.id, itemId), eq(taskChecklistItems.userId, user.id)))
      .limit(1)
  )[0];

  if (!existing) {
    return c.json(
      { success: false, error: { code: 'NOT_FOUND', message: 'Checklist item not found' } },
      404
    );
  }

  const now = new Date();
  const updateData: Partial<typeof taskChecklistItems.$inferInsert> = {
    updatedAt: now,
  };

  if (input.title !== undefined) updateData.title = input.title;
  if (input.sortOrder !== undefined) updateData.sortOrder = input.sortOrder;
  if (input.isCompleted !== undefined) {
    updateData.isCompleted = input.isCompleted ? 1 : 0;
    updateData.completedAt = input.isCompleted ? now : null;
  }

  await db.update(taskChecklistItems).set(updateData).where(eq(taskChecklistItems.id, itemId));

  const updated = (
    await db.select().from(taskChecklistItems).where(eq(taskChecklistItems.id, itemId)).limit(1)
  )[0];

  const data: TaskChecklistItemData = {
    id: updated.id,
    userId: updated.userId,
    taskId: updated.taskId,
    title: updated.title,
    isCompleted: Boolean(updated.isCompleted),
    completedAt: updated.completedAt ? updated.completedAt.getTime() : null,
    sortOrder: updated.sortOrder,
    createdAt: updated.createdAt.getTime(),
    updatedAt: updated.updatedAt.getTime(),
  };

  return c.json<ApiSuccessResponse<TaskChecklistItemData>>({ success: true, data });
});

/**
 * DELETE /api/tasks/checklist/:itemId
 */
tasksRouter.delete('/checklist/:itemId', async (c) => {
  const user = c.get('user');
  const db = createDb(c.env.DB);
  const itemId = c.req.param('itemId');

  const existing = (
    await db
      .select({ id: taskChecklistItems.id })
      .from(taskChecklistItems)
      .where(and(eq(taskChecklistItems.id, itemId), eq(taskChecklistItems.userId, user.id)))
      .limit(1)
  )[0];

  if (!existing) {
    return c.json(
      { success: false, error: { code: 'NOT_FOUND', message: 'Checklist item not found' } },
      404
    );
  }

  await db.delete(taskChecklistItems).where(eq(taskChecklistItems.id, itemId));

  return c.json<ApiSuccessResponse<{ id: string }>>({ success: true, data: { id: itemId } });
});

// ==========================================
// RECURRENCE CONFIGURATION & EXCEPTIONS
// ==========================================

/**
 * POST /api/tasks/:id/recurrence
 * Attaches or configures a recurrence rule for a task template.
 */
tasksRouter.post('/:id/recurrence', zValidator('json', recurrenceRuleCreateSchema.omit({ templateTaskId: true })), async (c) => {
  const user = c.get('user');
  const db = createDb(c.env.DB);
  const taskId = c.req.param('id');
  const input = c.req.valid('json');

  const task = (
    await db
      .select()
      .from(tasks)
      .where(and(eq(tasks.id, taskId), eq(tasks.userId, user.id)))
      .limit(1)
  )[0];

  if (!task) {
    return c.json({ success: false, error: { code: 'NOT_FOUND', message: 'Task not found' } }, 404);
  }

  const ruleId = `rcr_${crypto.randomUUID()}`;
  const now = new Date();

  // Mark base task as template
  await db
    .update(tasks)
    .set({
      isRecurringTemplate: 1,
      recurrenceRuleId: ruleId,
      updatedAt: now,
    })
    .where(eq(tasks.id, taskId));

  // Insert rule
  await db.insert(recurrenceRules).values({
    id: ruleId,
    userId: user.id,
    templateTaskId: taskId,
    frequency: input.frequency,
    interval: input.interval ?? 1,
    byDayOfWeek: input.byDayOfWeek ? JSON.stringify(input.byDayOfWeek) : null,
    byDayOfMonth: input.byDayOfMonth ?? null,
    byMonth: input.byMonth ?? null,
    endType: input.endType ?? 'never',
    endCount: input.endCount ?? null,
    endDate: input.endDate ?? null,
    timezone: input.timezone || 'UTC',
    isActive: 1,
    createdAt: now,
    updatedAt: now,
  });

  // Materialize initial occurrences for the next 14 days
  const today = getTodayCalendarDate(input.timezone || 'UTC');
  await generateOccurrencesForUser(c.env.DB, user.id, today);

  const data: RecurrenceRuleData = {
    id: ruleId,
    userId: user.id,
    templateTaskId: taskId,
    frequency: input.frequency as RecurrenceFrequency,
    interval: input.interval ?? 1,
    byDayOfWeek: input.byDayOfWeek ?? null,
    byDayOfMonth: input.byDayOfMonth ?? null,
    byMonth: input.byMonth ?? null,
    endType: input.endType as RecurrenceEndType,
    endCount: input.endCount ?? null,
    endDate: input.endDate ?? null,
    timezone: input.timezone || 'UTC',
    isActive: true,
    createdAt: now.getTime(),
    updatedAt: now.getTime(),
  };

  return c.json<ApiSuccessResponse<RecurrenceRuleData>>({ success: true, data }, 201);
});

/**
 * POST /api/tasks/recurrence/:ruleId/exceptions
 * Record an occurrence skip, reschedule, cancellation, or override.
 */
tasksRouter.post(
  '/recurrence/:ruleId/exceptions',
  zValidator('json', recurrenceExceptionCreateSchema),
  async (c) => {
    const user = c.get('user');
    const db = createDb(c.env.DB);
    const ruleId = c.req.param('ruleId');
    const input = c.req.valid('json');

    const rule = (
      await db
        .select()
        .from(recurrenceRules)
        .where(and(eq(recurrenceRules.id, ruleId), eq(recurrenceRules.userId, user.id)))
        .limit(1)
    )[0];

    if (!rule) {
      return c.json(
        { success: false, error: { code: 'NOT_FOUND', message: 'Recurrence rule not found' } },
        404
      );
    }

    const exceptionId = `rex_${crypto.randomUUID()}`;
    const now = new Date();

    await db.insert(recurrenceExceptions).values({
      id: exceptionId,
      userId: user.id,
      recurrenceRuleId: ruleId,
      occurrenceDate: input.occurrenceDate,
      action: input.action,
      rescheduledToDate: input.rescheduledToDate || null,
      reason: input.reason || null,
      createdAt: now,
    });

    // If action is skip or cancel, delete or archive any existing occurrence matching this rule and date
    if (input.action === 'skip' || input.action === 'cancel') {
      await db
        .delete(tasks)
        .where(
          and(
            eq(tasks.userId, user.id),
            eq(tasks.recurrenceRuleId, ruleId),
            eq(tasks.recurrenceOccurrenceDate, input.occurrenceDate)
          )
        );
    } else if (input.action === 'reschedule' && input.rescheduledToDate) {
      // Shift existing occurrence date
      await db
        .update(tasks)
        .set({
          dueDate: input.rescheduledToDate,
          updatedAt: now,
        })
        .where(
          and(
            eq(tasks.userId, user.id),
            eq(tasks.recurrenceRuleId, ruleId),
            eq(tasks.recurrenceOccurrenceDate, input.occurrenceDate)
          )
        );
    }

    const data: RecurrenceExceptionData = {
      id: exceptionId,
      userId: user.id,
      recurrenceRuleId: ruleId,
      occurrenceDate: input.occurrenceDate,
      action: input.action as RecurrenceExceptionAction,
      rescheduledToDate: input.rescheduledToDate ?? null,
      reason: input.reason ?? null,
      createdAt: now.getTime(),
    };

    return c.json<ApiSuccessResponse<RecurrenceExceptionData>>({ success: true, data }, 201);
  }
);

/**
 * POST /api/tasks/recurrence/generate
 * Trigger batch generation of upcoming task occurrences.
 */
tasksRouter.post(
  '/recurrence/generate',
  zValidator(
    'json',
    z.object({
      horizonDays: z.number().int().min(1).max(365).optional().default(30),
      targetDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
    })
  ),
  async (c) => {
    const user = c.get('user');
    const { horizonDays, targetDate } = c.req.valid('json');
    const db = createDb(c.env.DB);
    const prefs = (
      await db
        .select({ timezone: userPreferences.timezone })
        .from(userPreferences)
        .where(eq(userPreferences.userId, user.id))
        .limit(1)
    )[0];
    const tz = prefs?.timezone || 'UTC';
    const today = getTodayCalendarDate(tz);
    const computedTarget = targetDate || shiftCalendarDate(today, horizonDays || 30);
    const result = await generateOccurrencesForUser(c.env.DB, user.id, computedTarget);
    return c.json<ApiSuccessResponse<{ generatedCount: number }>>({ success: true, data: result });
  }
);
