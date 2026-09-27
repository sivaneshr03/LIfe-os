import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import { requireAuth } from '../middleware/auth';
import { financeReportQuerySchema } from '../../shared/schemas/finance';
import { generateSpendingReport } from '../services/financeReportService';
import type { ApiSuccessResponse, FinanceSpendingAnalysisData } from '../../shared/financeTypes';
import type { AppBindings } from '../index';

export const financeReportsRouter = new Hono<{ Bindings: AppBindings }>();

financeReportsRouter.use('*', requireAuth);

/**
 * GET /api/finance/reports/spending
 * Returns spending analysis, savings rate, category breakdowns (allocating split transactions), top payees, and trends.
 */
financeReportsRouter.get(
  '/spending',
  zValidator('query', financeReportQuerySchema),
  async (c) => {
    const user = c.get('user');
    const { period, yearMonth, year } = c.req.valid('query');

    const report = await generateSpendingReport(
      c.env.DB,
      user.id,
      period,
      yearMonth,
      year
    );

    return c.json<ApiSuccessResponse<FinanceSpendingAnalysisData>>({
      success: true,
      data: report,
    });
  }
);

/**
 * GET /api/finance/reports/summary
 * Alias for spending analysis summary report.
 */
financeReportsRouter.get(
  '/summary',
  zValidator('query', financeReportQuerySchema),
  async (c) => {
    const user = c.get('user');
    const { period, yearMonth, year } = c.req.valid('query');

    const report = await generateSpendingReport(
      c.env.DB,
      user.id,
      period,
      yearMonth,
      year
    );

    return c.json<ApiSuccessResponse<FinanceSpendingAnalysisData>>({
      success: true,
      data: report,
    });
  }
);
