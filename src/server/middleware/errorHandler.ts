import type { Context } from 'hono';
import { HTTPException } from 'hono/http-exception';
import type { ApiErrorResponse } from '../../shared/types';

export function errorHandler(err: Error, c: Context): Response {
  const requestId = (c.get('requestId') as string) || 'unknown';
  const timestamp = Date.now();

  console.error(`[Error] [${requestId}] ${err.name}: ${err.message}`, err.stack);

  if (err instanceof HTTPException) {
    const errorResponse: ApiErrorResponse = {
      success: false,
      error: {
        code: `HTTP_${err.status}`,
        message: err.message,
      },
      meta: {
        requestId,
        timestamp,
      },
    };
    return c.json(errorResponse, err.status);
  }

  // Handle generic / uncaught errors
  const isDev = (c.env as { ENVIRONMENT?: string })?.ENVIRONMENT === 'local';
  const errorResponse: ApiErrorResponse = {
    success: false,
    error: {
      code: 'INTERNAL_SERVER_ERROR',
      message: isDev ? err.message : 'An unexpected internal server error occurred',
    },
    meta: {
      requestId,
      timestamp,
    },
  };

  return c.json(errorResponse, 500);
}
