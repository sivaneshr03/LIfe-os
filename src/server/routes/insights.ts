import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import { z } from 'zod';
import { createDb } from '../db/client';
import { requireAuth } from '../middleware/auth';
import { generateInsightsOverview } from '../services/insightsService';
import type { ApiSuccessResponse, InsightsOverviewData } from '../../shared/types';
import type { AppBindings } from '../index';

export const insightsRouter = new Hono<{ Bindings: AppBindings }>();

insightsRouter.use('*', requireAuth);

/**
 * GET /api/insights/overview
 * Comprehensive cross-domain insights and analytics payload.
 */
insightsRouter.get(
  '/overview',
  zValidator(
    'query',
    z.object({
      today: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
    })
  ),
  async (c) => {
    const user = c.get('user');
    const db = createDb(c.env.DB);
    const { today } = c.req.valid('query');
    const todayDate = today || new Date().toISOString().split('T')[0];

    const data = await generateInsightsOverview(db, user.id, todayDate);

    return c.json<ApiSuccessResponse<InsightsOverviewData>>({ success: true, data });
  }
);

/**
 * GET /api/insights/tasks
 */
insightsRouter.get('/tasks', async (c) => {
  const user = c.get('user');
  const db = createDb(c.env.DB);
  const todayDate = new Date().toISOString().split('T')[0];
  const overview = await generateInsightsOverview(db, user.id, todayDate);

  return c.json<ApiSuccessResponse<typeof overview.tasks>>({ success: true, data: overview.tasks });
});

/**
 * GET /api/insights/goals
 */
insightsRouter.get('/goals', async (c) => {
  const user = c.get('user');
  const db = createDb(c.env.DB);
  const todayDate = new Date().toISOString().split('T')[0];
  const overview = await generateInsightsOverview(db, user.id, todayDate);

  return c.json<ApiSuccessResponse<typeof overview.goals>>({ success: true, data: overview.goals });
});

/**
 * GET /api/insights/trackers
 */
insightsRouter.get('/trackers', async (c) => {
  const user = c.get('user');
  const db = createDb(c.env.DB);
  const todayDate = new Date().toISOString().split('T')[0];
  const overview = await generateInsightsOverview(db, user.id, todayDate);

  return c.json<ApiSuccessResponse<typeof overview.trackers>>({ success: true, data: overview.trackers });
});

/**
 * GET /api/insights/fitness
 */
insightsRouter.get('/fitness', async (c) => {
  const user = c.get('user');
  const db = createDb(c.env.DB);
  const todayDate = new Date().toISOString().split('T')[0];
  const overview = await generateInsightsOverview(db, user.id, todayDate);

  return c.json<ApiSuccessResponse<typeof overview.fitness>>({ success: true, data: overview.fitness });
});
