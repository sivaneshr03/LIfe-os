import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import { requireAuth } from '../middleware/auth';
import { createRateLimiter } from '../middleware/rateLimit';
import { logAuditEvent } from '../lib/audit';
import {
  financeImportPreviewSchema,
  financeImportCommitSchema,
  financeExportQuerySchema,
} from '../../shared/schemas/finance';
import {
  previewCsvImport,
  commitCsvImport,
  exportFinanceData,
} from '../services/financeImportExportService';
import type {
  ApiSuccessResponse,
  FinanceImportPreviewData,
  FinanceImportCommitResult,
} from '../../shared/financeTypes';
import type { AppBindings } from '../index';

export const financeImportExportRouter = new Hono<{ Bindings: AppBindings }>();

financeImportExportRouter.use('*', requireAuth);
financeImportExportRouter.use('*', createRateLimiter({ max: 60, windowMs: 60 * 1000 }));

/**
 * POST /api/finance/import/preview
 * Parses CSV and runs validation rules + duplicate detection without database mutation.
 */
financeImportExportRouter.post(
  '/preview',
  zValidator('json', financeImportPreviewSchema),
  async (c) => {
    const user = c.get('user');
    const { accountId, csvData, hasHeader } = c.req.valid('json');

    try {
      const preview = await previewCsvImport(
        c.env.DB,
        user.id,
        accountId,
        csvData,
        hasHeader
      );

      return c.json<ApiSuccessResponse<FinanceImportPreviewData>>({
        success: true,
        data: preview,
      });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to preview CSV import';
      return c.json({ success: false, error: { code: 'BAD_REQUEST', message: msg } }, 400);
    }
  }
);

/**
 * POST /api/finance/import/commit
 * Atomically inserts validated rows and updates account balance.
 */
financeImportExportRouter.post(
  '/commit',
  zValidator('json', financeImportCommitSchema),
  async (c) => {
    const user = c.get('user');
    const { accountId, rows } = c.req.valid('json');

    try {
      const result = await commitCsvImport(c.env.DB, user.id, accountId, rows);

      await logAuditEvent(
        c,
        'finance.csv_import_committed',
        { accountId, importedCount: result.importedCount, skippedCount: result.skippedCount },
        user.id
      );

      return c.json<ApiSuccessResponse<FinanceImportCommitResult>>({
        success: true,
        data: result,
      }, 201);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to commit CSV import';
      return c.json({ success: false, error: { code: 'BAD_REQUEST', message: msg } }, 400);
    }
  }
);

/**
 * GET /api/finance/export
 * Downloads CSV or JSON formatted financial data with proper headers.
 */
financeImportExportRouter.get(
  '/',
  zValidator('query', financeExportQuerySchema),
  async (c) => {
    const user = c.get('user');
    const { format, entity, accountId, startDate, endDate } = c.req.valid('query');

    const exported = await exportFinanceData(
      c.env.DB,
      user.id,
      entity,
      format,
      { accountId, startDate, endDate }
    );

    await logAuditEvent(
      c,
      'finance.data_exported',
      { entity, format, accountId: accountId || null },
      user.id
    );

    return new Response(exported.content, {
      status: 200,
      headers: {
        'Content-Type': exported.contentType,
        'Content-Disposition': `attachment; filename="${exported.filename}"`,
      },
    });
  }
);
