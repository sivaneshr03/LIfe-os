import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import { eq, and, desc, gte, lte } from 'drizzle-orm';
import { z } from 'zod';
import { createDb } from '../db/client';
import { dailyNotes } from '../db/schema';
import { requireAuth } from '../middleware/auth';
import { dailyNoteUpsertSchema } from '../../shared/schemas/productivity';
import { isValidCalendarDate } from '../../shared/utils/date';
import type { ApiSuccessResponse, DailyNoteData } from '../../shared/types';
import type { AppBindings } from '../index';

export const dailyNotesRouter = new Hono<{ Bindings: AppBindings }>();

dailyNotesRouter.use('*', requireAuth);

function countWords(text: string): number {
  const trimmed = text.trim();
  if (!trimmed) return 0;
  return trimmed.split(/\s+/).length;
}

/**
 * GET /api/daily-notes
 * Query recent daily notes by date range.
 */
dailyNotesRouter.get(
  '/',
  zValidator(
    'query',
    z.object({
      startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
      endDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
      limit: z.coerce.number().int().min(1).max(100).default(30),
    })
  ),
  async (c) => {
    const user = c.get('user');
    const db = createDb(c.env.DB);
    const { startDate, endDate, limit } = c.req.valid('query');

    const conditions = [eq(dailyNotes.userId, user.id)];

    if (startDate) conditions.push(gte(dailyNotes.date, startDate));
    if (endDate) conditions.push(lte(dailyNotes.date, endDate));

    const rows = await db
      .select()
      .from(dailyNotes)
      .where(and(...conditions))
      .orderBy(desc(dailyNotes.date))
      .limit(limit);

    const data: DailyNoteData[] = rows.map((r) => ({
      id: r.id,
      userId: r.userId,
      date: r.date,
      content: r.content,
      summary: r.summary,
      mood: r.mood,
      energy: r.energy,
      wordCount: r.wordCount,
      isPinned: Boolean(r.isPinned),
      createdAt: r.createdAt.getTime(),
      updatedAt: r.updatedAt.getTime(),
    }));

    return c.json<ApiSuccessResponse<DailyNoteData[]>>({ success: true, data });
  }
);

/**
 * GET /api/daily-notes/:date
 * Retrieve the daily note for a specific calendar date (YYYY-MM-DD).
 */
dailyNotesRouter.get('/:date', async (c) => {
  const user = c.get('user');
  const db = createDb(c.env.DB);
  const date = c.req.param('date');

  if (!isValidCalendarDate(date)) {
    return c.json(
      { success: false, error: { code: 'BAD_REQUEST', message: 'Date must be a valid YYYY-MM-DD' } },
      400
    );
  }

  const row = (
    await db
      .select()
      .from(dailyNotes)
      .where(and(eq(dailyNotes.userId, user.id), eq(dailyNotes.date, date)))
      .limit(1)
  )[0];

  if (!row) {
    return c.json(
      { success: false, error: { code: 'NOT_FOUND', message: `Daily note for ${date} not found` } },
      404
    );
  }

  const data: DailyNoteData = {
    id: row.id,
    userId: row.userId,
    date: row.date,
    content: row.content,
    summary: row.summary,
    mood: row.mood,
    energy: row.energy,
    wordCount: row.wordCount,
    isPinned: Boolean(row.isPinned),
    createdAt: row.createdAt.getTime(),
    updatedAt: row.updatedAt.getTime(),
  };

  return c.json<ApiSuccessResponse<DailyNoteData>>({ success: true, data });
});

/**
 * PUT /api/daily-notes/:date
 * Upsert daily note for a calendar date (creates if missing, updates if present).
 */
dailyNotesRouter.put('/:date', zValidator('json', dailyNoteUpsertSchema), async (c) => {
  const user = c.get('user');
  const db = createDb(c.env.DB);
  const date = c.req.param('date');
  const input = c.req.valid('json');

  if (!isValidCalendarDate(date)) {
    return c.json(
      { success: false, error: { code: 'BAD_REQUEST', message: 'Date must be a valid YYYY-MM-DD' } },
      400
    );
  }

  const now = new Date();
  const wordCount = countWords(input.content);

  const existing = (
    await db
      .select({ id: dailyNotes.id })
      .from(dailyNotes)
      .where(and(eq(dailyNotes.userId, user.id), eq(dailyNotes.date, date)))
      .limit(1)
  )[0];

  let id: string;

  if (existing) {
    id = existing.id;
    await db
      .update(dailyNotes)
      .set({
        content: input.content,
        summary: input.summary ?? null,
        mood: input.mood ?? null,
        energy: input.energy ?? null,
        wordCount,
        isPinned: input.isPinned ? 1 : 0,
        updatedAt: now,
      })
      .where(eq(dailyNotes.id, id));
  } else {
    id = `dnt_${crypto.randomUUID()}`;
    await db.insert(dailyNotes).values({
      id,
      userId: user.id,
      date,
      content: input.content,
      summary: input.summary ?? null,
      mood: input.mood ?? null,
      energy: input.energy ?? null,
      wordCount,
      isPinned: input.isPinned ? 1 : 0,
      createdAt: now,
      updatedAt: now,
    });
  }

  const saved = (await db.select().from(dailyNotes).where(eq(dailyNotes.id, id)).limit(1))[0];

  const data: DailyNoteData = {
    id: saved.id,
    userId: saved.userId,
    date: saved.date,
    content: saved.content,
    summary: saved.summary,
    mood: saved.mood,
    energy: saved.energy,
    wordCount: saved.wordCount,
    isPinned: Boolean(saved.isPinned),
    createdAt: saved.createdAt.getTime(),
    updatedAt: saved.updatedAt.getTime(),
  };

  return c.json<ApiSuccessResponse<DailyNoteData>>({ success: true, data });
});
