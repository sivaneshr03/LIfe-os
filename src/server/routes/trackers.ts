import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import { eq, and, sql, desc } from 'drizzle-orm';
import { z } from 'zod';
import { createDb } from '../db/client';
import { trackers, trackerEntries } from '../db/schema';
import { requireAuth } from '../middleware/auth';
import {
  trackerCreateSchema,
  trackerUpdateSchema,
  trackerEntryCreateSchema,
  trackerEntryUpdateSchema,
} from '../../shared/schemas/trackers';
import { isValidCalendarDate, shiftCalendarDate } from '../../shared/utils/date';
import type {
  ApiSuccessResponse,
  TrackerData,
  TrackerEntryData,
  TrackerStatsData,
  TrackerType,
  TrackerPeriod,
} from '../../shared/types';
import type { AppBindings } from '../index';

export const trackersRouter = new Hono<{ Bindings: AppBindings }>();

trackersRouter.use('*', requireAuth);

/**
 * GET /api/trackers
 * List trackers with latest logged value and entry count.
 */
trackersRouter.get(
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

    const conditions = [
      eq(trackers.userId, user.id),
      eq(trackers.archived, archived ? 1 : 0),
    ];

    const rows = await db
      .select({
        tracker: trackers,
        entryCount: sql<number>`(SELECT count(*) FROM tracker_entries WHERE tracker_entries.tracker_id = trackers.id)`,
        latestValue: sql<number>`(SELECT value FROM tracker_entries WHERE tracker_entries.tracker_id = trackers.id ORDER BY date DESC, timestamp_ms DESC LIMIT 1)`,
        latestTextValue: sql<string>`(SELECT text_value FROM tracker_entries WHERE tracker_entries.tracker_id = trackers.id ORDER BY date DESC, timestamp_ms DESC LIMIT 1)`,
        latestDate: sql<string>`(SELECT date FROM tracker_entries WHERE tracker_entries.tracker_id = trackers.id ORDER BY date DESC, timestamp_ms DESC LIMIT 1)`,
      })
      .from(trackers)
      .where(and(...conditions))
      .orderBy(trackers.sortOrder, trackers.createdAt);

    const data: TrackerData[] = rows.map(({ tracker, entryCount, latestValue, latestTextValue, latestDate }) => ({
      id: tracker.id,
      userId: tracker.userId,
      categoryId: tracker.categoryId,
      name: tracker.name,
      description: tracker.description,
      type: tracker.type as TrackerType,
      unit: tracker.unit,
      targetValue: tracker.targetValue,
      targetPeriod: tracker.targetPeriod as TrackerPeriod | null,
      color: tracker.color,
      icon: tracker.icon,
      archived: Boolean(tracker.archived),
      sortOrder: tracker.sortOrder,
      latestValue: latestValue !== null && latestValue !== undefined ? Number(latestValue) : null,
      latestTextValue: latestTextValue || null,
      latestDate: latestDate || null,
      entryCount: Number(entryCount || 0),
      createdAt: tracker.createdAt.getTime(),
      updatedAt: tracker.updatedAt.getTime(),
    }));

    return c.json<ApiSuccessResponse<TrackerData[]>>({ success: true, data });
  }
);

/**
 * POST /api/trackers
 * Create a new metric tracker.
 */
trackersRouter.post('/', zValidator('json', trackerCreateSchema), async (c) => {
  const user = c.get('user');
  const db = createDb(c.env.DB);
  const input = c.req.valid('json');

  const id = `trk_${crypto.randomUUID()}`;
  const now = new Date();

  await db.insert(trackers).values({
    id,
    userId: user.id,
    categoryId: input.categoryId || null,
    name: input.name,
    description: input.description || null,
    type: input.type,
    unit: input.unit || null,
    targetValue: input.targetValue || null,
    targetPeriod: input.targetPeriod || null,
    color: input.color || '#3b82f6',
    icon: input.icon || 'activity',
    archived: 0,
    sortOrder: input.sortOrder ?? 0,
    createdAt: now,
    updatedAt: now,
  });

  const created: TrackerData = {
    id,
    userId: user.id,
    categoryId: input.categoryId || null,
    name: input.name,
    description: input.description || null,
    type: input.type as TrackerType,
    unit: input.unit || null,
    targetValue: input.targetValue || null,
    targetPeriod: input.targetPeriod as TrackerPeriod | null,
    color: input.color || '#3b82f6',
    icon: input.icon || 'activity',
    archived: false,
    sortOrder: input.sortOrder ?? 0,
    latestValue: null,
    latestTextValue: null,
    latestDate: null,
    entryCount: 0,
    createdAt: now.getTime(),
    updatedAt: now.getTime(),
  };

  return c.json<ApiSuccessResponse<TrackerData>>({ success: true, data: created }, 201);
});

/**
 * GET /api/trackers/:id
 * Retrieve tracker with recent logged data points.
 */
trackersRouter.get('/:id', async (c) => {
  const user = c.get('user');
  const db = createDb(c.env.DB);
  const id = c.req.param('id');

  const tracker = (
    await db
      .select()
      .from(trackers)
      .where(and(eq(trackers.id, id), eq(trackers.userId, user.id)))
      .limit(1)
  )[0];

  if (!tracker) {
    return c.json({ success: false, error: { code: 'NOT_FOUND', message: 'Tracker not found' } }, 404);
  }

  const entries = await db
    .select()
    .from(trackerEntries)
    .where(and(eq(trackerEntries.trackerId, id), eq(trackerEntries.userId, user.id)))
    .orderBy(desc(trackerEntries.date), desc(trackerEntries.timestampMs))
    .limit(100);

  const entryData: TrackerEntryData[] = entries.map((e) => ({
    id: e.id,
    userId: e.userId,
    trackerId: e.trackerId,
    date: e.date,
    timestampMs: e.timestampMs.getTime(),
    value: e.value,
    textValue: e.textValue || null,
    notes: e.notes,
    createdAt: e.createdAt.getTime(),
  }));

  const data: TrackerData & { entries: TrackerEntryData[] } = {
    id: tracker.id,
    userId: tracker.userId,
    categoryId: tracker.categoryId,
    name: tracker.name,
    description: tracker.description,
    type: tracker.type as TrackerType,
    unit: tracker.unit,
    targetValue: tracker.targetValue,
    targetPeriod: tracker.targetPeriod as TrackerPeriod | null,
    color: tracker.color,
    icon: tracker.icon,
    archived: Boolean(tracker.archived),
    sortOrder: tracker.sortOrder,
    latestValue: entryData[0]?.value ?? null,
    latestTextValue: entryData[0]?.textValue ?? null,
    latestDate: entryData[0]?.date ?? null,
    entryCount: entryData.length,
    entries: entryData,
    createdAt: tracker.createdAt.getTime(),
    updatedAt: tracker.updatedAt.getTime(),
  };

  return c.json<ApiSuccessResponse<typeof data>>({ success: true, data });
});

/**
 * GET /api/trackers/:id/stats
 * Statistics and 30-day trends for a tracker.
 */
trackersRouter.get('/:id/stats', async (c) => {
  const user = c.get('user');
  const db = createDb(c.env.DB);
  const id = c.req.param('id');

  const tracker = (
    await db
      .select({ id: trackers.id, type: trackers.type })
      .from(trackers)
      .where(and(eq(trackers.id, id), eq(trackers.userId, user.id)))
      .limit(1)
  )[0];

  if (!tracker) {
    return c.json({ success: false, error: { code: 'NOT_FOUND', message: 'Tracker not found' } }, 404);
  }

  const entries = await db
    .select()
    .from(trackerEntries)
    .where(and(eq(trackerEntries.trackerId, id), eq(trackerEntries.userId, user.id)))
    .orderBy(desc(trackerEntries.date));

  let sum = 0;
  let min: number | null = null;
  let max: number | null = null;
  const isNumericType = ['numeric', 'count', 'duration', 'rating'].includes(tracker.type);

  for (const e of entries) {
    if (isNumericType) {
      sum += e.value;
      if (min === null || e.value < min) min = e.value;
      if (max === null || e.value > max) max = e.value;
    }
  }

  const avg = entries.length > 0 && isNumericType 
    ? Math.round((sum / entries.length) * 10) / 10 
    : (isNumericType ? 0 : null);

  const today = new Date().toISOString().split('T')[0];
  const date30dAgo = shiftCalendarDate(today, -30);

  const history30d = entries
    .filter((e) => e.date >= date30dAgo)
    .map((e) => ({
      date: e.date,
      value: e.value,
      textValue: e.textValue,
    }));

  const data: TrackerStatsData = {
    trackerId: id,
    totalEntries: entries.length,
    sumValue: isNumericType ? sum : null,
    avgValue: avg,
    minValue: min !== null ? min : (isNumericType ? 0 : null),
    maxValue: max !== null ? max : (isNumericType ? 0 : null),
    history30d,
  };

  return c.json<ApiSuccessResponse<TrackerStatsData>>({ success: true, data });
});

/**
 * PATCH /api/trackers/:id
 */
trackersRouter.patch('/:id', zValidator('json', trackerUpdateSchema), async (c) => {
  const user = c.get('user');
  const db = createDb(c.env.DB);
  const id = c.req.param('id');
  const input = c.req.valid('json');

  const existing = (
    await db
      .select()
      .from(trackers)
      .where(and(eq(trackers.id, id), eq(trackers.userId, user.id)))
      .limit(1)
  )[0];

  if (!existing) {
    return c.json({ success: false, error: { code: 'NOT_FOUND', message: 'Tracker not found' } }, 404);
  }

  const now = new Date();
  const updateData: Partial<typeof trackers.$inferInsert> = {
    updatedAt: now,
  };

  if (input.name !== undefined) updateData.name = input.name;
  if (input.description !== undefined) updateData.description = input.description;
  if (input.categoryId !== undefined) updateData.categoryId = input.categoryId;
  if (input.unit !== undefined) updateData.unit = input.unit;
  if (input.targetValue !== undefined) updateData.targetValue = input.targetValue;
  if (input.targetPeriod !== undefined) updateData.targetPeriod = input.targetPeriod;
  if (input.color !== undefined) updateData.color = input.color;
  if (input.icon !== undefined) updateData.icon = input.icon;
  if (input.archived !== undefined) updateData.archived = input.archived ? 1 : 0;
  if (input.sortOrder !== undefined) updateData.sortOrder = input.sortOrder;

  await db.update(trackers).set(updateData).where(eq(trackers.id, id));

  const updated = (await db.select().from(trackers).where(eq(trackers.id, id)).limit(1))[0];

  const data: TrackerData = {
    id: updated.id,
    userId: updated.userId,
    categoryId: updated.categoryId,
    name: updated.name,
    description: updated.description,
    type: updated.type as TrackerType,
    unit: updated.unit,
    targetValue: updated.targetValue,
    targetPeriod: updated.targetPeriod as TrackerPeriod | null,
    color: updated.color,
    icon: updated.icon,
    archived: Boolean(updated.archived),
    sortOrder: updated.sortOrder,
    createdAt: updated.createdAt.getTime(),
    updatedAt: updated.updatedAt.getTime(),
  };

  return c.json<ApiSuccessResponse<TrackerData>>({ success: true, data });
});

/**
 * DELETE /api/trackers/:id
 */
trackersRouter.delete('/:id', async (c) => {
  const user = c.get('user');
  const db = createDb(c.env.DB);
  const id = c.req.param('id');

  const existing = (
    await db
      .select({ id: trackers.id })
      .from(trackers)
      .where(and(eq(trackers.id, id), eq(trackers.userId, user.id)))
      .limit(1)
  )[0];

  if (!existing) {
    return c.json({ success: false, error: { code: 'NOT_FOUND', message: 'Tracker not found' } }, 404);
  }

  await db.delete(trackers).where(eq(trackers.id, id));

  return c.json<ApiSuccessResponse<{ id: string }>>({ success: true, data: { id } });
});

/**
 * POST /api/trackers/:id/entries
 * Log a value measurement on a specific date with 1-entry-per-date upsert semantics.
 */
trackersRouter.post('/:id/entries', zValidator('json', trackerEntryCreateSchema), async (c) => {
  const user = c.get('user');
  const db = createDb(c.env.DB);
  const trackerId = c.req.param('id');
  const input = c.req.valid('json');

  if (!isValidCalendarDate(input.date)) {
    return c.json(
      { success: false, error: { code: 'BAD_REQUEST', message: 'Invalid date format. Must be YYYY-MM-DD' } },
      400
    );
  }

  const tracker = (
    await db
      .select({ id: trackers.id, type: trackers.type })
      .from(trackers)
      .where(and(eq(trackers.id, trackerId), eq(trackers.userId, user.id)))
      .limit(1)
  )[0];

  if (!tracker) {
    return c.json({ success: false, error: { code: 'NOT_FOUND', message: 'Tracker not found' } }, 404);
  }

  const now = new Date();

  // Check if an entry already exists for this tracker on this date (One primary tracker entry per tracker per date)
  const existingEntry = (
    await db
      .select()
      .from(trackerEntries)
      .where(
        and(
          eq(trackerEntries.trackerId, trackerId),
          eq(trackerEntries.userId, user.id),
          eq(trackerEntries.date, input.date)
        )
      )
      .limit(1)
  )[0];

  if (existingEntry) {
    await db
      .update(trackerEntries)
      .set({
        value: Math.round(input.value),
        textValue: input.textValue || null,
        notes: input.notes !== undefined ? input.notes : existingEntry.notes,
        timestampMs: now,
      })
      .where(eq(trackerEntries.id, existingEntry.id));

    const updatedData: TrackerEntryData = {
      id: existingEntry.id,
      userId: user.id,
      trackerId,
      date: input.date,
      timestampMs: now.getTime(),
      value: Math.round(input.value),
      textValue: input.textValue || null,
      notes: input.notes !== undefined ? input.notes : existingEntry.notes,
      createdAt: existingEntry.createdAt.getTime(),
    };

    return c.json<ApiSuccessResponse<TrackerEntryData>>({ success: true, data: updatedData }, 201);
  }

  const id = `ten_${crypto.randomUUID()}`;

  await db.insert(trackerEntries).values({
    id,
    userId: user.id,
    trackerId,
    date: input.date,
    timestampMs: now,
    value: Math.round(input.value),
    textValue: input.textValue || null,
    notes: input.notes || null,
    createdAt: now,
  });

  const data: TrackerEntryData = {
    id,
    userId: user.id,
    trackerId,
    date: input.date,
    timestampMs: now.getTime(),
    value: Math.round(input.value),
    textValue: input.textValue || null,
    notes: input.notes || null,
    createdAt: now.getTime(),
  };

  return c.json<ApiSuccessResponse<TrackerEntryData>>({ success: true, data }, 201);
});

/**
 * PATCH /api/trackers/entries/:entryId
 */
trackersRouter.patch('/entries/:entryId', zValidator('json', trackerEntryUpdateSchema), async (c) => {
  const user = c.get('user');
  const db = createDb(c.env.DB);
  const entryId = c.req.param('entryId');
  const input = c.req.valid('json');

  const existing = (
    await db
      .select()
      .from(trackerEntries)
      .where(and(eq(trackerEntries.id, entryId), eq(trackerEntries.userId, user.id)))
      .limit(1)
  )[0];

  if (!existing) {
    return c.json({ success: false, error: { code: 'NOT_FOUND', message: 'Tracker entry not found' } }, 404);
  }

  const updateData: Partial<typeof trackerEntries.$inferInsert> = {};
  if (input.value !== undefined) updateData.value = Math.round(input.value);
  if (input.textValue !== undefined) updateData.textValue = input.textValue;
  if (input.notes !== undefined) updateData.notes = input.notes;

  await db.update(trackerEntries).set(updateData).where(eq(trackerEntries.id, entryId));

  const updated = (
    await db.select().from(trackerEntries).where(eq(trackerEntries.id, entryId)).limit(1)
  )[0];

  const data: TrackerEntryData = {
    id: updated.id,
    userId: updated.userId,
    trackerId: updated.trackerId,
    date: updated.date,
    timestampMs: updated.timestampMs.getTime(),
    value: updated.value,
    textValue: updated.textValue || null,
    notes: updated.notes,
    createdAt: updated.createdAt.getTime(),
  };

  return c.json<ApiSuccessResponse<TrackerEntryData>>({ success: true, data });
});

/**
 * DELETE /api/trackers/entries/:entryId
 */
trackersRouter.delete('/entries/:entryId', async (c) => {
  const user = c.get('user');
  const db = createDb(c.env.DB);
  const entryId = c.req.param('entryId');

  await db
    .delete(trackerEntries)
    .where(and(eq(trackerEntries.id, entryId), eq(trackerEntries.userId, user.id)));

  return c.json<ApiSuccessResponse<{ id: string }>>({ success: true, data: { id: entryId } });
});
