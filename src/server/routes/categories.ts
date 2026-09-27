import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import { eq, and, sql, isNull } from 'drizzle-orm';
import { createDb } from '../db/client';
import { categories } from '../db/schema';
import { requireAuth } from '../middleware/auth';
import {
  categoryCreateSchema,
  categoryUpdateSchema,
  categoryQuerySchema,
} from '../../shared/schemas/platform';
import { seedDefaultCategories } from '../services/categoryDefaults';
import { slugify, sanitizeSearchQuery } from '../../shared/utils/pagination';
import type { ApiSuccessResponse, CategoryData, CategoryDomain } from '../../shared/types';
import type { AppBindings } from '../index';

export const categoriesRouter = new Hono<{ Bindings: AppBindings }>();

categoriesRouter.use('*', requireAuth);

/**
 * GET /api/categories
 * Retrieves categories for the authenticated user, optionally filtered by domain and search query.
 * Groups top-level categories and nested subcategories.
 */
categoriesRouter.get('/', zValidator('query', categoryQuerySchema), async (c) => {
  const user = c.get('user');
  const db = createDb(c.env.DB);
  const { domain, parentId, includeDisabled, q } = c.req.valid('query');

  const conditions = [eq(categories.userId, user.id)];

  if (domain) {
    conditions.push(eq(categories.domain, domain));
  }

  if (!includeDisabled) {
    conditions.push(eq(categories.isEnabled, 1));
  }

  if (q && q.trim()) {
    const escaped = sanitizeSearchQuery(q.trim());
    conditions.push(sql`${categories.name} LIKE ${'%' + escaped + '%'} ESCAPE '\\'`);
  }

  // If a specific parentId or 'root' filter is passed
  if (parentId !== undefined) {
    if (parentId === null || parentId === 'null' || parentId === 'root') {
      conditions.push(isNull(categories.parentId));
    } else {
      conditions.push(eq(categories.parentId, parentId));
    }

    const rows = await db
      .select()
      .from(categories)
      .where(and(...conditions))
      .orderBy(categories.sortOrder, categories.createdAt);

    const data: CategoryData[] = rows.map((row) => ({
      id: row.id,
      userId: row.userId,
      domain: row.domain as CategoryDomain,
      parentId: row.parentId,
      name: row.name,
      slug: row.slug,
      icon: row.icon,
      color: row.color,
      description: row.description,
      isDefault: Boolean(row.isDefault),
      isEnabled: Boolean(row.isEnabled),
      sortOrder: row.sortOrder,
      createdAt: row.createdAt.getTime(),
      updatedAt: row.updatedAt.getTime(),
      subcategories: [],
    }));

    return c.json<ApiSuccessResponse<CategoryData[]>>({
      success: true,
      data,
    });
  }

  const rows = await db
    .select()
    .from(categories)
    .where(and(...conditions))
    .orderBy(categories.sortOrder, categories.createdAt);

  // Group into parents and subcategories
  const parentMap = new Map<string, CategoryData>();
  const subcategoryList: CategoryData[] = [];

  for (const row of rows) {
    const catData: CategoryData = {
      id: row.id,
      userId: row.userId,
      domain: row.domain as CategoryDomain,
      parentId: row.parentId,
      name: row.name,
      slug: row.slug,
      icon: row.icon,
      color: row.color,
      description: row.description,
      isDefault: Boolean(row.isDefault),
      isEnabled: Boolean(row.isEnabled),
      sortOrder: row.sortOrder,
      createdAt: row.createdAt.getTime(),
      updatedAt: row.updatedAt.getTime(),
      subcategories: [],
    };

    if (!row.parentId) {
      parentMap.set(row.id, catData);
    } else {
      subcategoryList.push(catData);
    }
  }

  // Nest subcategories into parents
  for (const sub of subcategoryList) {
    if (sub.parentId && parentMap.has(sub.parentId)) {
      parentMap.get(sub.parentId)!.subcategories!.push(sub);
    } else {
      // Parent was filtered or disabled, retain subcategory as standalone item
      parentMap.set(sub.id, sub);
    }
  }

  return c.json<ApiSuccessResponse<CategoryData[]>>({
    success: true,
    data: Array.from(parentMap.values()),
  });
});

/**
 * GET /api/categories/:parentId/subcategories
 * Explicit subcategory endpoint scoped cleanly to a parent category.
 */
categoriesRouter.get('/:parentId/subcategories', async (c) => {
  const user = c.get('user');
  const db = createDb(c.env.DB);
  const parentId = c.req.param('parentId');

  const rows = await db
    .select()
    .from(categories)
    .where(
      and(
        eq(categories.userId, user.id),
        eq(categories.parentId, parentId),
        eq(categories.isEnabled, 1)
      )
    )
    .orderBy(categories.sortOrder, categories.createdAt);

  const data: CategoryData[] = rows.map((row) => ({
    id: row.id,
    userId: row.userId,
    domain: row.domain as CategoryDomain,
    parentId: row.parentId,
    name: row.name,
    slug: row.slug,
    icon: row.icon,
    color: row.color,
    description: row.description,
    isDefault: Boolean(row.isDefault),
    isEnabled: Boolean(row.isEnabled),
    sortOrder: row.sortOrder,
    createdAt: row.createdAt.getTime(),
    updatedAt: row.updatedAt.getTime(),
  }));

  return c.json<ApiSuccessResponse<CategoryData[]>>({
    success: true,
    data,
  });
});

/**
 * POST /api/categories
 * Creates a new custom category or subcategory scoped to authenticated user.
 */
categoriesRouter.post('/', zValidator('json', categoryCreateSchema), async (c) => {
  const user = c.get('user');
  const db = createDb(c.env.DB);
  const input = c.req.valid('json');

  let parentId: string | null = null;

  if (input.parentId) {
    // Validate parent belongs to same user and domain
    const parent = (
      await db
        .select()
        .from(categories)
        .where(
          and(
            eq(categories.id, input.parentId),
            eq(categories.userId, user.id),
            eq(categories.domain, input.domain)
          )
        )
        .limit(1)
    )[0];

    if (!parent) {
      return c.json(
        {
          success: false,
          error: {
            code: 'INVALID_PARENT',
            message: 'Parent category not found or belongs to a different domain',
          },
        },
        400
      );
    }
    parentId = parent.id;
  }

  const slug = slugify(input.name);

  // Check unique slug within user, domain, and parent
  const existing = await db
    .select({ id: categories.id })
    .from(categories)
    .where(
      and(
        eq(categories.userId, user.id),
        eq(categories.domain, input.domain),
        parentId ? eq(categories.parentId, parentId) : isNull(categories.parentId),
        eq(categories.slug, slug)
      )
    )
    .limit(1);

  if (existing.length > 0) {
    return c.json(
      {
        success: false,
        error: {
          code: 'DUPLICATE_CATEGORY',
          message: `Category '${input.name}' already exists in this domain`,
        },
      },
      409
    );
  }

  const id = `cat_${crypto.randomUUID()}`;
  const now = new Date();

  await db.insert(categories).values({
    id,
    userId: user.id,
    domain: input.domain,
    parentId,
    name: input.name,
    slug,
    icon: input.icon || null,
    color: input.color || null,
    description: input.description || null,
    isDefault: 0,
    isEnabled: 1,
    sortOrder: input.sortOrder || 0,
    createdAt: now,
    updatedAt: now,
  });

  const created: CategoryData = {
    id,
    userId: user.id,
    domain: input.domain,
    parentId,
    name: input.name,
    slug,
    icon: input.icon || null,
    color: input.color || null,
    description: input.description || null,
    isDefault: false,
    isEnabled: true,
    sortOrder: input.sortOrder || 0,
    createdAt: now.getTime(),
    updatedAt: now.getTime(),
    subcategories: [],
  };

  return c.json<ApiSuccessResponse<CategoryData>>(
    {
      success: true,
      data: created,
    },
    201
  );
});

/**
 * PATCH /api/categories/:id
 * Updates or enables/disables a category (disabling does not destroy historical records).
 */
categoriesRouter.patch('/:id', zValidator('json', categoryUpdateSchema), async (c) => {
  const user = c.get('user');
  const db = createDb(c.env.DB);
  const id = c.req.param('id');
  const input = c.req.valid('json');

  const existing = (
    await db
      .select()
      .from(categories)
      .where(and(eq(categories.id, id), eq(categories.userId, user.id)))
      .limit(1)
  )[0];

  if (!existing) {
    return c.json(
      {
        success: false,
        error: {
          code: 'NOT_FOUND',
          message: 'Category not found',
        },
      },
      404
    );
  }

  const updateValues: Record<string, unknown> = {
    updatedAt: new Date(),
  };

  if (input.name !== undefined) {
    updateValues.name = input.name;
    updateValues.slug = slugify(input.name);
  }
  if (input.icon !== undefined) updateValues.icon = input.icon;
  if (input.color !== undefined) updateValues.color = input.color;
  if (input.description !== undefined) updateValues.description = input.description;
  if (input.isEnabled !== undefined) updateValues.isEnabled = input.isEnabled ? 1 : 0;
  if (input.sortOrder !== undefined) updateValues.sortOrder = input.sortOrder;

  if (input.parentId !== undefined) {
    if (input.parentId === id) {
      return c.json(
        {
          success: false,
          error: { code: 'INVALID_PARENT', message: 'Category cannot be its own parent' },
        },
        400
      );
    }
    if (input.parentId !== null) {
      const parent = (
        await db
          .select()
          .from(categories)
          .where(
            and(
              eq(categories.id, input.parentId),
              eq(categories.userId, user.id),
              eq(categories.domain, existing.domain)
            )
          )
          .limit(1)
      )[0];
      if (!parent) {
        return c.json(
          {
            success: false,
            error: {
              code: 'INVALID_PARENT',
              message: 'Parent category not found or belongs to a different domain',
            },
          },
          400
        );
      }
      updateValues.parentId = parent.id;
    } else {
      updateValues.parentId = null;
    }
  }

  await db
    .update(categories)
    .set(updateValues)
    .where(and(eq(categories.id, id), eq(categories.userId, user.id)));

  const updated = (
    await db
      .select()
      .from(categories)
      .where(eq(categories.id, id))
      .limit(1)
  )[0];

  const data: CategoryData = {
    id: updated.id,
    userId: updated.userId,
    domain: updated.domain as CategoryDomain,
    parentId: updated.parentId,
    name: updated.name,
    slug: updated.slug,
    icon: updated.icon,
    color: updated.color,
    description: updated.description,
    isDefault: Boolean(updated.isDefault),
    isEnabled: Boolean(updated.isEnabled),
    sortOrder: updated.sortOrder,
    createdAt: updated.createdAt.getTime(),
    updatedAt: updated.updatedAt.getTime(),
  };

  return c.json<ApiSuccessResponse<CategoryData>>({
    success: true,
    data,
  });
});

/**
 * DELETE /api/categories/:id
 * Deletes a category. Prevents deletion if subcategories exist.
 */
categoriesRouter.delete('/:id', async (c) => {
  const user = c.get('user');
  const db = createDb(c.env.DB);
  const id = c.req.param('id');

  const existing = (
    await db
      .select()
      .from(categories)
      .where(and(eq(categories.id, id), eq(categories.userId, user.id)))
      .limit(1)
  )[0];

  if (!existing) {
    return c.json(
      {
        success: false,
        error: { code: 'NOT_FOUND', message: 'Category not found' },
      },
      404
    );
  }

  // Check if it has subcategories
  const childCount = await db
    .select({ count: sql<number>`count(*)` })
    .from(categories)
    .where(and(eq(categories.parentId, id), eq(categories.userId, user.id)));

  if (childCount[0]?.count > 0) {
    return c.json(
      {
        success: false,
        error: {
          code: 'HAS_SUBCATEGORIES',
          message: 'Cannot delete category that has subcategories. Reassign or delete them first, or disable the category.',
        },
      },
      400
    );
  }

  await db
    .delete(categories)
    .where(and(eq(categories.id, id), eq(categories.userId, user.id)));

  return c.json<ApiSuccessResponse<{ id: string }>>({
    success: true,
    data: { id },
  });
});

/**
 * POST /api/categories/seed-defaults
 * Seeds default categories for the authenticated user.
 */
categoriesRouter.post('/seed-defaults', async (c) => {
  const user = c.get('user');
  const domainQuery = c.req.query('domain') as CategoryDomain | undefined;
  const result = await seedDefaultCategories(c.env.DB, user.id, domainQuery);

  return c.json<ApiSuccessResponse<{ seededCount: number }>>({
    success: true,
    data: { seededCount: result.count },
  });
});
