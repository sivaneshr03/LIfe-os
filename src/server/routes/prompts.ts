import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import { eq, and, sql, desc, like, or } from 'drizzle-orm';
import { z } from 'zod';
import { createDb } from '../db/client';
import { prompts, promptVersions } from '../db/schema';
import { requireAuth } from '../middleware/auth';
import {
  promptCreateSchema,
  promptUpdateSchema,
  promptVersionCreateSchema,
} from '../../shared/schemas/productivity';
import { slugify } from '../../shared/utils/pagination';
import type {
  ApiSuccessResponse,
  ApiPaginatedResponse,
  PromptData,
  PromptVersionData,
  PromptVariable,
} from '../../shared/types';
import type { AppBindings } from '../index';

export const promptsRouter = new Hono<{ Bindings: AppBindings }>();

promptsRouter.use('*', requireAuth);

function extractVariables(
  template: string,
  systemPrompt?: string | null,
  provided?: PromptVariable[] | null
): PromptVariable[] {
  if (provided && provided.length > 0) return provided;
  const combined = `${template} ${systemPrompt || ''}`;
  const matches = combined.matchAll(/\{\{([a-zA-Z0-9_-]+)\}\}/g);
  const names = new Set<string>();
  const vars: PromptVariable[] = [];
  for (const m of matches) {
    const name = m[1];
    if (!names.has(name)) {
      names.add(name);
      vars.push({ name, description: `Variable ${name}` });
    }
  }
  return vars;
}

const promptQuerySchema = z.object({
  categoryId: z.string().optional(),
  isFavorite: z
    .enum(['true', 'false'])
    .optional()
    .transform((v) => (v === undefined ? undefined : v === 'true')),
  q: z.string().max(100).optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(30),
});

/**
 * GET /api/prompts
 * Paginated list of prompts with latest version info.
 */
promptsRouter.get('/', zValidator('query', promptQuerySchema), async (c) => {
  const user = c.get('user');
  const db = createDb(c.env.DB);
  const q = c.req.valid('query');

  const conditions = [eq(prompts.userId, user.id)];

  if (q.categoryId) {
    conditions.push(eq(prompts.categoryId, q.categoryId));
  }

  if (q.isFavorite !== undefined) {
    conditions.push(eq(prompts.isFavorite, q.isFavorite ? 1 : 0));
  }

  if (q.q && q.q.trim().length > 0) {
    const term = `%${q.q.trim()}%`;
    conditions.push(or(like(prompts.title, term), like(prompts.description, term))!);
  }

  const whereClause = and(...conditions);

  const countRes = await db
    .select({ count: sql<number>`count(*)` })
    .from(prompts)
    .where(whereClause);
  const total = Number(countRes[0]?.count || 0);

  const offset = (q.page - 1) * q.pageSize;

  const promptRows = await db
    .select()
    .from(prompts)
    .where(whereClause)
    .orderBy(desc(prompts.isFavorite), desc(prompts.updatedAt))
    .limit(q.pageSize)
    .offset(offset);

  const items: PromptData[] = [];

  for (const p of promptRows) {
    // Fetch latest version
    const versionRow = (
      await db
        .select()
        .from(promptVersions)
        .where(
          and(
            eq(promptVersions.promptId, p.id),
            eq(promptVersions.version, p.currentVersion),
            eq(promptVersions.userId, user.id)
          )
        )
        .limit(1)
    )[0];

    let latestVersion: PromptVersionData | undefined;
    if (versionRow) {
      let parsedVars: PromptVariable[] | null = null;
      if (versionRow.variables) {
        try {
          parsedVars = JSON.parse(versionRow.variables);
        } catch {
          parsedVars = null;
        }
      }
      latestVersion = {
        id: versionRow.id,
        userId: versionRow.userId,
        promptId: versionRow.promptId,
        version: versionRow.version,
        systemPrompt: versionRow.systemPrompt,
        template: versionRow.template,
        variables: parsedVars,
        changeNotes: versionRow.changeNotes,
        createdAt: versionRow.createdAt.getTime(),
      };
    }

    items.push({
      id: p.id,
      userId: p.userId,
      categoryId: p.categoryId,
      title: p.title,
      slug: p.slug,
      description: p.description,
      targetModel: p.targetModel,
      currentVersion: p.currentVersion,
      isFavorite: Boolean(p.isFavorite),
      latestVersion,
      createdAt: p.createdAt.getTime(),
      updatedAt: p.updatedAt.getTime(),
    });
  }

  return c.json<ApiPaginatedResponse<PromptData>>({
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
 * POST /api/prompts
 * Create a new prompt and initialize version 1.
 */
promptsRouter.post('/', zValidator('json', promptCreateSchema), async (c) => {
  const user = c.get('user');
  const db = createDb(c.env.DB);
  const input = c.req.valid('json');

  const baseSlug = slugify(input.title) || 'prompt';
  const existing = await db
    .select({ slug: prompts.slug })
    .from(prompts)
    .where(and(eq(prompts.userId, user.id), like(prompts.slug, `${baseSlug}%`)));

  let slug = baseSlug;
  if (existing.some((r) => r.slug === slug)) {
    slug = `${baseSlug}-${Date.now().toString(36)}`;
  }

  const promptId = `prm_${crypto.randomUUID()}`;
  const versionId = `prv_${crypto.randomUUID()}`;
  const now = new Date();

  const variables = extractVariables(input.template, input.systemPrompt, input.variables);

  // Insert prompt
  await db.insert(prompts).values({
    id: promptId,
    userId: user.id,
    categoryId: input.categoryId || null,
    title: input.title,
    slug,
    description: input.description || null,
    targetModel: input.targetModel || null,
    currentVersion: 1,
    isFavorite: input.isFavorite ? 1 : 0,
    createdAt: now,
    updatedAt: now,
  });

  // Insert version 1
  await db.insert(promptVersions).values({
    id: versionId,
    userId: user.id,
    promptId,
    version: 1,
    systemPrompt: input.systemPrompt || null,
    template: input.template,
    variables: JSON.stringify(variables),
    changeNotes: input.changeNotes || 'Initial version',
    createdAt: now,
  });

  const latestVersion: PromptVersionData = {
    id: versionId,
    userId: user.id,
    promptId,
    version: 1,
    systemPrompt: input.systemPrompt || null,
    template: input.template,
    variables,
    changeNotes: input.changeNotes || 'Initial version',
    createdAt: now.getTime(),
  };

  const data: PromptData = {
    id: promptId,
    userId: user.id,
    categoryId: input.categoryId || null,
    title: input.title,
    slug,
    description: input.description || null,
    targetModel: input.targetModel || null,
    currentVersion: 1,
    isFavorite: Boolean(input.isFavorite),
    latestVersion,
    createdAt: now.getTime(),
    updatedAt: now.getTime(),
  };

  return c.json<ApiSuccessResponse<PromptData>>({ success: true, data }, 201);
});

/**
 * GET /api/prompts/:id
 * Retrieve a prompt with all its version history.
 */
promptsRouter.get('/:id', async (c) => {
  const user = c.get('user');
  const db = createDb(c.env.DB);
  const id = c.req.param('id');

  const promptRow = (
    await db
      .select()
      .from(prompts)
      .where(and(eq(prompts.id, id), eq(prompts.userId, user.id)))
      .limit(1)
  )[0];

  if (!promptRow) {
    return c.json({ success: false, error: { code: 'NOT_FOUND', message: 'Prompt not found' } }, 404);
  }

  const versions = await db
    .select()
    .from(promptVersions)
    .where(and(eq(promptVersions.promptId, id), eq(promptVersions.userId, user.id)))
    .orderBy(desc(promptVersions.version));

  const versionData: PromptVersionData[] = versions.map((v) => {
    let parsedVars: PromptVariable[] | null = null;
    if (v.variables) {
      try {
        parsedVars = JSON.parse(v.variables);
      } catch {
        parsedVars = null;
      }
    }
    return {
      id: v.id,
      userId: v.userId,
      promptId: v.promptId,
      version: v.version,
      systemPrompt: v.systemPrompt,
      template: v.template,
      variables: parsedVars,
      changeNotes: v.changeNotes,
      createdAt: v.createdAt.getTime(),
    };
  });

  const latest = versionData.find((v) => v.version === promptRow.currentVersion) || versionData[0];

  const data: PromptData & { versions: PromptVersionData[] } = {
    id: promptRow.id,
    userId: promptRow.userId,
    categoryId: promptRow.categoryId,
    title: promptRow.title,
    slug: promptRow.slug,
    description: promptRow.description,
    targetModel: promptRow.targetModel,
    currentVersion: promptRow.currentVersion,
    isFavorite: Boolean(promptRow.isFavorite),
    latestVersion: latest,
    versions: versionData,
    createdAt: promptRow.createdAt.getTime(),
    updatedAt: promptRow.updatedAt.getTime(),
  };

  return c.json<ApiSuccessResponse<typeof data>>({ success: true, data });
});

/**
 * PATCH /api/prompts/:id
 * Update prompt metadata.
 */
promptsRouter.patch('/:id', zValidator('json', promptUpdateSchema), async (c) => {
  const user = c.get('user');
  const db = createDb(c.env.DB);
  const id = c.req.param('id');
  const input = c.req.valid('json');

  const existing = (
    await db
      .select()
      .from(prompts)
      .where(and(eq(prompts.id, id), eq(prompts.userId, user.id)))
      .limit(1)
  )[0];

  if (!existing) {
    return c.json({ success: false, error: { code: 'NOT_FOUND', message: 'Prompt not found' } }, 404);
  }

  const now = new Date();
  const updateData: Partial<typeof prompts.$inferInsert> = {
    updatedAt: now,
  };

  if (input.title !== undefined) updateData.title = input.title;
  if (input.description !== undefined) updateData.description = input.description;
  if (input.targetModel !== undefined) updateData.targetModel = input.targetModel;
  if (input.categoryId !== undefined) updateData.categoryId = input.categoryId;
  if (input.isFavorite !== undefined) updateData.isFavorite = input.isFavorite ? 1 : 0;

  await db.update(prompts).set(updateData).where(eq(prompts.id, id));

  const updated = (await db.select().from(prompts).where(eq(prompts.id, id)).limit(1))[0];

  const data: PromptData = {
    id: updated.id,
    userId: updated.userId,
    categoryId: updated.categoryId,
    title: updated.title,
    slug: updated.slug,
    description: updated.description,
    targetModel: updated.targetModel,
    currentVersion: updated.currentVersion,
    isFavorite: Boolean(updated.isFavorite),
    createdAt: updated.createdAt.getTime(),
    updatedAt: updated.updatedAt.getTime(),
  };

  return c.json<ApiSuccessResponse<PromptData>>({ success: true, data });
});

/**
 * POST /api/prompts/:id/versions
 * Publish a new immutable version of the prompt.
 */
promptsRouter.post('/:id/versions', zValidator('json', promptVersionCreateSchema), async (c) => {
  const user = c.get('user');
  const db = createDb(c.env.DB);
  const id = c.req.param('id');
  const input = c.req.valid('json');

  const promptRow = (
    await db
      .select()
      .from(prompts)
      .where(and(eq(prompts.id, id), eq(prompts.userId, user.id)))
      .limit(1)
  )[0];

  if (!promptRow) {
    return c.json({ success: false, error: { code: 'NOT_FOUND', message: 'Prompt not found' } }, 404);
  }

  const newVersionNumber = promptRow.currentVersion + 1;
  const versionId = `prv_${crypto.randomUUID()}`;
  const now = new Date();

  const variables = extractVariables(input.template, input.systemPrompt, input.variables);

  await db.insert(promptVersions).values({
    id: versionId,
    userId: user.id,
    promptId: id,
    version: newVersionNumber,
    systemPrompt: input.systemPrompt || null,
    template: input.template,
    variables: JSON.stringify(variables),
    changeNotes: input.changeNotes || `Version ${newVersionNumber}`,
    createdAt: now,
  });

  await db
    .update(prompts)
    .set({
      currentVersion: newVersionNumber,
      updatedAt: now,
    })
    .where(eq(prompts.id, id));

  const data: PromptVersionData = {
    id: versionId,
    userId: user.id,
    promptId: id,
    version: newVersionNumber,
    systemPrompt: input.systemPrompt || null,
    template: input.template,
    variables,
    changeNotes: input.changeNotes || `Version ${newVersionNumber}`,
    createdAt: now.getTime(),
  };

  return c.json<ApiSuccessResponse<PromptVersionData>>({ success: true, data }, 201);
});

/**
 * DELETE /api/prompts/:id
 * Delete prompt and all versions.
 */
promptsRouter.delete('/:id', async (c) => {
  const user = c.get('user');
  const db = createDb(c.env.DB);
  const id = c.req.param('id');

  const existing = (
    await db
      .select({ id: prompts.id })
      .from(prompts)
      .where(and(eq(prompts.id, id), eq(prompts.userId, user.id)))
      .limit(1)
  )[0];

  if (!existing) {
    return c.json({ success: false, error: { code: 'NOT_FOUND', message: 'Prompt not found' } }, 404);
  }

  await db.delete(prompts).where(eq(prompts.id, id));

  return c.json<ApiSuccessResponse<{ id: string }>>({ success: true, data: { id } });
});
