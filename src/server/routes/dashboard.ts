import { Hono } from 'hono';
import { requireAuth } from '../middleware/auth';
import { getTodayDashboard } from '../services/dashboardService';
import type { ApiSuccessResponse, TodayDashboardData } from '../../shared/types';
import type { AppBindings } from '../index';

export const dashboardRouter = new Hono<{ Bindings: AppBindings }>();

dashboardRouter.use('*', requireAuth);

/**
 * GET /api/dashboard/today
 * Composite dashboard endpoint: today tasks, overdue tasks, completed today,
 * daily note, reminders, and active projects overview.
 */
dashboardRouter.get('/today', async (c) => {
  const user = c.get('user');
  const data = await getTodayDashboard(c.env.DB, user.id);
  return c.json<ApiSuccessResponse<TodayDashboardData>>({ success: true, data });
});
