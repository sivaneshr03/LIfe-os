import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import { eq, and } from 'drizzle-orm';
import { createDb } from '../db/client';
import { reminders } from '../db/schema';
import { requireAuth } from '../middleware/auth';
import { reminderCreateSchema, reminderUpdateStatusSchema } from '../../shared/schemas/platform';
import type { ApiSuccessResponse, ReminderData, EntityType, ReminderStatus } from '../../shared/types';
import type { AppBindings } from '../index';

export const remindersRouter = new Hono<{ Bindings: AppBindings }>();

remindersRouter.use('*', requireAuth);

/**
 * GET /api/reminders
 * Retrieves reminders for authenticated user.
 */
remindersRouter.get('/', async (c) => {
  const user = c.get('user');
  const db = createDb(c.env.DB);
  const status = c.req.query('status') as ReminderStatus | undefined;
  const entityType = c.req.query('entityType') as EntityType | undefined;
  const entityId = c.req.query('entityId');

  const conditions = [eq(reminders.userId, user.id)];

  if (status) {
    conditions.push(eq(reminders.status, status));
  }
  if (entityType) {
    conditions.push(eq(reminders.entityType, entityType));
  }
  if (entityId) {
    conditions.push(eq(reminders.entityId, entityId));
  }

  const rows = await db
    .select()
    .from(reminders)
    .where(and(...conditions))
    .orderBy(reminders.remindAt);

  const data: ReminderData[] = rows.map((r) => ({
    id: r.id,
    userId: r.userId,
    entityType: r.entityType as EntityType,
    entityId: r.entityId,
    title: r.title,
    description: r.description,
    remindAt: r.remindAt.getTime(),
    recurrenceRule: r.recurrenceRule,
    status: r.status as ReminderStatus,
    snoozedUntil: r.snoozedUntil ? r.snoozedUntil.getTime() : null,
    dismissedAt: r.dismissedAt ? r.dismissedAt.getTime() : null,
    createdAt: r.createdAt.getTime(),
    updatedAt: r.updatedAt.getTime(),
  }));

  return c.json<ApiSuccessResponse<ReminderData[]>>({
    success: true,
    data,
  });
});

/**
 * POST /api/reminders
 * Creates a generic multi-entity reminder.
 */
remindersRouter.post('/', zValidator('json', reminderCreateSchema), async (c) => {
  const user = c.get('user');
  const db = createDb(c.env.DB);
  const input = c.req.valid('json');

  const id = `rem_${crypto.randomUUID()}`;
  const now = new Date();
  const remindDate = new Date(input.remindAt);

  await db.insert(reminders).values({
    id,
    userId: user.id,
    entityType: input.entityType,
    entityId: input.entityId || null,
    title: input.title,
    description: input.description || null,
    remindAt: remindDate,
    recurrenceRule: input.recurrenceRule || null,
    status: 'pending',
    createdAt: now,
    updatedAt: now,
  });

  const created: ReminderData = {
    id,
    userId: user.id,
    entityType: input.entityType,
    entityId: input.entityId || null,
    title: input.title,
    description: input.description || null,
    remindAt: remindDate.getTime(),
    recurrenceRule: input.recurrenceRule || null,
    status: 'pending',
    snoozedUntil: null,
    dismissedAt: null,
    createdAt: now.getTime(),
    updatedAt: now.getTime(),
  };

  return c.json<ApiSuccessResponse<ReminderData>>({ success: true, data: created }, 201);
});

/**
 * PATCH /api/reminders/:id/status
 * Updates reminder status (snooze, acknowledge, dismiss).
 */
remindersRouter.patch('/:id/status', zValidator('json', reminderUpdateStatusSchema), async (c) => {
  const user = c.get('user');
  const db = createDb(c.env.DB);
  const id = c.req.param('id');
  const input = c.req.valid('json');

  const existing = (
    await db
      .select()
      .from(reminders)
      .where(and(eq(reminders.id, id), eq(reminders.userId, user.id)))
      .limit(1)
  )[0];

  if (!existing) {
    return c.json(
      {
        success: false,
        error: { code: 'NOT_FOUND', message: 'Reminder not found' },
      },
      404
    );
  }

  const updateValues: Record<string, unknown> = {
    status: input.status,
    updatedAt: new Date(),
  };

  if (input.status === 'snoozed') {
    if (!input.snoozedUntil) {
      return c.json(
        {
          success: false,
          error: { code: 'VALIDATION_ERROR', message: 'snoozedUntil is required when snoozing' },
        },
        400
      );
    }
    updateValues.snoozedUntil = new Date(input.snoozedUntil);
  } else if (input.status === 'dismissed') {
    updateValues.dismissedAt = new Date();
  }

  await db
    .update(reminders)
    .set(updateValues)
    .where(and(eq(reminders.id, id), eq(reminders.userId, user.id)));

  const updated = (
    await db
      .select()
      .from(reminders)
      .where(eq(reminders.id, id))
      .limit(1)
  )[0];

  const data: ReminderData = {
    id: updated.id,
    userId: updated.userId,
    entityType: updated.entityType as EntityType,
    entityId: updated.entityId,
    title: updated.title,
    description: updated.description,
    remindAt: updated.remindAt.getTime(),
    recurrenceRule: updated.recurrenceRule,
    status: updated.status as ReminderStatus,
    snoozedUntil: updated.snoozedUntil ? updated.snoozedUntil.getTime() : null,
    dismissedAt: updated.dismissedAt ? updated.dismissedAt.getTime() : null,
    createdAt: updated.createdAt.getTime(),
    updatedAt: updated.updatedAt.getTime(),
  };

  return c.json<ApiSuccessResponse<ReminderData>>({ success: true, data });
});

/**
 * DELETE /api/reminders/:id
 */
remindersRouter.delete('/:id', async (c) => {
  const user = c.get('user');
  const db = createDb(c.env.DB);
  const id = c.req.param('id');

  const existing = (
    await db
      .select()
      .from(reminders)
      .where(and(eq(reminders.id, id), eq(reminders.userId, user.id)))
      .limit(1)
  )[0];

  if (!existing) {
    return c.json(
      {
        success: false,
        error: { code: 'NOT_FOUND', message: 'Reminder not found' },
      },
      404
    );
  }

  await db.delete(reminders).where(and(eq(reminders.id, id), eq(reminders.userId, user.id)));

  return c.json<ApiSuccessResponse<{ id: string }>>({
    success: true,
    data: { id },
  });
});
