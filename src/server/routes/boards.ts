import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import { eq, and } from 'drizzle-orm';
import { createDb } from '../db/client';
import { boards, boardColumns } from '../db/schema';
import { requireAuth } from '../middleware/auth';
import {
  boardCreateSchema,
  boardColumnCreateSchema,
  boardColumnUpdateSchema,
} from '../../shared/schemas/productivity';
import type {
  ApiSuccessResponse,
  BoardData,
  BoardColumnData,
  TaskStatus,
} from '../../shared/types';
import type { AppBindings } from '../index';

export const boardsRouter = new Hono<{ Bindings: AppBindings }>();

boardsRouter.use('*', requireAuth);

/**
 * GET /api/boards
 * Lists all boards for the authenticated user, including columns.
 */
boardsRouter.get('/', async (c) => {
  const user = c.get('user');
  const db = createDb(c.env.DB);

  const boardRows = await db
    .select()
    .from(boards)
    .where(eq(boards.userId, user.id))
    .orderBy(boards.createdAt);

  const allColumns = await db
    .select()
    .from(boardColumns)
    .where(eq(boardColumns.userId, user.id))
    .orderBy(boardColumns.sortOrder);

  const columnsByBoard = new Map<string, BoardColumnData[]>();
  for (const col of allColumns) {
    const list = columnsByBoard.get(col.boardId) || [];
    list.push({
      id: col.id,
      userId: col.userId,
      boardId: col.boardId,
      name: col.name,
      statusMapping: col.statusMapping as TaskStatus,
      color: col.color,
      wipLimit: col.wipLimit,
      sortOrder: col.sortOrder,
      createdAt: col.createdAt.getTime(),
      updatedAt: col.updatedAt.getTime(),
    });
    columnsByBoard.set(col.boardId, list);
  }

  const data: BoardData[] = boardRows.map((board) => ({
    id: board.id,
    userId: board.userId,
    projectId: board.projectId,
    name: board.name,
    description: board.description,
    isDefault: Boolean(board.isDefault),
    columns: columnsByBoard.get(board.id) || [],
    createdAt: board.createdAt.getTime(),
    updatedAt: board.updatedAt.getTime(),
  }));

  return c.json<ApiSuccessResponse<BoardData[]>>({ success: true, data });
});

/**
 * GET /api/boards/:id
 * Retrieves board with its columns and tasks organized by column.
 */
boardsRouter.get('/:id', async (c) => {
  const user = c.get('user');
  const db = createDb(c.env.DB);
  const id = c.req.param('id');

  const board = (
    await db
      .select()
      .from(boards)
      .where(and(eq(boards.id, id), eq(boards.userId, user.id)))
      .limit(1)
  )[0];

  if (!board) {
    return c.json({ success: false, error: { code: 'NOT_FOUND', message: 'Board not found' } }, 404);
  }

  const columns = await db
    .select()
    .from(boardColumns)
    .where(and(eq(boardColumns.boardId, id), eq(boardColumns.userId, user.id)))
    .orderBy(boardColumns.sortOrder);

  const columnData: BoardColumnData[] = columns.map((col) => ({
    id: col.id,
    userId: col.userId,
    boardId: col.boardId,
    name: col.name,
    statusMapping: col.statusMapping as TaskStatus,
    color: col.color,
    wipLimit: col.wipLimit,
    sortOrder: col.sortOrder,
    createdAt: col.createdAt.getTime(),
    updatedAt: col.updatedAt.getTime(),
  }));

  const data: BoardData = {
    id: board.id,
    userId: board.userId,
    projectId: board.projectId,
    name: board.name,
    description: board.description,
    isDefault: Boolean(board.isDefault),
    columns: columnData,
    createdAt: board.createdAt.getTime(),
    updatedAt: board.updatedAt.getTime(),
  };

  return c.json<ApiSuccessResponse<BoardData>>({ success: true, data });
});

/**
 * POST /api/boards
 */
boardsRouter.post('/', zValidator('json', boardCreateSchema), async (c) => {
  const user = c.get('user');
  const db = createDb(c.env.DB);
  const input = c.req.valid('json');

  const id = `brd_${crypto.randomUUID()}`;
  const now = new Date();

  await db.insert(boards).values({
    id,
    userId: user.id,
    projectId: input.projectId || null,
    name: input.name,
    description: input.description || null,
    isDefault: input.isDefault ? 1 : 0,
    createdAt: now,
    updatedAt: now,
  });

  const created: BoardData = {
    id,
    userId: user.id,
    projectId: input.projectId || null,
    name: input.name,
    description: input.description || null,
    isDefault: Boolean(input.isDefault),
    createdAt: now.getTime(),
    updatedAt: now.getTime(),
  };

  return c.json<ApiSuccessResponse<BoardData>>({ success: true, data: created }, 201);
});

/**
 * POST /api/boards/:id/columns
 */
boardsRouter.post('/:id/columns', zValidator('json', boardColumnCreateSchema), async (c) => {
  const user = c.get('user');
  const db = createDb(c.env.DB);
  const boardId = c.req.param('id');
  const input = c.req.valid('json');

  const board = (
    await db
      .select({ id: boards.id })
      .from(boards)
      .where(and(eq(boards.id, boardId), eq(boards.userId, user.id)))
      .limit(1)
  )[0];

  if (!board) {
    return c.json({ success: false, error: { code: 'NOT_FOUND', message: 'Board not found' } }, 404);
  }

  const id = `col_${crypto.randomUUID()}`;
  const now = new Date();

  await db.insert(boardColumns).values({
    id,
    userId: user.id,
    boardId,
    name: input.name,
    statusMapping: input.statusMapping,
    color: input.color || null,
    wipLimit: input.wipLimit || null,
    sortOrder: input.sortOrder || 0,
    createdAt: now,
    updatedAt: now,
  });

  const created: BoardColumnData = {
    id,
    userId: user.id,
    boardId,
    name: input.name,
    statusMapping: input.statusMapping,
    color: input.color || null,
    wipLimit: input.wipLimit || null,
    sortOrder: input.sortOrder || 0,
    createdAt: now.getTime(),
    updatedAt: now.getTime(),
  };

  return c.json<ApiSuccessResponse<BoardColumnData>>({ success: true, data: created }, 201);
});

/**
 * PATCH /api/boards/columns/:colId
 */
boardsRouter.patch('/columns/:colId', zValidator('json', boardColumnUpdateSchema), async (c) => {
  const user = c.get('user');
  const db = createDb(c.env.DB);
  const colId = c.req.param('colId');
  const input = c.req.valid('json');

  const existing = (
    await db
      .select()
      .from(boardColumns)
      .where(and(eq(boardColumns.id, colId), eq(boardColumns.userId, user.id)))
      .limit(1)
  )[0];

  if (!existing) {
    return c.json({ success: false, error: { code: 'NOT_FOUND', message: 'Column not found' } }, 404);
  }

  const updateValues: Record<string, unknown> = { updatedAt: new Date() };
  if (input.name !== undefined) updateValues.name = input.name;
  if (input.statusMapping !== undefined) updateValues.statusMapping = input.statusMapping;
  if (input.color !== undefined) updateValues.color = input.color;
  if (input.wipLimit !== undefined) updateValues.wipLimit = input.wipLimit;
  if (input.sortOrder !== undefined) updateValues.sortOrder = input.sortOrder;

  await db
    .update(boardColumns)
    .set(updateValues)
    .where(and(eq(boardColumns.id, colId), eq(boardColumns.userId, user.id)));

  const updated = (
    await db
      .select()
      .from(boardColumns)
      .where(eq(boardColumns.id, colId))
      .limit(1)
  )[0];

  const data: BoardColumnData = {
    id: updated.id,
    userId: updated.userId,
    boardId: updated.boardId,
    name: updated.name,
    statusMapping: updated.statusMapping as TaskStatus,
    color: updated.color,
    wipLimit: updated.wipLimit,
    sortOrder: updated.sortOrder,
    createdAt: updated.createdAt.getTime(),
    updatedAt: updated.updatedAt.getTime(),
  };

  return c.json<ApiSuccessResponse<BoardColumnData>>({ success: true, data });
});

/**
 * DELETE /api/boards/columns/:colId
 */
boardsRouter.delete('/columns/:colId', async (c) => {
  const user = c.get('user');
  const db = createDb(c.env.DB);
  const colId = c.req.param('colId');

  await db
    .delete(boardColumns)
    .where(and(eq(boardColumns.id, colId), eq(boardColumns.userId, user.id)));

  return c.json<ApiSuccessResponse<{ id: string }>>({ success: true, data: { id: colId } });
});
