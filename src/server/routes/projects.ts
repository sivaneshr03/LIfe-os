import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import { eq, and, sql } from 'drizzle-orm';
import { createDb } from '../db/client';
import { projects, boards, boardColumns } from '../db/schema';
import { requireAuth } from '../middleware/auth';
import { projectCreateSchema, projectUpdateSchema } from '../../shared/schemas/productivity';
import { slugify } from '../../shared/utils/pagination';
import type { ApiSuccessResponse, ProjectData, ProjectStatus } from '../../shared/types';
import type { AppBindings } from '../index';

export const projectsRouter = new Hono<{ Bindings: AppBindings }>();

projectsRouter.use('*', requireAuth);

/**
 * GET /api/projects
 * Lists all projects for user with open and completed task counts.
 */
projectsRouter.get('/', async (c) => {
  const user = c.get('user');
  const db = createDb(c.env.DB);

  const rows = await db
    .select({
      project: projects,
      openCount: sql<number>`(SELECT count(*) FROM tasks WHERE tasks.project_id = ${projects.id} AND tasks.status NOT IN ('done', 'archived'))`,
      completedCount: sql<number>`(SELECT count(*) FROM tasks WHERE tasks.project_id = ${projects.id} AND tasks.status = 'done')`,
    })
    .from(projects)
    .where(eq(projects.userId, user.id))
    .orderBy(projects.sortOrder, projects.createdAt);

  const data: ProjectData[] = rows.map(({ project, openCount, completedCount }) => ({
    id: project.id,
    userId: project.userId,
    categoryId: project.categoryId,
    name: project.name,
    slug: project.slug,
    description: project.description,
    color: project.color,
    icon: project.icon,
    status: project.status as ProjectStatus,
    targetDate: project.targetDate,
    sortOrder: project.sortOrder,
    openTaskCount: Number(openCount || 0),
    completedTaskCount: Number(completedCount || 0),
    createdAt: project.createdAt.getTime(),
    updatedAt: project.updatedAt.getTime(),
  }));

  return c.json<ApiSuccessResponse<ProjectData[]>>({ success: true, data });
});

/**
 * POST /api/projects
 * Creates a new project and an initial default Kanban board.
 */
projectsRouter.post('/', zValidator('json', projectCreateSchema), async (c) => {
  const user = c.get('user');
  const db = createDb(c.env.DB);
  const input = c.req.valid('json');

  const slug = slugify(input.name);

  // Check unique slug for user
  const existing = (
    await db
      .select({ id: projects.id })
      .from(projects)
      .where(and(eq(projects.userId, user.id), eq(projects.slug, slug)))
      .limit(1)
  )[0];

  if (existing) {
    return c.json(
      { success: false, error: { code: 'DUPLICATE_PROJECT', message: `Project '${input.name}' already exists` } },
      409
    );
  }

  const projectId = `proj_${crypto.randomUUID()}`;
  const now = new Date();

  await db.insert(projects).values({
    id: projectId,
    userId: user.id,
    categoryId: input.categoryId || null,
    name: input.name,
    slug,
    description: input.description || null,
    color: input.color || '#3b82f6',
    icon: input.icon || 'folder',
    status: 'active',
    targetDate: input.targetDate || null,
    sortOrder: input.sortOrder || 0,
    createdAt: now,
    updatedAt: now,
  });

  // Create default Kanban board for this project
  const boardId = `brd_${crypto.randomUUID()}`;
  await db.insert(boards).values({
    id: boardId,
    userId: user.id,
    projectId,
    name: `${input.name} Board`,
    isDefault: 1,
    createdAt: now,
    updatedAt: now,
  });

  // Create default board columns: Backlog, Todo, In Progress, Done
  const defaultCols = [
    { name: 'To Do', status: 'todo' as const, sortOrder: 0, color: '#94a3b8' },
    { name: 'In Progress', status: 'in_progress' as const, sortOrder: 1, color: '#3b82f6' },
    { name: 'Blocked', status: 'blocked' as const, sortOrder: 2, color: '#ef4444' },
    { name: 'Done', status: 'done' as const, sortOrder: 3, color: '#10b981' },
  ];

  for (const col of defaultCols) {
    await db.insert(boardColumns).values({
      id: `col_${crypto.randomUUID()}`,
      userId: user.id,
      boardId,
      name: col.name,
      statusMapping: col.status,
      color: col.color,
      sortOrder: col.sortOrder,
      createdAt: now,
      updatedAt: now,
    });
  }

  const created: ProjectData = {
    id: projectId,
    userId: user.id,
    categoryId: input.categoryId || null,
    name: input.name,
    slug,
    description: input.description || null,
    color: input.color || '#3b82f6',
    icon: input.icon || 'folder',
    status: 'active',
    targetDate: input.targetDate || null,
    sortOrder: input.sortOrder || 0,
    openTaskCount: 0,
    completedTaskCount: 0,
    boardId,
    createdAt: now.getTime(),
    updatedAt: now.getTime(),
  };

  return c.json<ApiSuccessResponse<ProjectData>>({ success: true, data: created }, 201);
});

/**
 * PATCH /api/projects/:id
 */
projectsRouter.patch('/:id', zValidator('json', projectUpdateSchema), async (c) => {
  const user = c.get('user');
  const db = createDb(c.env.DB);
  const id = c.req.param('id');
  const input = c.req.valid('json');

  const existing = (
    await db
      .select()
      .from(projects)
      .where(and(eq(projects.id, id), eq(projects.userId, user.id)))
      .limit(1)
  )[0];

  if (!existing) {
    return c.json({ success: false, error: { code: 'NOT_FOUND', message: 'Project not found' } }, 404);
  }

  const updateValues: Record<string, unknown> = { updatedAt: new Date() };

  if (input.name !== undefined) {
    updateValues.name = input.name;
    updateValues.slug = slugify(input.name);
  }
  if (input.categoryId !== undefined) updateValues.categoryId = input.categoryId;
  if (input.description !== undefined) updateValues.description = input.description;
  if (input.color !== undefined) updateValues.color = input.color;
  if (input.icon !== undefined) updateValues.icon = input.icon;
  if (input.status !== undefined) updateValues.status = input.status;
  if (input.targetDate !== undefined) updateValues.targetDate = input.targetDate;
  if (input.sortOrder !== undefined) updateValues.sortOrder = input.sortOrder;

  await db
    .update(projects)
    .set(updateValues)
    .where(and(eq(projects.id, id), eq(projects.userId, user.id)));

  const updated = (
    await db
      .select()
      .from(projects)
      .where(eq(projects.id, id))
      .limit(1)
  )[0];

  const data: ProjectData = {
    id: updated.id,
    userId: updated.userId,
    categoryId: updated.categoryId,
    name: updated.name,
    slug: updated.slug,
    description: updated.description,
    color: updated.color,
    icon: updated.icon,
    status: updated.status as ProjectStatus,
    targetDate: updated.targetDate,
    sortOrder: updated.sortOrder,
    createdAt: updated.createdAt.getTime(),
    updatedAt: updated.updatedAt.getTime(),
  };

  return c.json<ApiSuccessResponse<ProjectData>>({ success: true, data });
});

/**
 * DELETE /api/projects/:id
 */
projectsRouter.delete('/:id', async (c) => {
  const user = c.get('user');
  const db = createDb(c.env.DB);
  const id = c.req.param('id');

  const existing = (
    await db
      .select()
      .from(projects)
      .where(and(eq(projects.id, id), eq(projects.userId, user.id)))
      .limit(1)
  )[0];

  if (!existing) {
    return c.json({ success: false, error: { code: 'NOT_FOUND', message: 'Project not found' } }, 404);
  }

  await db.delete(projects).where(and(eq(projects.id, id), eq(projects.userId, user.id)));

  return c.json<ApiSuccessResponse<{ id: string }>>({ success: true, data: { id } });
});
