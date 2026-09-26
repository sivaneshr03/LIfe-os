import { Hono } from 'hono';
import { requestIdMiddleware } from './middleware/requestId';
import { securityHeadersMiddleware } from './middleware/securityHeaders';
import { errorHandler } from './middleware/errorHandler';
import { healthRouter } from './routes/health';
import { authRouter } from './routes/auth';
import { settingsRouter } from './routes/settings';
import { adminRouter } from './routes/admin';
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

export default app;
