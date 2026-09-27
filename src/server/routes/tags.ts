import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import { eq, and, sql } from 'drizzle-orm';
import { createDb } from '../db/client';
import { tags, entityTags } from '../db/schema';
import { requireAuth } from '../middleware/auth';
import { tagCreateSchema, entityTagAttachSchema } from '../../shared/schemas/platform';
import { slugify, sanitizeSearchQuery } from '../../shared/utils/pagination';
import type { ApiSuccessResponse, TagData, EntityTagData, EntityType } from '../../shared/types';
import type { AppBindings } from '../index';

export const tagsRouter = new Hono<{ Bindings: AppBindings }>();

tagsRouter.use('*', requireAuth);

/**
 * GET /api/tags
 * Retrieves tags dictionary for the authenticated user.
 */
tagsRouter.get('/', async (c) => {
  const user = c.get('user');
  const db = createDb(c.env.DB);
  const q = c.req.query('q');

  const conditions = [eq(tags.userId, user.id)];

  if (q && q.trim()) {
    const escaped = sanitizeSearchQuery(q.trim());
    conditions.push(sql`${tags.name} LIKE ${'%' + escaped + '%'} ESCAPE '\\'`);
  }

  const rows = await db
    .select()
    .from(tags)
    .where(and(...conditions))
    .orderBy(tags.name);

  const data: TagData[] = rows.map((r) => ({
    id: r.id,
    userId: r.userId,
    name: r.name,
    slug: r.slug,
    color: r.color,
    createdAt: r.createdAt.getTime(),
    updatedAt: r.updatedAt.getTime(),
  }));

  return c.json<ApiSuccessResponse<TagData[]>>({
    success: true,
    data,
  });
});

/**
 * POST /api/tags
 * Creates a new tag in the user's tag dictionary.
 */
tagsRouter.post('/', zValidator('json', tagCreateSchema), async (c) => {
  const user = c.get('user');
  const db = createDb(c.env.DB);
  const input = c.req.valid('json');

  const slug = slugify(input.name);

  // Check unique slug for user
  const existing = (
    await db
      .select()
      .from(tags)
      .where(and(eq(tags.userId, user.id), eq(tags.slug, slug)))
      .limit(1)
  )[0];

  if (existing) {
    return c.json(
      {
        success: false,
        error: {
          code: 'DUPLICATE_TAG',
          message: `Tag '${input.name}' already exists`,
        },
      },
      409
    );
  }

  const id = `tag_${crypto.randomUUID()}`;
  const now = new Date();

  await db.insert(tags).values({
    id,
    userId: user.id,
    name: input.name,
    slug,
    color: input.color || null,
    createdAt: now,
    updatedAt: now,
  });

  const created: TagData = {
    id,
    userId: user.id,
    name: input.name,
    slug,
    color: input.color || null,
    createdAt: now.getTime(),
    updatedAt: now.getTime(),
  };

  return c.json<ApiSuccessResponse<TagData>>(
    {
      success: true,
      data: created,
    },
    201
  );
});

/**
 * DELETE /api/tags/:id
 * Deletes a tag and cascades deletion of all entity attachments.
 */
tagsRouter.delete('/:id', async (c) => {
  const user = c.get('user');
  const db = createDb(c.env.DB);
  const id = c.req.param('id');

  const existing = (
    await db
      .select()
      .from(tags)
      .where(and(eq(tags.id, id), eq(tags.userId, user.id)))
      .limit(1)
  )[0];

  if (!existing) {
    return c.json(
      {
        success: false,
        error: { code: 'NOT_FOUND', message: 'Tag not found' },
      },
      404
    );
  }

  await db.delete(tags).where(and(eq(tags.id, id), eq(tags.userId, user.id)));

  return c.json<ApiSuccessResponse<{ id: string }>>({
    success: true,
    data: { id },
  });
});

/**
 * GET /api/tags/entities/:entityType/:entityId
 * Retrieves all tags attached to a given entity.
 */
tagsRouter.get('/entities/:entityType/:entityId', async (c) => {
  const user = c.get('user');
  const db = createDb(c.env.DB);
  const entityType = c.req.param('entityType') as EntityType;
  const entityId = c.req.param('entityId');

  const rows = await db
    .select({
      id: entityTags.id,
      userId: entityTags.userId,
      tagId: entityTags.tagId,
      entityType: entityTags.entityType,
      entityId: entityTags.entityId,
      createdAt: entityTags.createdAt,
      tagName: tags.name,
      tagSlug: tags.slug,
      tagColor: tags.color,
      tagCreatedAt: tags.createdAt,
      tagUpdatedAt: tags.updatedAt,
    })
    .from(entityTags)
    .innerJoin(tags, eq(entityTags.tagId, tags.id))
    .where(
      and(
        eq(entityTags.userId, user.id),
        eq(entityTags.entityType, entityType),
        eq(entityTags.entityId, entityId)
      )
    );

  const data: EntityTagData[] = rows.map((r) => ({
    id: r.id,
    userId: r.userId,
    tagId: r.tagId,
    entityType: r.entityType as EntityType,
    entityId: r.entityId,
    createdAt: r.createdAt.getTime(),
    tag: {
      id: r.tagId,
      userId: r.userId,
      name: r.tagName,
      slug: r.tagSlug,
      color: r.tagColor,
      createdAt: r.tagCreatedAt.getTime(),
      updatedAt: r.tagUpdatedAt.getTime(),
    },
  }));

  return c.json<ApiSuccessResponse<EntityTagData[]>>({
    success: true,
    data,
  });
});

/**
 * POST /api/tags/entities/:entityType/:entityId
 * Associates a tag with an entity.
 */
tagsRouter.post(
  '/entities/:entityType/:entityId',
  zValidator('json', entityTagAttachSchema),
  async (c) => {
    const user = c.get('user');
    const db = createDb(c.env.DB);
    const entityType = c.req.param('entityType') as EntityType;
    const entityId = c.req.param('entityId');
    const { tagId } = c.req.valid('json');

    // Verify tag belongs to user
    const tag = (
      await db
        .select()
        .from(tags)
        .where(and(eq(tags.id, tagId), eq(tags.userId, user.id)))
        .limit(1)
    )[0];

    if (!tag) {
      return c.json(
        {
          success: false,
          error: { code: 'NOT_FOUND', message: 'Tag not found' },
        },
        404
      );
    }

    // Check if association already exists
    const existing = (
      await db
        .select()
        .from(entityTags)
        .where(
          and(
            eq(entityTags.userId, user.id),
            eq(entityTags.entityType, entityType),
            eq(entityTags.entityId, entityId),
            eq(entityTags.tagId, tagId)
          )
        )
        .limit(1)
    )[0];

    if (existing) {
      return c.json<ApiSuccessResponse<EntityTagData>>({
        success: true,
        data: {
          id: existing.id,
          userId: existing.userId,
          tagId: existing.tagId,
          entityType: existing.entityType as EntityType,
          entityId: existing.entityId,
          createdAt: existing.createdAt.getTime(),
        },
      });
    }

    const id = `etag_${crypto.randomUUID()}`;
    const now = new Date();

    await db.insert(entityTags).values({
      id,
      userId: user.id,
      tagId,
      entityType,
      entityId,
      createdAt: now,
    });

    const data: EntityTagData = {
      id,
      userId: user.id,
      tagId,
      entityType,
      entityId,
      createdAt: now.getTime(),
      tag: {
        id: tag.id,
        userId: tag.userId,
        name: tag.name,
        slug: tag.slug,
        color: tag.color,
        createdAt: tag.createdAt.getTime(),
        updatedAt: tag.updatedAt.getTime(),
      },
    };

    return c.json<ApiSuccessResponse<EntityTagData>>({ success: true, data }, 201);
  }
);

/**
 * DELETE /api/tags/entities/:entityType/:entityId/:tagId
 * Disassociates a tag from an entity.
 */
tagsRouter.delete('/entities/:entityType/:entityId/:tagId', async (c) => {
  const user = c.get('user');
  const db = createDb(c.env.DB);
  const entityType = c.req.param('entityType') as EntityType;
  const entityId = c.req.param('entityId');
  const tagId = c.req.param('tagId');

  await db
    .delete(entityTags)
    .where(
      and(
        eq(entityTags.userId, user.id),
        eq(entityTags.entityType, entityType),
        eq(entityTags.entityId, entityId),
        eq(entityTags.tagId, tagId)
      )
    );

  return c.json<ApiSuccessResponse<{ success: true }>>({
    success: true,
    data: { success: true },
  });
});
