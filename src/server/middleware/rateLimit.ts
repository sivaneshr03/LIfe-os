import type { MiddlewareHandler } from 'hono';
import { HTTPException } from 'hono/http-exception';
import { hashIp } from '../lib/crypto';
import type { AppBindings } from '../index';

interface RateLimitRecord {
  count: number;
  resetAt: number;
}

// In-memory rate-limiter bucket for local & edge worker instances
const rateLimitMap = new Map<string, RateLimitRecord>();

export function createRateLimiter(options: { max: number; windowMs: number }): MiddlewareHandler<{ Bindings: AppBindings }> {
  return async (c, next) => {
    const clientIp = c.req.header('cf-connecting-ip') || c.req.header('x-forwarded-for') || '127.0.0.1';
    const key = `${c.req.path}:${await hashIp(clientIp)}`;
    const now = Date.now();

    const record = rateLimitMap.get(key);

    if (record && record.resetAt > now) {
      if (record.count >= options.max) {
        throw new HTTPException(429, {
          message: 'Too many requests. Please wait a few minutes before trying again.',
        });
      }
      record.count += 1;
    } else {
      rateLimitMap.set(key, {
        count: 1,
        resetAt: now + options.windowMs,
      });
    }

    const currentRecord = rateLimitMap.get(key);
    const count = currentRecord ? currentRecord.count : 1;
    const resetAt = currentRecord ? currentRecord.resetAt : now + options.windowMs;
    const remaining = Math.max(0, options.max - count);

    c.header('X-RateLimit-Limit', String(options.max));
    c.header('X-RateLimit-Remaining', String(remaining));
    c.header('X-RateLimit-Reset', String(Math.ceil(resetAt / 1000)));

    await next();
  };
}
