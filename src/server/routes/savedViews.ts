import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import { eq, and } from 'drizzle-orm';
import { createDb } from '../db/client';
import { savedViews } from '../db/schema';
import { requireAuth } from '../middleware/auth';
import { savedViewCreateSchema, savedViewUpdateSchema } from '../../shared/schemas/platform';
import type { ApiSuccessResponse, SavedViewData, CategoryDomain } from '../../shared/types';
import type { AppBindings } from '../index';

export const savedViewsRouter = new Hono<{ Bindings: AppBindings }>();

savedViewsRouter.use('*', requireAuth);

/**
 * GET /api/saved-views
 * Retrieves user's saved filters/views per domain.
 */
savedViewsRouter.get('/', async (c) => {
  const user = c.get('user');
  const db = createDb(c.env.DB);
  const domain = c.req.query('domain') as CategoryDomain | undefined;

  const conditions = [eq(savedViews.userId, user.id)];
  if (domain) {
    conditions.push(eq(savedViews.domain, domain));
  }

  const rows = await db
    .select()
    .from(savedViews)
    .where(and(...conditions))
    .orderBy(savedViews.sortOrder, savedViews.createdAt);

  const data: SavedViewData[] = rows.map((r) => ({
    id: r.id,
    userId: r.userId,
    domain: r.domain as CategoryDomain,
    name: r.name,
    filterConfig: JSON.parse(r.filterConfig || '{}'),
    sortConfig: r.sortConfig ? JSON.parse(r.sortConfig) : null,
    isPinned: Boolean(r.isPinned),
    isDefault: Boolean(r.isDefault),
    sortOrder: r.sortOrder,
    createdAt: r.createdAt.getTime(),
    updatedAt: r.updatedAt.getTime(),
  }));

  return c.json<ApiSuccessResponse<SavedViewData[]>>({
    success: true,
    data,
  });
});

/**
 * POST /api/saved-views
 * Creates a new saved filter/view.
 */
savedViewsRouter.post('/', zValidator('json', savedViewCreateSchema), async (c) => {
  const user = c.get('user');
  const db = createDb(c.env.DB);
  const input = c.req.valid('json');

  const id = `view_${crypto.randomUUID()}`;
  const now = new Date();

  await db.insert(savedViews).values({
    id,
    userId: user.id,
    domain: input.domain,
    name: input.name,
    filterConfig: JSON.stringify(input.filterConfig),
    sortConfig: input.sortConfig ? JSON.stringify(input.sortConfig) : null,
    isPinned: input.isPinned ? 1 : 0,
    isDefault: input.isDefault ? 1 : 0,
    sortOrder: input.sortOrder || 0,
    createdAt: now,
    updatedAt: now,
  });

  const created: SavedViewData = {
    id,
    userId: user.id,
    domain: input.domain,
    name: input.name,
    filterConfig: input.filterConfig,
    sortConfig: input.sortConfig || null,
    isPinned: Boolean(input.isPinned),
    isDefault: Boolean(input.isDefault),
    sortOrder: input.sortOrder || 0,
    createdAt: now.getTime(),
    updatedAt: now.getTime(),
  };

  return c.json<ApiSuccessResponse<SavedViewData>>({ success: true, data: created }, 201);
});

/**
 * PATCH /api/saved-views/:id
 */
savedViewsRouter.patch('/:id', zValidator('json', savedViewUpdateSchema), async (c) => {
  const user = c.get('user');
  const db = createDb(c.env.DB);
  const id = c.req.param('id');
  const input = c.req.valid('json');

  const existing = (
    await db
      .select()
      .from(savedViews)
      .where(and(eq(savedViews.id, id), eq(savedViews.userId, user.id)))
      .limit(1)
  )[0];

  if (!existing) {
    return c.json(
      {
        success: false,
        error: { code: 'NOT_FOUND', message: 'Saved view not found' },
      },
      404
    );
  }

  const updateValues: Record<string, unknown> = {
    updatedAt: new Date(),
  };

  if (input.name !== undefined) updateValues.name = input.name;
  if (input.filterConfig !== undefined) updateValues.filterConfig = JSON.stringify(input.filterConfig);
  if (input.sortConfig !== undefined) {
    updateValues.sortConfig = input.sortConfig ? JSON.stringify(input.sortConfig) : null;
  }
  if (input.isPinned !== undefined) updateValues.isPinned = input.isPinned ? 1 : 0;
  if (input.isDefault !== undefined) updateValues.isDefault = input.isDefault ? 1 : 0;
  if (input.sortOrder !== undefined) updateValues.sortOrder = input.sortOrder;

  await db
    .update(savedViews)
    .set(updateValues)
    .where(and(eq(savedViews.id, id), eq(savedViews.userId, user.id)));

  const updated = (
    await db
      .select()
      .from(savedViews)
      .where(eq(savedViews.id, id))
      .limit(1)
  )[0];

  const data: SavedViewData = {
    id: updated.id,
    userId: updated.userId,
    domain: updated.domain as CategoryDomain,
    name: updated.name,
    filterConfig: JSON.parse(updated.filterConfig || '{}'),
    sortConfig: updated.sortConfig ? JSON.parse(updated.sortConfig) : null,
    isPinned: Boolean(updated.isPinned),
    isDefault: Boolean(updated.isDefault),
    sortOrder: updated.sortOrder,
    createdAt: updated.createdAt.getTime(),
    updatedAt: updated.updatedAt.getTime(),
  };

  return c.json<ApiSuccessResponse<SavedViewData>>({ success: true, data });
});

/**
 * DELETE /api/saved-views/:id
 */
savedViewsRouter.delete('/:id', async (c) => {
  const user = c.get('user');
  const db = createDb(c.env.DB);
  const id = c.req.param('id');

  const existing = (
    await db
      .select()
      .from(savedViews)
      .where(and(eq(savedViews.id, id), eq(savedViews.userId, user.id)))
      .limit(1)
  )[0];

  if (!existing) {
    return c.json(
      {
        success: false,
        error: { code: 'NOT_FOUND', message: 'Saved view not found' },
      },
      404
    );
  }

  await db.delete(savedViews).where(and(eq(savedViews.id, id), eq(savedViews.userId, user.id)));

  return c.json<ApiSuccessResponse<{ id: string }>>({
    success: true,
    data: { id },
  });
});
