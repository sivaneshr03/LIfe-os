import { Hono } from 'hono';
import { sql } from 'drizzle-orm';
import { createDb } from '../db/client';
import type { ApiSuccessResponse, HealthCheckData } from '../../shared/types';
import type { AppBindings } from '../index';

const healthRouter = new Hono<{ Bindings: AppBindings }>();
const serverStartTime = Date.now();

healthRouter.get('/', async (c) => {
  const requestId = (c.get('requestId') as string) || 'unknown';
  let dbStatus: 'connected' | 'unreachable' = 'unreachable';

  if (c.env?.DB) {
    try {
      const db = createDb(c.env.DB);
      await db.run(sql`SELECT 1`);
      dbStatus = 'connected';
    } catch (dbError) {
      console.error('[Health] Database connection error:', dbError);
    }
  }

  const data: HealthCheckData = {
    status: dbStatus === 'connected' ? 'ok' : 'degraded',
    environment: c.env?.ENVIRONMENT || 'local',
    version: '0.1.0',
    timestamp: Date.now(),
    uptimeSeconds: Math.floor((Date.now() - serverStartTime) / 1000),
    services: {
      database: dbStatus,
    },
  };

  const response: ApiSuccessResponse<HealthCheckData> = {
    success: true,
    data,
    meta: {
      requestId,
      timestamp: Date.now(),
    },
  };

  return c.json(response, data.status === 'ok' ? 200 : 503);
});

export { healthRouter };
