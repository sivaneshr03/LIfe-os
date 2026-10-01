import type { PaginationMeta } from '../types';

/**
 * Encodes a keyset cursor from timestamp and unique ID.
 */
export function encodeCursor(timestampMs: number, id: string): string {
  const raw = `${timestampMs}:${id}`;
  // btoa is available in browsers and Cloudflare Workers
  if (typeof btoa === 'function') {
    return btoa(raw);
  }
  // Node.js fallback for test environments
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return (globalThis as any).Buffer?.from(raw, 'utf-8').toString('base64') ?? btoa(raw);
}

/**
 * Decodes a keyset cursor. Returns null if invalid.
 */
export function decodeCursor(cursor: string): { timestampMs: number; id: string } | null {
  try {
    const raw = typeof atob === 'function'
      ? atob(cursor)
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      : (globalThis as any).Buffer?.from(cursor, 'base64').toString('utf-8') ?? atob(cursor);
    const [timeStr, ...rest] = raw.split(':');
    const timestampMs = parseInt(timeStr, 10);
    const id = rest.join(':');
    if (isNaN(timestampMs) || !id) return null;
    return { timestampMs, id };
  } catch {
    return null;
  }
}

/**
 * Sanitizes search input for SQLite LIKE queries by escaping wildcard characters %, _, \.
 */
export function sanitizeSearchQuery(q: string): string {
  return q.replace(/[%_\\]/g, '\\$&');
}

/**
 * Creates standard pagination metadata for offset queries.
 */
export function buildOffsetPaginationMeta(
  totalCount: number,
  page: number,
  pageSize: number
): PaginationMeta {
  const totalPages = Math.ceil(totalCount / pageSize) || 1;
  return {
    page,
    pageSize,
    totalCount,
    totalPages,
    hasNextPage: page < totalPages,
    hasPrevPage: page > 1,
  };
}

/**
 * Creates standard pagination metadata for cursor queries.
 */
export function buildCursorPaginationMeta(
  hasNextPage: boolean,
  nextCursor?: string
): PaginationMeta {
  return {
    hasNextPage,
    cursor: nextCursor,
  };
}

/**
 * Standard URL-friendly slug generator.
 */
export function slugify(str: string): string {
  return str
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 50);
}
