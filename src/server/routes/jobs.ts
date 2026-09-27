import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import { z } from 'zod';
import { eq, and, desc } from 'drizzle-orm';
import { createDb } from '../db/client';
import { importExportJobs } from '../db/schema';
import { requireAuth } from '../middleware/auth';
import { domainEnum } from '../../shared/platformTypes';
import type { ApiSuccessResponse, ImportExportJobData, JobType, JobFormat, JobStatus, CategoryDomain } from '../../shared/types';
import type { AppBindings } from '../index';

export const jobsRouter = new Hono<{ Bindings: AppBindings }>();

jobsRouter.use('*', requireAuth);

const createJobSchema = z.object({
  type: z.enum(['import', 'export']),
  domain: z.enum([...domainEnum, 'all']),
  format: z.enum(['json', 'csv']),
});

/**
 * GET /api/jobs
 * Lists import/export job records for authenticated user.
 */
jobsRouter.get('/', async (c) => {
  const user = c.get('user');
  const db = createDb(c.env.DB);

  const rows = await db
    .select()
    .from(importExportJobs)
    .where(eq(importExportJobs.userId, user.id))
    .orderBy(desc(importExportJobs.createdAt))
    .limit(50);

  const data: ImportExportJobData[] = rows.map((r) => ({
    id: r.id,
    userId: r.userId,
    type: r.type as JobType,
    domain: r.domain as CategoryDomain | 'all',
    format: r.format as JobFormat,
    status: r.status as JobStatus,
    totalItems: r.totalItems,
    processedItems: r.processedItems,
    errorCount: r.errorCount,
    errorDetails: r.errorDetails ? JSON.parse(r.errorDetails) : null,
    summary: r.summary ? JSON.parse(r.summary) : null,
    createdAt: r.createdAt.getTime(),
    completedAt: r.completedAt ? r.completedAt.getTime() : null,
  }));

  return c.json<ApiSuccessResponse<ImportExportJobData[]>>({
    success: true,
    data,
  });
});

/**
 * GET /api/jobs/:id
 */
jobsRouter.get('/:id', async (c) => {
  const user = c.get('user');
  const db = createDb(c.env.DB);
  const id = c.req.param('id');

  const job = (
    await db
      .select()
      .from(importExportJobs)
      .where(and(eq(importExportJobs.id, id), eq(importExportJobs.userId, user.id)))
      .limit(1)
  )[0];

  if (!job) {
    return c.json(
      { success: false, error: { code: 'NOT_FOUND', message: 'Job not found' } },
      404
    );
  }

  const data: ImportExportJobData = {
    id: job.id,
    userId: job.userId,
    type: job.type as JobType,
    domain: job.domain as CategoryDomain | 'all',
    format: job.format as JobFormat,
    status: job.status as JobStatus,
    totalItems: job.totalItems,
    processedItems: job.processedItems,
    errorCount: job.errorCount,
    errorDetails: job.errorDetails ? JSON.parse(job.errorDetails) : null,
    summary: job.summary ? JSON.parse(job.summary) : null,
    createdAt: job.createdAt.getTime(),
    completedAt: job.completedAt ? job.completedAt.getTime() : null,
  };

  return c.json<ApiSuccessResponse<ImportExportJobData>>({ success: true, data });
});

/**
 * POST /api/jobs
 * Creates a new job tracking record.
 */
jobsRouter.post('/', zValidator('json', createJobSchema), async (c) => {
  const user = c.get('user');
  const db = createDb(c.env.DB);
  const input = c.req.valid('json');

  const id = `job_${crypto.randomUUID()}`;
  const now = new Date();

  await db.insert(importExportJobs).values({
    id,
    userId: user.id,
    type: input.type,
    domain: input.domain,
    format: input.format,
    status: 'pending',
    totalItems: 0,
    processedItems: 0,
    errorCount: 0,
    createdAt: now,
  });

  const data: ImportExportJobData = {
    id,
    userId: user.id,
    type: input.type,
    domain: input.domain,
    format: input.format,
    status: 'pending',
    totalItems: 0,
    processedItems: 0,
    errorCount: 0,
    errorDetails: null,
    summary: null,
    createdAt: now.getTime(),
    completedAt: null,
  };

  return c.json<ApiSuccessResponse<ImportExportJobData>>({ success: true, data }, 201);
});
