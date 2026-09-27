import { Hono } from 'hono';
import { requestIdMiddleware } from './middleware/requestId';
import { securityHeadersMiddleware } from './middleware/securityHeaders';
import { errorHandler } from './middleware/errorHandler';
import { healthRouter } from './routes/health';
import { authRouter } from './routes/auth';
import { settingsRouter } from './routes/settings';
import { adminRouter } from './routes/admin';
import { categoriesRouter } from './routes/categories';
import { tagsRouter } from './routes/tags';
import { remindersRouter } from './routes/reminders';
import { notificationsRouter } from './routes/notifications';
import { savedViewsRouter } from './routes/savedViews';
import { jobsRouter } from './routes/jobs';
import { attachmentsRouter } from './routes/attachments';
import { projectsRouter } from './routes/projects';
import { boardsRouter } from './routes/boards';
import { tasksRouter } from './routes/tasks';
import { dailyNotesRouter } from './routes/dailyNotes';
import { notesRouter } from './routes/notes';
import { promptsRouter } from './routes/prompts';
import { dashboardRouter } from './routes/dashboard';
import { habitsRouter } from './routes/habits';
import { trackersRouter } from './routes/trackers';
import { workoutsRouter } from './routes/workouts';
import { goalsRouter } from './routes/goals';
import { financeAccountsRouter } from './routes/financeAccounts';
import { financeTransactionsRouter } from './routes/financeTransactions';
import { financeBudgetsRouter } from './routes/financeBudgets';
import { financeDebtsRouter } from './routes/financeDebts';
import { financeContactsRouter } from './routes/financeContacts';
import { financeReportsRouter } from './routes/financeReports';
import { financeSnapshotsRouter } from './routes/financeSnapshots';
import { financeImportExportRouter } from './routes/financeImportExport';
import { financeOverviewRouter } from './routes/financeOverview';
import { investmentsRouter } from './routes/investments';
import { insightsRouter } from './routes/insights';
import type { ApiErrorResponse } from '../shared/types';

export interface AppBindings {
  DB: D1Database;
  ASSETS?: Fetcher;
  ENVIRONMENT?: string;
  APP_NAME?: string;
  APP_ORIGIN?: string;
  LOG_LEVEL?: string;
  SESSION_SECRET?: string;
}

const app = new Hono<{ Bindings: AppBindings }>();

// Global Middlewares
app.use('*', requestIdMiddleware);
app.use('*', securityHeadersMiddleware);

// Centralized Error Handling
app.onError(errorHandler);

// API Route Registry
app.route('/api/health', healthRouter);
app.route('/api/auth', authRouter);
app.route('/api/settings', settingsRouter);
app.route('/api/admin', adminRouter);
app.route('/api/categories', categoriesRouter);
app.route('/api/tags', tagsRouter);
app.route('/api/reminders', remindersRouter);
app.route('/api/notifications', notificationsRouter);
app.route('/api/saved-views', savedViewsRouter);
app.route('/api/jobs', jobsRouter);
app.route('/api/attachments', attachmentsRouter);
app.route('/api/projects', projectsRouter);
app.route('/api/boards', boardsRouter);
app.route('/api/tasks', tasksRouter);
app.route('/api/daily-notes', dailyNotesRouter);
app.route('/api/notes', notesRouter);
app.route('/api/prompts', promptsRouter);
app.route('/api/dashboard', dashboardRouter);
app.route('/api/habits', habitsRouter);
app.route('/api/trackers', trackersRouter);
app.route('/api/workouts', workoutsRouter);
app.route('/api/goals', goalsRouter);
app.route('/api/finance/accounts', financeAccountsRouter);
app.route('/api/finance/transactions', financeTransactionsRouter);
app.route('/api/finance/budgets', financeBudgetsRouter);
app.route('/api/finance/debts', financeDebtsRouter);
app.route('/api/finance/contacts', financeContactsRouter);
app.route('/api/finance/reports', financeReportsRouter);
app.route('/api/finance/snapshots', financeSnapshotsRouter);
app.route('/api/finance/import', financeImportExportRouter);
app.route('/api/finance/export', financeImportExportRouter);
app.route('/api/finance/overview', financeOverviewRouter);
app.route('/api/investments', investmentsRouter);
app.route('/api/insights', insightsRouter);

import { processDueReminders } from './services/reminderProcessor';

// Fallback 404 for unmapped API routes
app.all('/api/*', (c) => {
  const requestId = (c.get('requestId') as string) || 'unknown';
  const response: ApiErrorResponse = {
    success: false,
    error: {
      code: 'NOT_FOUND',
      message: `The requested endpoint '${c.req.path}' does not exist on this server`,
    },
    meta: {
      requestId,
      timestamp: Date.now(),
    },
  };
  return c.json(response, 404);
});

export const scheduled = async (
  _event: { cron?: string; type?: string; scheduledTime?: number },
  env: AppBindings,
  _ctx?: { waitUntil: (promise: Promise<unknown>) => void }
) => {
  return await processDueReminders(env.DB);
};

export { app };
export default app;

