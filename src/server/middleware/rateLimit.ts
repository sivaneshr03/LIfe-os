import type { MiddlewareHandler, Context } from 'hono';
import { HTTPException } from 'hono/http-exception';
import { hashIp } from '../lib/crypto';
import type { AppBindings } from '../index';

interface RateLimitRecord {
  count: number;
  resetAt: number;
}

// Bounded in-memory rate-limiter bucket with automatic eviction to prevent DoS/OOM
const MAX_RATE_LIMIT_ENTRIES = 5000;
const rateLimitMap = new Map<string, RateLimitRecord>();

function getTrustedClientIp(c: Context): string {
  // Cloudflare Edge securely terminates TLS and injects cf-connecting-ip
  const cfIp = c.req.header('cf-connecting-ip');
  if (cfIp) return cfIp.trim();

  // Fallback to x-forwarded-for for development/reverse-proxy environments
  const xff = c.req.header('x-forwarded-for');
  if (xff) {
    const first = xff.split(',')[0]?.trim();
    if (first && /^[0-9a-fA-F.:]+$/.test(first)) {
      return first;
    }
  }

  return '127.0.0.1';
}

function pruneExpiredEntries(now: number): void {
  // If map size exceeds safety threshold, purge expired items
  if (rateLimitMap.size > 1000) {
    for (const [key, record] of rateLimitMap.entries()) {
      if (record.resetAt <= now) {
        rateLimitMap.delete(key);
      }
    }
  }

  // Hard safety cap: if still too large, drop oldest entries to prevent OOM
  if (rateLimitMap.size >= MAX_RATE_LIMIT_ENTRIES) {
    let toRemove = Math.floor(MAX_RATE_LIMIT_ENTRIES * 0.2);
    for (const key of rateLimitMap.keys()) {
      rateLimitMap.delete(key);
      if (--toRemove <= 0) break;
    }
  }
}

export function createRateLimiter(options: { max: number; windowMs: number }): MiddlewareHandler<{ Bindings: AppBindings }> {
  return async (c, next) => {
    const clientIp = getTrustedClientIp(c);
    const key = `${c.req.path}:${await hashIp(clientIp)}`;
    const now = Date.now();

    pruneExpiredEntries(now);

    const record = rateLimitMap.get(key);

    if (record && record.resetAt > now) {
      if (record.count >= options.max) {
        c.header('Retry-After', String(Math.ceil((record.resetAt - now) / 1000)));
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

