import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import { eq, and, sql, desc } from 'drizzle-orm';
import { z } from 'zod';
import { createDb } from '../db/client';
import { goals, goalMilestones, goalProgressLogs, goalTaskLinks, tasks } from '../db/schema';
import { requireAuth } from '../middleware/auth';
import {
  goalCreateSchema,
  goalUpdateSchema,
  goalMilestoneCreateSchema,
  goalMilestoneUpdateSchema,
  goalProgressLogCreateSchema,
  goalTaskLinkCreateSchema,
} from '../../shared/schemas/trackers';
import { isValidCalendarDate } from '../../shared/utils/date';
import { syncAndLogGoalProgress } from '../services/goalProgressService';
import type {
  ApiSuccessResponse,
  GoalData,
  GoalMilestoneData,
  GoalProgressLogData,
  GoalTaskLinkData,
  GoalStatus,
  GoalTimeframe,
} from '../../shared/types';
import type { AppBindings } from '../index';

export const goalsRouter = new Hono<{ Bindings: AppBindings }>();

goalsRouter.use('*', requireAuth);

/**
 * GET /api/goals
 * List goals with milestone counts.
 */
goalsRouter.get(
  '/',
  zValidator(
    'query',
    z.object({
      status: z.string().optional(),
      timeframe: z.string().optional(),
      categoryId: z.string().optional(),
      projectId: z.string().optional(),
    })
  ),
  async (c) => {
    const user = c.get('user');
    const db = createDb(c.env.DB);
    const { status, timeframe, categoryId, projectId } = c.req.valid('query');

    const conditions = [eq(goals.userId, user.id)];

    if (status) {
      conditions.push(eq(goals.status, status as GoalStatus));
    }
    if (timeframe) {
      conditions.push(eq(goals.timeframe, timeframe as GoalTimeframe));
    }
    if (categoryId) {
      conditions.push(eq(goals.categoryId, categoryId));
    }
    if (projectId) {
      conditions.push(eq(goals.projectId, projectId));
    }

    const rows = await db
      .select({
        goal: goals,
        milestoneCount: sql<number>`(SELECT count(*) FROM goal_milestones WHERE goal_milestones.goal_id = goals.id)`,
        completedMilestoneCount: sql<number>`(SELECT count(*) FROM goal_milestones WHERE goal_milestones.goal_id = goals.id AND goal_milestones.is_completed = 1)`,
      })
      .from(goals)
      .where(and(...conditions))
      .orderBy(goals.targetDate, desc(goals.createdAt));

    const data: GoalData[] = rows.map(({ goal, milestoneCount, completedMilestoneCount }) => ({
      id: goal.id,
      userId: goal.userId,
      categoryId: goal.categoryId,
      projectId: goal.projectId,
      title: goal.title,
      description: goal.description,
      timeframe: (goal.timeframe as GoalTimeframe) || null,
      targetDate: goal.targetDate,
      status: goal.status as GoalStatus,
      progressPercentage: goal.progressPercentage,
      color: goal.color,
      icon: goal.icon,
      notes: goal.notes,
      milestoneCount: Number(milestoneCount || 0),
      completedMilestoneCount: Number(completedMilestoneCount || 0),
      createdAt: goal.createdAt.getTime(),
      updatedAt: goal.updatedAt.getTime(),
    }));

    return c.json<ApiSuccessResponse<GoalData[]>>({ success: true, data });
  }
);

/**
 * POST /api/goals
 * Create goal with optional initial milestones.
 */
goalsRouter.post('/', zValidator('json', goalCreateSchema), async (c) => {
  const user = c.get('user');
  const db = createDb(c.env.DB);
  const input = c.req.valid('json');

  if (input.targetDate && !isValidCalendarDate(input.targetDate)) {
    return c.json(
      { success: false, error: { code: 'BAD_REQUEST', message: 'Target date must be YYYY-MM-DD' } },
      400
    );
  }

  const goalId = `gol_${crypto.randomUUID()}`;
  const now = new Date();

  await db.insert(goals).values({
    id: goalId,
    userId: user.id,
    categoryId: input.categoryId || null,
    projectId: input.projectId || null,
    title: input.title,
    description: input.description || null,
    timeframe: input.timeframe || null,
    targetDate: input.targetDate || null,
    status: input.status,
    progressPercentage: 0,
    color: input.color || '#8b5cf6',
    icon: input.icon || 'target',
    notes: input.notes || null,
    createdAt: now,
    updatedAt: now,
  });

  const createdMilestones: GoalMilestoneData[] = [];

  if (input.milestones && input.milestones.length > 0) {
    for (const m of input.milestones) {
      const milestoneId = `mls_${crypto.randomUUID()}`;
      await db.insert(goalMilestones).values({
        id: milestoneId,
        userId: user.id,
        goalId,
        title: m.title,
        targetValue: m.targetValue ?? 100,
        currentValue: m.currentValue ?? 0,
        unit: m.unit || '%',
        isCompleted: 0,
        dueDate: m.dueDate || null,
        sortOrder: m.sortOrder ?? 0,
        createdAt: now,
        updatedAt: now,
      });

      createdMilestones.push({
        id: milestoneId,
        userId: user.id,
        goalId,
        title: m.title,
        targetValue: m.targetValue ?? 100,
        currentValue: m.currentValue ?? 0,
        unit: m.unit || '%',
        isCompleted: false,
        dueDate: m.dueDate || null,
        sortOrder: m.sortOrder ?? 0,
        createdAt: now.getTime(),
        updatedAt: now.getTime(),
      });
    }
  }

  const data: GoalData = {
    id: goalId,
    userId: user.id,
    categoryId: input.categoryId || null,
    projectId: input.projectId || null,
    title: input.title,
    description: input.description || null,
    timeframe: input.timeframe || null,
    targetDate: input.targetDate || null,
    status: input.status,
    progressPercentage: 0,
    color: input.color || '#8b5cf6',
    icon: input.icon || 'target',
    notes: input.notes || null,
    milestoneCount: createdMilestones.length,
    completedMilestoneCount: 0,
    milestones: createdMilestones,
    createdAt: now.getTime(),
    updatedAt: now.getTime(),
  };

  return c.json<ApiSuccessResponse<GoalData>>({ success: true, data }, 201);
});

/**
 * GET /api/goals/:id
 * Retrieve goal detail with milestones, linked tasks, and progress logs.
 */
goalsRouter.get('/:id', async (c) => {
  const user = c.get('user');
  const db = createDb(c.env.DB);
  const id = c.req.param('id');

  const goal = (
    await db
      .select()
      .from(goals)
      .where(and(eq(goals.id, id), eq(goals.userId, user.id)))
      .limit(1)
  )[0];

  if (!goal) {
    return c.json({ success: false, error: { code: 'NOT_FOUND', message: 'Goal not found' } }, 404);
  }

  const milestoneRows = await db
    .select()
    .from(goalMilestones)
    .where(and(eq(goalMilestones.goalId, id), eq(goalMilestones.userId, user.id)))
    .orderBy(goalMilestones.sortOrder, goalMilestones.createdAt);

  const milestones: GoalMilestoneData[] = milestoneRows.map((m) => ({
    id: m.id,
    userId: m.userId,
    goalId: m.goalId,
    title: m.title,
    targetValue: m.targetValue,
    currentValue: m.currentValue,
    unit: m.unit,
    isCompleted: Boolean(m.isCompleted),
    dueDate: m.dueDate,
    sortOrder: m.sortOrder,
    createdAt: m.createdAt.getTime(),
    updatedAt: m.updatedAt.getTime(),
  }));

  const linkRows = await db
    .select({
      link: goalTaskLinks,
      taskTitle: tasks.title,
      taskStatus: tasks.status,
      taskPriority: tasks.priority,
    })
    .from(goalTaskLinks)
    .leftJoin(tasks, eq(goalTaskLinks.taskId, tasks.id))
    .where(and(eq(goalTaskLinks.goalId, id), eq(goalTaskLinks.userId, user.id)));

  const linkedTasks: GoalTaskLinkData[] = linkRows.map(({ link, taskTitle, taskStatus, taskPriority }) => ({
    id: link.id,
    userId: link.userId,
    goalId: link.goalId,
    taskId: link.taskId,
    milestoneId: link.milestoneId,
    taskTitle: taskTitle || 'Unknown Task',
    taskStatus: taskStatus || 'not_started',
    taskPriority: taskPriority || 'medium',
    createdAt: link.createdAt.getTime(),
  }));

  const logRows = await db
    .select()
    .from(goalProgressLogs)
    .where(and(eq(goalProgressLogs.goalId, id), eq(goalProgressLogs.userId, user.id)))
    .orderBy(desc(goalProgressLogs.createdAt))
    .limit(20);

  const progressLogs: GoalProgressLogData[] = logRows.map((l) => ({
    id: l.id,
    userId: l.userId,
    goalId: l.goalId,
    milestoneId: l.milestoneId,
    previousProgress: l.previousProgress,
    newProgress: l.newProgress,
    changeDelta: l.changeDelta,
    notes: l.notes,
    loggedAt: l.loggedAt,
    createdAt: l.createdAt.getTime(),
  }));

  const data: GoalData = {
    id: goal.id,
    userId: goal.userId,
    categoryId: goal.categoryId,
    projectId: goal.projectId,
    title: goal.title,
    description: goal.description,
    timeframe: (goal.timeframe as GoalTimeframe) || null,
    targetDate: goal.targetDate,
    status: goal.status as GoalStatus,
    progressPercentage: goal.progressPercentage,
    color: goal.color,
    icon: goal.icon,
    notes: goal.notes,
    milestoneCount: milestones.length,
    completedMilestoneCount: milestones.filter((m) => m.isCompleted).length,
    milestones,
    linkedTasks,
    progressLogs,
    createdAt: goal.createdAt.getTime(),
    updatedAt: goal.updatedAt.getTime(),
  };

  return c.json<ApiSuccessResponse<GoalData>>({ success: true, data });
});

/**
 * PATCH /api/goals/:id
 */
goalsRouter.patch('/:id', zValidator('json', goalUpdateSchema), async (c) => {
  const user = c.get('user');
  const db = createDb(c.env.DB);
  const id = c.req.param('id');
  const input = c.req.valid('json');

  const existing = (
    await db
      .select()
      .from(goals)
      .where(and(eq(goals.id, id), eq(goals.userId, user.id)))
      .limit(1)
  )[0];

  if (!existing) {
    return c.json({ success: false, error: { code: 'NOT_FOUND', message: 'Goal not found' } }, 404);
  }

  const now = new Date();
  const updateData: Partial<typeof goals.$inferInsert> = {
    updatedAt: now,
  };

  if (input.title !== undefined) updateData.title = input.title;
  if (input.description !== undefined) updateData.description = input.description;
  if (input.timeframe !== undefined) updateData.timeframe = input.timeframe;
  if (input.categoryId !== undefined) updateData.categoryId = input.categoryId;
  if (input.projectId !== undefined) updateData.projectId = input.projectId;
  if (input.targetDate !== undefined) updateData.targetDate = input.targetDate;
  if (input.status !== undefined) updateData.status = input.status;
  if (input.progressPercentage !== undefined) updateData.progressPercentage = input.progressPercentage;
  if (input.color !== undefined) updateData.color = input.color;
  if (input.icon !== undefined) updateData.icon = input.icon;
  if (input.notes !== undefined) updateData.notes = input.notes;

  await db.update(goals).set(updateData).where(eq(goals.id, id));

  const updated = (await db.select().from(goals).where(eq(goals.id, id)).limit(1))[0];

  const data: GoalData = {
    id: updated.id,
    userId: updated.userId,
    categoryId: updated.categoryId,
    projectId: updated.projectId,
    title: updated.title,
    description: updated.description,
    timeframe: (updated.timeframe as GoalTimeframe) || null,
    targetDate: updated.targetDate,
    status: updated.status as GoalStatus,
    progressPercentage: updated.progressPercentage,
    color: updated.color,
    icon: updated.icon,
    notes: updated.notes,
    createdAt: updated.createdAt.getTime(),
    updatedAt: updated.updatedAt.getTime(),
  };

  return c.json<ApiSuccessResponse<GoalData>>({ success: true, data });
});

/**
 * DELETE /api/goals/:id
 */
goalsRouter.delete('/:id', async (c) => {
  const user = c.get('user');
  const db = createDb(c.env.DB);
  const id = c.req.param('id');

  const existing = (
    await db
      .select({ id: goals.id })
      .from(goals)
      .where(and(eq(goals.id, id), eq(goals.userId, user.id)))
      .limit(1)
  )[0];

  if (!existing) {
    return c.json({ success: false, error: { code: 'NOT_FOUND', message: 'Goal not found' } }, 404);
  }

  await db.delete(goals).where(eq(goals.id, id));

  return c.json<ApiSuccessResponse<{ id: string }>>({ success: true, data: { id } });
});

/**
 * POST /api/goals/:id/milestones
 * Add milestone to goal.
 */
goalsRouter.post(
  '/:id/milestones',
  zValidator('json', goalMilestoneCreateSchema),
  async (c) => {
    const user = c.get('user');
    const db = createDb(c.env.DB);
    const goalId = c.req.param('id');
    const input = c.req.valid('json');

    const goal = (
      await db
        .select({ id: goals.id })
        .from(goals)
        .where(and(eq(goals.id, goalId), eq(goals.userId, user.id)))
        .limit(1)
    )[0];

    if (!goal) {
      return c.json({ success: false, error: { code: 'NOT_FOUND', message: 'Goal not found' } }, 404);
    }

    const milestoneId = `mls_${crypto.randomUUID()}`;
    const now = new Date();

    await db.insert(goalMilestones).values({
      id: milestoneId,
      userId: user.id,
      goalId,
      title: input.title,
      targetValue: input.targetValue ?? 100,
      currentValue: input.currentValue ?? 0,
      unit: input.unit || '%',
      isCompleted: 0,
      dueDate: input.dueDate || null,
      sortOrder: input.sortOrder ?? 0,
      createdAt: now,
      updatedAt: now,
    });

    await syncAndLogGoalProgress(db, user.id, goalId, milestoneId, `Milestone created: ${input.title}`);

    const data: GoalMilestoneData = {
      id: milestoneId,
      userId: user.id,
      goalId,
      title: input.title,
      targetValue: input.targetValue ?? 100,
      currentValue: input.currentValue ?? 0,
      unit: input.unit || '%',
      isCompleted: false,
      dueDate: input.dueDate || null,
      sortOrder: input.sortOrder ?? 0,
      createdAt: now.getTime(),
      updatedAt: now.getTime(),
    };

    return c.json<ApiSuccessResponse<GoalMilestoneData>>({ success: true, data }, 201);
  }
);

/**
 * PATCH /api/goals/milestones/:milestoneId
 */
goalsRouter.patch(
  '/milestones/:milestoneId',
  zValidator('json', goalMilestoneUpdateSchema),
  async (c) => {
    const user = c.get('user');
    const db = createDb(c.env.DB);
    const milestoneId = c.req.param('milestoneId');
    const input = c.req.valid('json');

    const existing = (
      await db
        .select()
        .from(goalMilestones)
        .where(and(eq(goalMilestones.id, milestoneId), eq(goalMilestones.userId, user.id)))
        .limit(1)
    )[0];

    if (!existing) {
      return c.json(
        { success: false, error: { code: 'NOT_FOUND', message: 'Milestone not found' } },
        404
      );
    }

    const now = new Date();
    const updateData: Partial<typeof goalMilestones.$inferInsert> = {
      updatedAt: now,
    };

    if (input.title !== undefined) updateData.title = input.title;
    if (input.targetValue !== undefined) updateData.targetValue = input.targetValue;
    if (input.currentValue !== undefined) updateData.currentValue = input.currentValue;
    if (input.unit !== undefined) updateData.unit = input.unit;
    if (input.isCompleted !== undefined) updateData.isCompleted = input.isCompleted ? 1 : 0;
    if (input.dueDate !== undefined) updateData.dueDate = input.dueDate;
    if (input.sortOrder !== undefined) updateData.sortOrder = input.sortOrder;

    await db.update(goalMilestones).set(updateData).where(eq(goalMilestones.id, milestoneId));

    await syncAndLogGoalProgress(db, user.id, existing.goalId, milestoneId, `Milestone updated: ${existing.title}`);

    const updated = (
      await db.select().from(goalMilestones).where(eq(goalMilestones.id, milestoneId)).limit(1)
    )[0];

    const data: GoalMilestoneData = {
      id: updated.id,
      userId: updated.userId,
      goalId: updated.goalId,
      title: updated.title,
      targetValue: updated.targetValue,
      currentValue: updated.currentValue,
      unit: updated.unit,
      isCompleted: Boolean(updated.isCompleted),
      dueDate: updated.dueDate,
      sortOrder: updated.sortOrder,
      createdAt: updated.createdAt.getTime(),
      updatedAt: updated.updatedAt.getTime(),
    };

    return c.json<ApiSuccessResponse<GoalMilestoneData>>({ success: true, data });
  }
);

/**
 * DELETE /api/goals/milestones/:milestoneId
 */
goalsRouter.delete('/milestones/:milestoneId', async (c) => {
  const user = c.get('user');
  const db = createDb(c.env.DB);
  const milestoneId = c.req.param('milestoneId');

  const existing = (
    await db
      .select({ id: goalMilestones.id, goalId: goalMilestones.goalId, title: goalMilestones.title })
      .from(goalMilestones)
      .where(and(eq(goalMilestones.id, milestoneId), eq(goalMilestones.userId, user.id)))
      .limit(1)
  )[0];

  if (!existing) {
    return c.json(
      { success: false, error: { code: 'NOT_FOUND', message: 'Milestone not found' } },
      404
    );
  }

  await db.delete(goalMilestones).where(eq(goalMilestones.id, milestoneId));

  await syncAndLogGoalProgress(db, user.id, existing.goalId, null, `Milestone deleted: ${existing.title}`);

  return c.json<ApiSuccessResponse<{ id: string }>>({ success: true, data: { id: milestoneId } });
});

/**
 * POST /api/goals/:id/tasks
 * Link a task to a goal
 */
goalsRouter.post('/:id/tasks', zValidator('json', goalTaskLinkCreateSchema), async (c) => {
  const user = c.get('user');
  const db = createDb(c.env.DB);
  const goalId = c.req.param('id');
  const { taskId, milestoneId } = c.req.valid('json');

  const [goal] = await db
    .select({ id: goals.id })
    .from(goals)
    .where(and(eq(goals.id, goalId), eq(goals.userId, user.id)));

  if (!goal) {
    return c.json({ success: false, error: { code: 'NOT_FOUND', message: 'Goal not found' } }, 404);
  }

  const [task] = await db
    .select({ id: tasks.id, title: tasks.title, status: tasks.status, priority: tasks.priority })
    .from(tasks)
    .where(and(eq(tasks.id, taskId), eq(tasks.userId, user.id)));

  if (!task) {
    return c.json({ success: false, error: { code: 'NOT_FOUND', message: 'Task not found' } }, 404);
  }

  const linkId = `gtl_${crypto.randomUUID()}`;
  const now = new Date();

  await db.insert(goalTaskLinks).values({
    id: linkId,
    userId: user.id,
    goalId,
    taskId,
    milestoneId: milestoneId || null,
    createdAt: now,
  });

  const data: GoalTaskLinkData = {
    id: linkId,
    userId: user.id,
    goalId,
    taskId,
    milestoneId: milestoneId || null,
    taskTitle: task.title,
    taskStatus: task.status,
    taskPriority: task.priority,
    createdAt: now.getTime(),
  };

  return c.json<ApiSuccessResponse<GoalTaskLinkData>>({ success: true, data }, 201);
});

/**
 * DELETE /api/goals/:id/tasks/:linkId
 * Unlink a task from a goal
 */
goalsRouter.delete('/:id/tasks/:linkId', async (c) => {
  const user = c.get('user');
  const db = createDb(c.env.DB);
  const linkId = c.req.param('linkId');

  const [existing] = await db
    .select()
    .from(goalTaskLinks)
    .where(and(eq(goalTaskLinks.id, linkId), eq(goalTaskLinks.userId, user.id)));

  if (!existing) {
    return c.json({ success: false, error: { code: 'NOT_FOUND', message: 'Goal task link not found' } }, 404);
  }

  await db.delete(goalTaskLinks).where(eq(goalTaskLinks.id, linkId));

  return c.json<ApiSuccessResponse<{ id: string }>>({ success: true, data: { id: linkId } });
});

/**
 * GET /api/goals/:id/progress-logs
 */
goalsRouter.get('/:id/progress-logs', async (c) => {
  const user = c.get('user');
  const db = createDb(c.env.DB);
  const goalId = c.req.param('id');

  const rows = await db
    .select()
    .from(goalProgressLogs)
    .where(and(eq(goalProgressLogs.goalId, goalId), eq(goalProgressLogs.userId, user.id)))
    .orderBy(desc(goalProgressLogs.createdAt));

  const data: GoalProgressLogData[] = rows.map((r) => ({
    id: r.id,
    userId: r.userId,
    goalId: r.goalId,
    milestoneId: r.milestoneId,
    previousProgress: r.previousProgress,
    newProgress: r.newProgress,
    changeDelta: r.changeDelta,
    notes: r.notes,
    loggedAt: r.loggedAt,
    createdAt: r.createdAt.getTime(),
  }));

  return c.json<ApiSuccessResponse<GoalProgressLogData[]>>({ success: true, data });
});

/**
 * POST /api/goals/:id/progress-logs
 * Manually record a progress log and update goal progress percentage
 */
goalsRouter.post('/:id/progress-logs', zValidator('json', goalProgressLogCreateSchema), async (c) => {
  const user = c.get('user');
  const db = createDb(c.env.DB);
  const goalId = c.req.param('id');
  const input = c.req.valid('json');

  const [goal] = await db
    .select()
    .from(goals)
    .where(and(eq(goals.id, goalId), eq(goals.userId, user.id)));

  if (!goal) {
    return c.json({ success: false, error: { code: 'NOT_FOUND', message: 'Goal not found' } }, 404);
  }

  const previousProgress = goal.progressPercentage;
  const newProgress = input.newProgress;
  const today = input.loggedAt || new Date().toISOString().split('T')[0];
  const now = new Date();

  await db
    .update(goals)
    .set({
      progressPercentage: newProgress,
      status: newProgress >= 100 ? 'completed' : newProgress > 0 ? 'in_progress' : 'not_started',
      updatedAt: now,
    })
    .where(eq(goals.id, goalId));

  const logId = `gpl_${crypto.randomUUID()}`;
  await db.insert(goalProgressLogs).values({
    id: logId,
    userId: user.id,
    goalId,
    milestoneId: input.milestoneId || null,
    previousProgress,
    newProgress,
    changeDelta: newProgress - previousProgress,
    notes: input.notes || null,
    loggedAt: today,
    createdAt: now,
  });

  const data: GoalProgressLogData = {
    id: logId,
    userId: user.id,
    goalId,
    milestoneId: input.milestoneId || null,
    previousProgress,
    newProgress,
    changeDelta: newProgress - previousProgress,
    notes: input.notes || null,
    loggedAt: today,
    createdAt: now.getTime(),
  };

  return c.json<ApiSuccessResponse<GoalProgressLogData>>({ success: true, data }, 201);
});
