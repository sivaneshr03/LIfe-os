import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import { eq, and, sql, desc, like, or } from 'drizzle-orm';
import { createDb } from '../db/client';
import { notes } from '../db/schema';
import { requireAuth } from '../middleware/auth';
import {
  noteCreateSchema,
  noteUpdateSchema,
  noteQuerySchema,
} from '../../shared/schemas/productivity';
import { slugify } from '../../shared/utils/pagination';
import type { ApiSuccessResponse, ApiPaginatedResponse, NoteData } from '../../shared/types';
import type { AppBindings } from '../index';

export const notesRouter = new Hono<{ Bindings: AppBindings }>();

notesRouter.use('*', requireAuth);

function calculateNoteMetrics(content: string): { wordCount: number; readingTimeMinutes: number } {
  const trimmed = content.trim();
  if (!trimmed) return { wordCount: 0, readingTimeMinutes: 0 };
  const wordCount = trimmed.split(/\s+/).length;
  const readingTimeMinutes = Math.max(1, Math.ceil(wordCount / 200));
  return { wordCount, readingTimeMinutes };
}

/**
 * GET /api/notes
 * Paginated list of notes with category, project, archive, pin, and text search filters.
 */
notesRouter.get('/', zValidator('query', noteQuerySchema), async (c) => {
  const user = c.get('user');
  const db = createDb(c.env.DB);
  const q = c.req.valid('query');

  const conditions = [eq(notes.userId, user.id)];

  if (q.categoryId) {
    conditions.push(eq(notes.categoryId, q.categoryId));
  }

  if (q.projectId) {
    conditions.push(eq(notes.projectId, q.projectId));
  }

  if (q.isArchived !== undefined) {
    conditions.push(eq(notes.isArchived, q.isArchived ? 1 : 0));
  } else {
    // By default exclude archived notes unless explicitly requested
    conditions.push(eq(notes.isArchived, 0));
  }

  if (q.isPinned !== undefined) {
    conditions.push(eq(notes.isPinned, q.isPinned ? 1 : 0));
  }

  if (q.q && q.q.trim().length > 0) {
    const term = `%${q.q.trim()}%`;
    conditions.push(or(like(notes.title, term), like(notes.content, term), like(notes.summary, term))!);
  }

  const whereClause = and(...conditions);

  const countRes = await db
    .select({ count: sql<number>`count(*)` })
    .from(notes)
    .where(whereClause);
  const total = Number(countRes[0]?.count || 0);

  const offset = (q.page - 1) * q.pageSize;

  const rows = await db
    .select()
    .from(notes)
    .where(whereClause)
    .orderBy(desc(notes.isPinned), desc(notes.updatedAt))
    .limit(q.pageSize)
    .offset(offset);

  const items: NoteData[] = rows.map((r) => ({
    id: r.id,
    userId: r.userId,
    categoryId: r.categoryId,
    projectId: r.projectId,
    parentNoteId: r.parentNoteId,
    title: r.title,
    slug: r.slug,
    content: r.content,
    summary: r.summary,
    isPinned: Boolean(r.isPinned),
    isArchived: Boolean(r.isArchived),
    wordCount: r.wordCount,
    readingTimeMinutes: r.readingTimeMinutes,
    createdAt: r.createdAt.getTime(),
    updatedAt: r.updatedAt.getTime(),
  }));

  return c.json<ApiPaginatedResponse<NoteData>>({
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
 * POST /api/notes
 * Create a new note.
 */
notesRouter.post('/', zValidator('json', noteCreateSchema), async (c) => {
  const user = c.get('user');
  const db = createDb(c.env.DB);
  const input = c.req.valid('json');

  const baseSlug = slugify(input.title) || 'note';
  // Ensure unique slug per user
  const existing = await db
    .select({ slug: notes.slug })
    .from(notes)
    .where(and(eq(notes.userId, user.id), like(notes.slug, `${baseSlug}%`)));

  let slug = baseSlug;
  if (existing.some((r) => r.slug === slug)) {
    slug = `${baseSlug}-${Date.now().toString(36)}`;
  }

  const { wordCount, readingTimeMinutes } = calculateNoteMetrics(input.content || '');
  const id = `not_${crypto.randomUUID()}`;
  const now = new Date();

  await db.insert(notes).values({
    id,
    userId: user.id,
    categoryId: input.categoryId || null,
    projectId: input.projectId || null,
    parentNoteId: input.parentNoteId || null,
    title: input.title,
    slug,
    content: input.content || '',
    summary: input.summary || null,
    isPinned: input.isPinned ? 1 : 0,
    isArchived: 0,
    wordCount,
    readingTimeMinutes,
    createdAt: now,
    updatedAt: now,
  });

  const data: NoteData = {
    id,
    userId: user.id,
    categoryId: input.categoryId || null,
    projectId: input.projectId || null,
    parentNoteId: input.parentNoteId || null,
    title: input.title,
    slug,
    content: input.content || '',
    summary: input.summary || null,
    isPinned: Boolean(input.isPinned),
    isArchived: false,
    wordCount,
    readingTimeMinutes,
    createdAt: now.getTime(),
    updatedAt: now.getTime(),
  };

  return c.json<ApiSuccessResponse<NoteData>>({ success: true, data }, 201);
});

/**
 * GET /api/notes/:id
 * Retrieve a single note.
 */
notesRouter.get('/:id', async (c) => {
  const user = c.get('user');
  const db = createDb(c.env.DB);
  const id = c.req.param('id');

  const row = (
    await db
      .select()
      .from(notes)
      .where(and(eq(notes.id, id), eq(notes.userId, user.id)))
      .limit(1)
  )[0];

  if (!row) {
    return c.json({ success: false, error: { code: 'NOT_FOUND', message: 'Note not found' } }, 404);
  }

  const data: NoteData = {
    id: row.id,
    userId: row.userId,
    categoryId: row.categoryId,
    projectId: row.projectId,
    parentNoteId: row.parentNoteId,
    title: row.title,
    slug: row.slug,
    content: row.content,
    summary: row.summary,
    isPinned: Boolean(row.isPinned),
    isArchived: Boolean(row.isArchived),
    wordCount: row.wordCount,
    readingTimeMinutes: row.readingTimeMinutes,
    createdAt: row.createdAt.getTime(),
    updatedAt: row.updatedAt.getTime(),
  };

  return c.json<ApiSuccessResponse<NoteData>>({ success: true, data });
});

/**
 * PATCH /api/notes/:id
 * Update a note.
 */
notesRouter.patch('/:id', zValidator('json', noteUpdateSchema), async (c) => {
  const user = c.get('user');
  const db = createDb(c.env.DB);
  const id = c.req.param('id');
  const input = c.req.valid('json');

  const existing = (
    await db
      .select()
      .from(notes)
      .where(and(eq(notes.id, id), eq(notes.userId, user.id)))
      .limit(1)
  )[0];

  if (!existing) {
    return c.json({ success: false, error: { code: 'NOT_FOUND', message: 'Note not found' } }, 404);
  }

  const now = new Date();
  const updateData: Partial<typeof notes.$inferInsert> = {
    updatedAt: now,
  };

  if (input.title !== undefined) {
    updateData.title = input.title;
    updateData.slug = slugify(input.title) || existing.slug;
  }
  if (input.categoryId !== undefined) updateData.categoryId = input.categoryId;
  if (input.projectId !== undefined) updateData.projectId = input.projectId;
  if (input.parentNoteId !== undefined) updateData.parentNoteId = input.parentNoteId;
  if (input.summary !== undefined) updateData.summary = input.summary;
  if (input.isPinned !== undefined) updateData.isPinned = input.isPinned ? 1 : 0;
  if (input.isArchived !== undefined) updateData.isArchived = input.isArchived ? 1 : 0;

  if (input.content !== undefined) {
    updateData.content = input.content;
    const { wordCount, readingTimeMinutes } = calculateNoteMetrics(input.content);
    updateData.wordCount = wordCount;
    updateData.readingTimeMinutes = readingTimeMinutes;
  }

  await db.update(notes).set(updateData).where(eq(notes.id, id));

  const updated = (await db.select().from(notes).where(eq(notes.id, id)).limit(1))[0];

  const data: NoteData = {
    id: updated.id,
    userId: updated.userId,
    categoryId: updated.categoryId,
    projectId: updated.projectId,
    parentNoteId: updated.parentNoteId,
    title: updated.title,
    slug: updated.slug,
    content: updated.content,
    summary: updated.summary,
    isPinned: Boolean(updated.isPinned),
    isArchived: Boolean(updated.isArchived),
    wordCount: updated.wordCount,
    readingTimeMinutes: updated.readingTimeMinutes,
    createdAt: updated.createdAt.getTime(),
    updatedAt: updated.updatedAt.getTime(),
  };

  return c.json<ApiSuccessResponse<NoteData>>({ success: true, data });
});

/**
 * DELETE /api/notes/:id
 * Delete a note.
 */
notesRouter.delete('/:id', async (c) => {
  const user = c.get('user');
  const db = createDb(c.env.DB);
  const id = c.req.param('id');

  const existing = (
    await db
      .select({ id: notes.id })
      .from(notes)
      .where(and(eq(notes.id, id), eq(notes.userId, user.id)))
      .limit(1)
  )[0];

  if (!existing) {
    return c.json({ success: false, error: { code: 'NOT_FOUND', message: 'Note not found' } }, 404);
  }

  await db.delete(notes).where(eq(notes.id, id));

  return c.json<ApiSuccessResponse<{ id: string }>>({ success: true, data: { id } });
});
