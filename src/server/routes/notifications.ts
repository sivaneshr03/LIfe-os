import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import { eq, and, desc, lt } from 'drizzle-orm';
import { createDb } from '../db/client';
import { inAppNotifications } from '../db/schema';
import { requireAuth } from '../middleware/auth';
import { notificationQuerySchema } from '../../shared/schemas/platform';
import { encodeCursor, decodeCursor, buildCursorPaginationMeta } from '../../shared/utils/pagination';
import type {
  ApiSuccessResponse,
  InAppNotificationData,
  NotificationType,
  NotificationLevel,
  EntityType,
} from '../../shared/types';
import type { AppBindings } from '../index';

export const notificationsRouter = new Hono<{ Bindings: AppBindings }>();

notificationsRouter.use('*', requireAuth);

/**
 * GET /api/notifications
 * Returns user in-app notification feed with cursor-based pagination.
 */
notificationsRouter.get('/', zValidator('query', notificationQuerySchema), async (c) => {
  const user = c.get('user');
  const db = createDb(c.env.DB);
  const { unreadOnly, limit, cursor } = c.req.valid('query');

  const conditions = [eq(inAppNotifications.userId, user.id)];

  if (unreadOnly) {
    conditions.push(eq(inAppNotifications.isRead, 0));
  }

  if (cursor) {
    const decoded = decodeCursor(cursor);
    if (decoded) {
      conditions.push(lt(inAppNotifications.createdAt, new Date(decoded.timestampMs)));
    }
  }

  // Fetch limit + 1 to check hasNextPage
  const rows = await db
    .select()
    .from(inAppNotifications)
    .where(and(...conditions))
    .orderBy(desc(inAppNotifications.createdAt))
    .limit(limit + 1);

  const hasNextPage = rows.length > limit;
  const items = hasNextPage ? rows.slice(0, limit) : rows;

  let nextCursor: string | undefined;
  if (hasNextPage && items.length > 0) {
    const lastItem = items[items.length - 1];
    nextCursor = encodeCursor(lastItem.createdAt.getTime(), lastItem.id);
  }

  const data: InAppNotificationData[] = items.map((r) => ({
    id: r.id,
    userId: r.userId,
    type: r.type as NotificationType,
    title: r.title,
    body: r.body,
    level: r.level as NotificationLevel,
    entityType: r.entityType as EntityType | null,
    entityId: r.entityId,
    actionUrl: r.actionUrl,
    isRead: Boolean(r.isRead),
    readAt: r.readAt ? r.readAt.getTime() : null,
    createdAt: r.createdAt.getTime(),
  }));

  return c.json({
    success: true,
    data,
    meta: buildCursorPaginationMeta(hasNextPage, nextCursor),
  });
});

/**
 * PATCH /api/notifications/:id/read
 * Marks a notification as read.
 */
notificationsRouter.patch('/:id/read', async (c) => {
  const user = c.get('user');
  const db = createDb(c.env.DB);
  const id = c.req.param('id');

  const existing = (
    await db
      .select()
      .from(inAppNotifications)
      .where(and(eq(inAppNotifications.id, id), eq(inAppNotifications.userId, user.id)))
      .limit(1)
  )[0];

  if (!existing) {
    return c.json(
      {
        success: false,
        error: { code: 'NOT_FOUND', message: 'Notification not found' },
      },
      404
    );
  }

  const now = new Date();
  await db
    .update(inAppNotifications)
    .set({ isRead: 1, readAt: now })
    .where(and(eq(inAppNotifications.id, id), eq(inAppNotifications.userId, user.id)));

  return c.json<ApiSuccessResponse<{ id: string; isRead: true }>>({
    success: true,
    data: { id, isRead: true },
  });
});

/**
 * POST /api/notifications/mark-all-read
 * Marks all notifications for user as read.
 */
notificationsRouter.post('/mark-all-read', async (c) => {
  const user = c.get('user');
  const db = createDb(c.env.DB);
  const now = new Date();

  await db
    .update(inAppNotifications)
    .set({ isRead: 1, readAt: now })
    .where(and(eq(inAppNotifications.userId, user.id), eq(inAppNotifications.isRead, 0)));

  return c.json<ApiSuccessResponse<{ success: true }>>({
    success: true,
    data: { success: true },
  });
});

/**
 * GET /api/notifications/unread-count
 * Returns total count of unread notifications for quick UI badge update.
 */
notificationsRouter.get('/unread-count', async (c) => {
  const user = c.get('user');
  const db = createDb(c.env.DB);

  const unreadRows = await db
    .select({ id: inAppNotifications.id })
    .from(inAppNotifications)
    .where(and(eq(inAppNotifications.userId, user.id), eq(inAppNotifications.isRead, 0)));

  return c.json<ApiSuccessResponse<{ unreadCount: number }>>({
    success: true,
    data: { unreadCount: unreadRows.length },
  });
});

/**
 * DELETE /api/notifications/:id
 * Deletes / dismisses a single notification.
 */
notificationsRouter.delete('/:id', async (c) => {
  const user = c.get('user');
  const db = createDb(c.env.DB);
  const id = c.req.param('id');

  const existing = (
    await db
      .select()
      .from(inAppNotifications)
      .where(and(eq(inAppNotifications.id, id), eq(inAppNotifications.userId, user.id)))
      .limit(1)
  )[0];

  if (!existing) {
    return c.json(
      {
        success: false,
        error: { code: 'NOT_FOUND', message: 'Notification not found' },
      },
      404
    );
  }

  await db
    .delete(inAppNotifications)
    .where(and(eq(inAppNotifications.id, id), eq(inAppNotifications.userId, user.id)));

  return c.json<ApiSuccessResponse<{ id: string }>>({
    success: true,
    data: { id },
  });
});

