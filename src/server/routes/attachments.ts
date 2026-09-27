import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import { eq, and } from 'drizzle-orm';
import { createDb } from '../db/client';
import { attachmentMeta } from '../db/schema';
import { requireAuth } from '../middleware/auth';
import { attachmentMetaCreateSchema } from '../../shared/schemas/platform';
import type { ApiSuccessResponse, AttachmentMetaData, EntityType } from '../../shared/types';
import type { AppBindings } from '../index';

export const attachmentsRouter = new Hono<{ Bindings: AppBindings }>();

attachmentsRouter.use('*', requireAuth);

const ALLOWED_MIME_TYPES = new Set([
  'application/pdf',
  'image/png',
  'image/jpeg',
  'image/webp',
  'text/csv',
  'application/json',
]);

const MAX_FILE_SIZE_BYTES = 10 * 1024 * 1024; // 10MB

/**
 * GET /api/attachments
 * Returns attachment metadata records for the authenticated user.
 */
attachmentsRouter.get('/', async (c) => {
  const user = c.get('user');
  const db = createDb(c.env.DB);
  const entityType = c.req.query('entityType') as EntityType | undefined;
  const entityId = c.req.query('entityId');

  const conditions = [eq(attachmentMeta.userId, user.id)];
  if (entityType) {
    conditions.push(eq(attachmentMeta.entityType, entityType));
  }
  if (entityId) {
    conditions.push(eq(attachmentMeta.entityId, entityId));
  }

  const rows = await db
    .select()
    .from(attachmentMeta)
    .where(and(...conditions))
    .orderBy(attachmentMeta.createdAt);

  const data: AttachmentMetaData[] = rows.map((r) => ({
    id: r.id,
    userId: r.userId,
    entityType: r.entityType as EntityType,
    entityId: r.entityId,
    fileName: r.fileName,
    fileSize: r.fileSize,
    mimeType: r.mimeType,
    storageProvider: r.storageProvider as 'deferred' | 'local_stub',
    storageKey: r.storageKey,
    sha256: r.sha256,
    createdAt: r.createdAt.getTime(),
  }));

  return c.json<ApiSuccessResponse<AttachmentMetaData[]>>({
    success: true,
    data,
  });
});

/**
 * POST /api/attachments
 * Records attachment metadata with validation.
 */
attachmentsRouter.post('/', zValidator('json', attachmentMetaCreateSchema), async (c) => {
  const user = c.get('user');
  const db = createDb(c.env.DB);
  const input = c.req.valid('json');

  if (!ALLOWED_MIME_TYPES.has(input.mimeType)) {
    return c.json(
      {
        success: false,
        error: {
          code: 'INVALID_FILE_TYPE',
          message: `MIME type ${input.mimeType} is not permitted. Allowed: PDF, PNG, JPEG, WEBP, CSV, JSON`,
        },
      },
      400
    );
  }

  if (input.fileSize > MAX_FILE_SIZE_BYTES) {
    return c.json(
      {
        success: false,
        error: {
          code: 'FILE_TOO_LARGE',
          message: `File size exceeds 10MB limit`,
        },
      },
      400
    );
  }

  const id = `att_${crypto.randomUUID()}`;
  const now = new Date();
  const storageKey = `users/${user.id}/attachments/${id}_${encodeURIComponent(input.fileName)}`;

  await db.insert(attachmentMeta).values({
    id,
    userId: user.id,
    entityType: input.entityType,
    entityId: input.entityId,
    fileName: input.fileName,
    fileSize: input.fileSize,
    mimeType: input.mimeType,
    storageProvider: 'deferred',
    storageKey,
    sha256: input.sha256 || null,
    createdAt: now,
  });

  const data: AttachmentMetaData = {
    id,
    userId: user.id,
    entityType: input.entityType,
    entityId: input.entityId,
    fileName: input.fileName,
    fileSize: input.fileSize,
    mimeType: input.mimeType,
    storageProvider: 'deferred',
    storageKey,
    sha256: input.sha256 || null,
    createdAt: now.getTime(),
  };

  return c.json<ApiSuccessResponse<AttachmentMetaData>>({ success: true, data }, 201);
});

/**
 * GET /api/attachments/:id/download
 * Authorized private file download endpoint with ownership check
 */
attachmentsRouter.get('/:id/download', async (c) => {
  const user = c.get('user');
  const db = createDb(c.env.DB);
  const id = c.req.param('id');

  const record = (
    await db
      .select()
      .from(attachmentMeta)
      .where(and(eq(attachmentMeta.id, id), eq(attachmentMeta.userId, user.id)))
      .limit(1)
  )[0];

  if (!record) {
    return c.json(
      { success: false, error: { code: 'NOT_FOUND', message: 'Attachment not found or access denied' } },
      404
    );
  }

  // Safe file disposition name
  const safeFilename = record.fileName.replace(/[^a-zA-Z0-9._-]/g, '_');

  return new Response(`[Private File Content: ${record.fileName}]`, {
    status: 200,
    headers: {
      'Content-Type': record.mimeType,
      'Content-Disposition': `attachment; filename="${safeFilename}"`,
      'Cache-Control': 'private, no-cache, no-store, must-revalidate',
      'X-Content-Type-Options': 'nosniff',
    },
  });
});

/**
 * DELETE /api/attachments/:id
 */
attachmentsRouter.delete('/:id', async (c) => {
  const user = c.get('user');
  const db = createDb(c.env.DB);
  const id = c.req.param('id');

  const existing = (
    await db
      .select()
      .from(attachmentMeta)
      .where(and(eq(attachmentMeta.id, id), eq(attachmentMeta.userId, user.id)))
      .limit(1)
  )[0];

  if (!existing) {
    return c.json(
      { success: false, error: { code: 'NOT_FOUND', message: 'Attachment metadata not found' } },
      404
    );
  }

  await db.delete(attachmentMeta).where(and(eq(attachmentMeta.id, id), eq(attachmentMeta.userId, user.id)));

  return c.json<ApiSuccessResponse<{ id: string }>>({
    success: true,
    data: { id },
  });
});

