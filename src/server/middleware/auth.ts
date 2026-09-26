import type { MiddlewareHandler, Context } from 'hono';
import { HTTPException } from 'hono/http-exception';
import { eq, and, gt } from 'drizzle-orm';
import { getCookie } from 'hono/cookie';
import { createDb } from '../db/client';
import { sessions, users, type User, type Session } from '../db/schema';
import type { AppBindings } from '../index';

export const SESSION_COOKIE_NAME = 'session_id';

declare module 'hono' {
  interface ContextVariableMap {
    user: User;
    session: Session;
  }
}

export const requireAuth: MiddlewareHandler<{ Bindings: AppBindings }> = async (c, next) => {
  const sessionId = getCookie(c, SESSION_COOKIE_NAME);

  if (!sessionId) {
    throw new HTTPException(401, { message: 'Authentication required. Please sign in.' });
  }

  if (!c.env?.DB) {
    throw new HTTPException(503, { message: 'Database service unavailable' });
  }

  const db = createDb(c.env.DB);
  const now = new Date();

  const result = await db
    .select({
      session: sessions,
      user: users,
    })
    .from(sessions)
    .innerJoin(users, eq(sessions.userId, users.id))
    .where(and(eq(sessions.id, sessionId), gt(sessions.expiresAt, now)))
    .limit(1);

  const match = result[0];

  if (!match || match.user.status !== 'active') {
    throw new HTTPException(401, { message: 'Session expired or invalid. Please sign in again.' });
  }

  // Sliding window activity update if last active > 1 hour ago
  const oneHourMs = 60 * 60 * 1000;
  if (now.getTime() - match.session.lastActiveAt.getTime() > oneHourMs) {
    c.executionCtx?.waitUntil(
      db
        .update(sessions)
        .set({ lastActiveAt: now })
        .where(eq(sessions.id, sessionId))
        .run()
    );
  }

  c.set('user', match.user);
  c.set('session', match.session);

  await next();
};

export const requireAdmin: MiddlewareHandler<{ Bindings: AppBindings }> = async (c, next) => {
  const user = c.get('user');

  if (!user) {
    // If requireAuth has not run yet, run it
    return requireAuth(c, async () => {
      const authUser = c.get('user');
      if (authUser?.role !== 'admin') {
        throw new HTTPException(403, { message: 'Access denied. Administrator privileges required.' });
      }
      await next();
    });
  }

  if (user.role !== 'admin') {
    throw new HTTPException(403, { message: 'Access denied. Administrator privileges required.' });
  }

  await next();
};

export function assertOwnership(c: Context, entityUserId: string): void {
  const currentUser = c.get('user') as User | undefined;
  if (!currentUser) {
    throw new HTTPException(401, { message: 'Authentication required' });
  }

  if (currentUser.id !== entityUserId && currentUser.role !== 'admin') {
    throw new HTTPException(403, { message: 'Forbidden: You do not own this resource' });
  }
}
