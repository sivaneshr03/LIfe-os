import type { MiddlewareHandler } from 'hono';

const VALID_REQUEST_ID_REGEX = /^[a-zA-Z0-9_-]{1,64}$/;

export const requestIdMiddleware: MiddlewareHandler = async (c, next) => {
  const incomingId = c.req.header('x-request-id');
  const requestId =
    incomingId && VALID_REQUEST_ID_REGEX.test(incomingId)
      ? incomingId
      : crypto.randomUUID();
  c.set('requestId', requestId);
  c.header('x-request-id', requestId);
  await next();
};

