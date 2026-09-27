import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import { eq, and } from 'drizzle-orm';
import { z } from 'zod';
import { createDb } from '../db/client';
import { habits, habitLogs, userPreferences } from '../db/schema';
import { requireAuth } from '../middleware/auth';
import {
  habitCreateSchema,
  habitUpdateSchema,
  habitLogUpsertSchema,
} from '../../shared/schemas/trackers';
import { getTodayCalendarDate, isValidCalendarDate } from '../../shared/utils/date';
import { calculateHabitStats } from '../services/habitStreakService';
import type {
  ApiSuccessResponse,
  HabitData,
  HabitLogData,
  HabitStreakStats,
  HabitFrequency,
} from '../../shared/types';
import type { AppBindings } from '../index';

export const habitsRouter = new Hono<{ Bindings: AppBindings }>();

habitsRouter.use('*', requireAuth);

/**
 * GET /api/habits
 * List habits with current streak and today's completion status.
 */
habitsRouter.get(
  '/',
  zValidator(
    'query',
    z.object({
      archived: z
        .enum(['true', 'false'])
        .optional()
        .transform((v) => v === 'true'),
    })
  ),
  async (c) => {
    const user = c.get('user');
    const db = createDb(c.env.DB);
    const { archived } = c.req.valid('query');

    const prefs = (
      await db
        .select({ timezone: userPreferences.timezone })
        .from(userPreferences)
        .where(eq(userPreferences.userId, user.id))
        .limit(1)
    )[0];
    const today = getTodayCalendarDate(prefs?.timezone || 'UTC');

    const conditions = [
      eq(habits.userId, user.id),
      eq(habits.archived, archived ? 1 : 0),
    ];

    const habitRows = await db
      .select()
      .from(habits)
      .where(and(...conditions))
      .orderBy(habits.sortOrder, habits.createdAt);

    const data: HabitData[] = [];

    for (const h of habitRows) {
      // Fetch recent logs to calculate streak
      const logs = await db
        .select({ date: habitLogs.date, completed: habitLogs.completed })
        .from(habitLogs)
        .where(and(eq(habitLogs.habitId, h.id), eq(habitLogs.userId, user.id)));

      const stats = calculateHabitStats(
        {
          id: h.id,
          frequencyType: h.frequencyType,
          targetDaysPerWeek: h.targetDaysPerWeek,
          targetDaysOfWeek: h.targetDaysOfWeek,
        },
        logs,
        today,
        30
      );

      const completedToday = logs.some((l) => l.date === today && Boolean(l.completed));

      data.push({
        id: h.id,
        userId: h.userId,
        categoryId: h.categoryId,
        name: h.name,
        description: h.description,
        frequencyType: h.frequencyType as HabitFrequency,
        targetDaysPerWeek: h.targetDaysPerWeek,
        targetDaysOfWeek: h.targetDaysOfWeek ? JSON.parse(h.targetDaysOfWeek) : null,
        color: h.color,
        icon: h.icon,
        archived: Boolean(h.archived),
        sortOrder: h.sortOrder,
        currentStreak: stats.currentStreak,
        longestStreak: stats.longestStreak,
        completionRate30d: stats.completionRate30d,
        completedToday,
        createdAt: h.createdAt.getTime(),
        updatedAt: h.updatedAt.getTime(),
      });
    }

    return c.json<ApiSuccessResponse<HabitData[]>>({ success: true, data });
  }
);

/**
 * POST /api/habits
 * Create new habit.
 */
habitsRouter.post('/', zValidator('json', habitCreateSchema), async (c) => {
  const user = c.get('user');
  const db = createDb(c.env.DB);
  const input = c.req.valid('json');

  const id = `hab_${crypto.randomUUID()}`;
  const now = new Date();

  await db.insert(habits).values({
    id,
    userId: user.id,
    categoryId: input.categoryId || null,
    name: input.name,
    description: input.description || null,
    frequencyType: input.frequencyType,
    targetDaysPerWeek: input.targetDaysPerWeek,
    targetDaysOfWeek: input.targetDaysOfWeek ? JSON.stringify(input.targetDaysOfWeek) : null,
    color: input.color || '#10b981',
    icon: input.icon || 'check-circle',
    archived: 0,
    sortOrder: input.sortOrder ?? 0,
    createdAt: now,
    updatedAt: now,
  });

  const created: HabitData = {
    id,
    userId: user.id,
    categoryId: input.categoryId || null,
    name: input.name,
    description: input.description || null,
    frequencyType: input.frequencyType as HabitFrequency,
    targetDaysPerWeek: input.targetDaysPerWeek,
    targetDaysOfWeek: input.targetDaysOfWeek ?? null,
    color: input.color || '#10b981',
    icon: input.icon || 'check-circle',
    archived: false,
    sortOrder: input.sortOrder ?? 0,
    currentStreak: 0,
    longestStreak: 0,
    completionRate30d: 0,
    completedToday: false,
    createdAt: now.getTime(),
    updatedAt: now.getTime(),
  };

  return c.json<ApiSuccessResponse<HabitData>>({ success: true, data: created }, 201);
});

/**
 * GET /api/habits/:id
 * Detailed habit with 90-day heatmap and streak metrics.
 */
habitsRouter.get('/:id', async (c) => {
  const user = c.get('user');
  const db = createDb(c.env.DB);
  const id = c.req.param('id');

  const habit = (
    await db
      .select()
      .from(habits)
      .where(and(eq(habits.id, id), eq(habits.userId, user.id)))
      .limit(1)
  )[0];

  if (!habit) {
    return c.json({ success: false, error: { code: 'NOT_FOUND', message: 'Habit not found' } }, 404);
  }

  const prefs = (
    await db
      .select({ timezone: userPreferences.timezone })
      .from(userPreferences)
      .where(eq(userPreferences.userId, user.id))
      .limit(1)
  )[0];
  const today = getTodayCalendarDate(prefs?.timezone || 'UTC');

  const logs = await db
    .select({ date: habitLogs.date, completed: habitLogs.completed })
    .from(habitLogs)
    .where(and(eq(habitLogs.habitId, id), eq(habitLogs.userId, user.id)));

  const stats = calculateHabitStats(
    {
      id: habit.id,
      frequencyType: habit.frequencyType,
      targetDaysPerWeek: habit.targetDaysPerWeek,
      targetDaysOfWeek: habit.targetDaysOfWeek,
    },
    logs,
    today,
    90
  );

  const completedToday = logs.some((l) => l.date === today && Boolean(l.completed));

  const data: HabitData & { stats: HabitStreakStats } = {
    id: habit.id,
    userId: habit.userId,
    categoryId: habit.categoryId,
    name: habit.name,
    description: habit.description,
    frequencyType: habit.frequencyType as HabitFrequency,
    targetDaysPerWeek: habit.targetDaysPerWeek,
    targetDaysOfWeek: habit.targetDaysOfWeek ? JSON.parse(habit.targetDaysOfWeek) : null,
    color: habit.color,
    icon: habit.icon,
    archived: Boolean(habit.archived),
    sortOrder: habit.sortOrder,
    currentStreak: stats.currentStreak,
    longestStreak: stats.longestStreak,
    completionRate30d: stats.completionRate30d,
    completedToday,
    stats,
    createdAt: habit.createdAt.getTime(),
    updatedAt: habit.updatedAt.getTime(),
  };

  return c.json<ApiSuccessResponse<typeof data>>({ success: true, data });
});

/**
 * PATCH /api/habits/:id
 * Update habit.
 */
habitsRouter.patch('/:id', zValidator('json', habitUpdateSchema), async (c) => {
  const user = c.get('user');
  const db = createDb(c.env.DB);
  const id = c.req.param('id');
  const input = c.req.valid('json');

  const existing = (
    await db
      .select()
      .from(habits)
      .where(and(eq(habits.id, id), eq(habits.userId, user.id)))
      .limit(1)
  )[0];

  if (!existing) {
    return c.json({ success: false, error: { code: 'NOT_FOUND', message: 'Habit not found' } }, 404);
  }

  const now = new Date();
  const updateData: Partial<typeof habits.$inferInsert> = {
    updatedAt: now,
  };

  if (input.name !== undefined) updateData.name = input.name;
  if (input.description !== undefined) updateData.description = input.description;
  if (input.categoryId !== undefined) updateData.categoryId = input.categoryId;
  if (input.frequencyType !== undefined) updateData.frequencyType = input.frequencyType;
  if (input.targetDaysPerWeek !== undefined) updateData.targetDaysPerWeek = input.targetDaysPerWeek;
  if (input.targetDaysOfWeek !== undefined) {
    updateData.targetDaysOfWeek = input.targetDaysOfWeek ? JSON.stringify(input.targetDaysOfWeek) : null;
  }
  if (input.color !== undefined) updateData.color = input.color;
  if (input.icon !== undefined) updateData.icon = input.icon;
  if (input.archived !== undefined) updateData.archived = input.archived ? 1 : 0;
  if (input.sortOrder !== undefined) updateData.sortOrder = input.sortOrder;

  await db.update(habits).set(updateData).where(eq(habits.id, id));

  const updated = (await db.select().from(habits).where(eq(habits.id, id)).limit(1))[0];

  const data: HabitData = {
    id: updated.id,
    userId: updated.userId,
    categoryId: updated.categoryId,
    name: updated.name,
    description: updated.description,
    frequencyType: updated.frequencyType as HabitFrequency,
    targetDaysPerWeek: updated.targetDaysPerWeek,
    targetDaysOfWeek: updated.targetDaysOfWeek ? JSON.parse(updated.targetDaysOfWeek) : null,
    color: updated.color,
    icon: updated.icon,
    archived: Boolean(updated.archived),
    sortOrder: updated.sortOrder,
    createdAt: updated.createdAt.getTime(),
    updatedAt: updated.updatedAt.getTime(),
  };

  return c.json<ApiSuccessResponse<HabitData>>({ success: true, data });
});

/**
 * DELETE /api/habits/:id
 */
habitsRouter.delete('/:id', async (c) => {
  const user = c.get('user');
  const db = createDb(c.env.DB);
  const id = c.req.param('id');

  const existing = (
    await db
      .select({ id: habits.id })
      .from(habits)
      .where(and(eq(habits.id, id), eq(habits.userId, user.id)))
      .limit(1)
  )[0];

  if (!existing) {
    return c.json({ success: false, error: { code: 'NOT_FOUND', message: 'Habit not found' } }, 404);
  }

  await db.delete(habits).where(eq(habits.id, id));

  return c.json<ApiSuccessResponse<{ id: string }>>({ success: true, data: { id } });
});

/**
 * PUT /api/habits/:id/logs/:date
 * Log or toggle habit completion for a specific calendar date.
 */
habitsRouter.put('/:id/logs/:date', zValidator('json', habitLogUpsertSchema), async (c) => {
  const user = c.get('user');
  const db = createDb(c.env.DB);
  const habitId = c.req.param('id');
  const date = c.req.param('date');
  const input = c.req.valid('json');

  if (!isValidCalendarDate(date)) {
    return c.json(
      { success: false, error: { code: 'BAD_REQUEST', message: 'Invalid date format. Must be YYYY-MM-DD' } },
      400
    );
  }

  const habit = (
    await db
      .select({ id: habits.id })
      .from(habits)
      .where(and(eq(habits.id, habitId), eq(habits.userId, user.id)))
      .limit(1)
  )[0];

  if (!habit) {
    return c.json({ success: false, error: { code: 'NOT_FOUND', message: 'Habit not found' } }, 404);
  }

  const existing = (
    await db
      .select()
      .from(habitLogs)
      .where(
        and(
          eq(habitLogs.userId, user.id),
          eq(habitLogs.habitId, habitId),
          eq(habitLogs.date, date)
        )
      )
      .limit(1)
  )[0];

  const now = new Date();
  let logId: string;

  if (existing) {
    logId = existing.id;
    await db
      .update(habitLogs)
      .set({
        completed: input.completed ? 1 : 0,
        notes: input.notes !== undefined ? input.notes : existing.notes,
      })
      .where(eq(habitLogs.id, logId));
  } else {
    logId = `hlg_${crypto.randomUUID()}`;
    await db.insert(habitLogs).values({
      id: logId,
      userId: user.id,
      habitId,
      date,
      completed: input.completed ? 1 : 0,
      notes: input.notes || null,
      createdAt: now,
    });
  }

  const saved = (await db.select().from(habitLogs).where(eq(habitLogs.id, logId)).limit(1))[0];

  const data: HabitLogData = {
    id: saved.id,
    userId: saved.userId,
    habitId: saved.habitId,
    date: saved.date,
    completed: Boolean(saved.completed),
    notes: saved.notes,
    createdAt: saved.createdAt.getTime(),
  };

  return c.json<ApiSuccessResponse<HabitLogData>>({ success: true, data });
});

/**
 * DELETE /api/habits/:id/logs/:date
 * Remove completion record for a specific date.
 */
habitsRouter.delete('/:id/logs/:date', async (c) => {
  const user = c.get('user');
  const db = createDb(c.env.DB);
  const habitId = c.req.param('id');
  const date = c.req.param('date');

  await db
    .delete(habitLogs)
    .where(
      and(
        eq(habitLogs.userId, user.id),
        eq(habitLogs.habitId, habitId),
        eq(habitLogs.date, date)
      )
    );

  return c.json<ApiSuccessResponse<{ habitId: string; date: string }>>({
    success: true,
    data: { habitId, date },
  });
});
