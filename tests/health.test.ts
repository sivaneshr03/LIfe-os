import { describe, it, expect } from 'vitest';
import app from '../src/server/index';
import type { ApiSuccessResponse, ApiErrorResponse, HealthCheckData } from '../src/shared/types';

describe('LifeOS Edge Worker Health & Middleware Suite', () => {
  it('returns valid health response envelope on GET /api/health', async () => {
    const res = await app.request('/api/health');
    expect(res.status).toBe(503); // No D1 mock bound in basic unit test, so status is degraded (expected)

    const json = (await res.json()) as ApiSuccessResponse<HealthCheckData>;
    expect(json.success).toBe(true);
    expect(json.data.status).toBe('degraded');
    expect(json.data.services.database).toBe('unreachable');
    expect(json.data.version).toBe('0.1.0');
    expect(json.meta?.requestId).toBeDefined();
    expect(res.headers.get('x-content-type-options')).toBe('nosniff');
    expect(res.headers.get('x-frame-options')).toBe('DENY');
    expect(res.headers.get('x-request-id')).toBeDefined();
  });

  it('returns healthy status when D1 database is mocked in environment', async () => {
    const mockD1: Partial<D1Database> = {
      prepare: () => ({
        bind: () => ({
          first: async () => 1,
          run: async () => ({ success: true, meta: { duration: 1 } } as D1Response),
          all: async () => ({ results: [], success: true, meta: { duration: 1 } } as D1Result),
          raw: async () => [],
        }),
        first: async () => 1,
        run: async () => ({ success: true, meta: { duration: 1 } } as D1Response),
        all: async () => ({ results: [], success: true, meta: { duration: 1 } } as D1Result),
        raw: async () => [],
      }),
      batch: async () => [],
      exec: async () => ({ count: 1, duration: 1 }),
      dump: async () => new ArrayBuffer(0),
    };

    const res = await app.request('/api/health', {}, { DB: mockD1 as D1Database, ENVIRONMENT: 'local' });
    expect(res.status).toBe(200);

    const json = (await res.json()) as ApiSuccessResponse<HealthCheckData>;
    expect(json.success).toBe(true);
    expect(json.data.status).toBe('ok');
    expect(json.data.services.database).toBe('connected');
    expect(json.data.environment).toBe('local');
  });

  it('returns structured 404 envelope on unmapped /api routes', async () => {
    const res = await app.request('/api/does-not-exist');
    expect(res.status).toBe(404);

    const json = (await res.json()) as ApiErrorResponse;
    expect(json.success).toBe(false);
    expect(json.error.code).toBe('NOT_FOUND');
    expect(json.meta?.requestId).toBeDefined();
  });
});
