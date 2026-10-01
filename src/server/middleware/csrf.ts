import type { MiddlewareHandler } from 'hono';
import { HTTPException } from 'hono/http-exception';
import { getCookie } from 'hono/cookie';
import { SESSION_COOKIE_NAME } from './auth';
import type { AppBindings } from '../index';

const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);

/**
 * Defense-in-depth CSRF verification for cookie-authenticated mutating requests.
 * Validates Origin/Referer against Host and configured APP_ORIGIN.
 */
export const csrfProtectionMiddleware: MiddlewareHandler<{ Bindings: AppBindings }> = async (c, next) => {
  if (SAFE_METHODS.has(c.req.method)) {
    return await next();
  }

  // Only enforce on authenticated session-cookie requests
  const hasSession = Boolean(getCookie(c, SESSION_COOKIE_NAME));
  if (!hasSession) {
    return await next();
  }

  const origin = c.req.header('origin');
  const referer = c.req.header('referer');
  const host = c.req.header('host');

  let sourceHost: string | null = null;
  if (origin) {
    try {
      sourceHost = new URL(origin).host;
    } catch {
      throw new HTTPException(403, { message: 'Forbidden: Malformed Origin header' });
    }
  } else if (referer) {
    try {
      sourceHost = new URL(referer).host;
    } catch {
      throw new HTTPException(403, { message: 'Forbidden: Malformed Referer header' });
    }
  }

  if (sourceHost && host) {
    let appHost: string | null = null;
    if (c.env?.APP_ORIGIN) {
      try {
        appHost = new URL(c.env.APP_ORIGIN).host;
      } catch {}
    }

    const matchesHost = sourceHost === host;
    const matchesAppOrigin = appHost ? sourceHost === appHost : false;

    if (!matchesHost && !matchesAppOrigin) {
      throw new HTTPException(403, { message: 'Forbidden: Cross-site request rejected (CSRF protection)' });
    }
  }

  await next();
};
