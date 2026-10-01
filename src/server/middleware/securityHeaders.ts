import type { MiddlewareHandler } from 'hono';

export const securityHeadersMiddleware: MiddlewareHandler = async (c, next) => {
  await next();

  // Enforce HSTS for HTTPS connections (1 year, subdomains, preload-ready)
  const isHttps = c.req.url.startsWith('https:') || c.req.header('x-forwarded-proto') === 'https';
  if (isHttps) {
    c.header('Strict-Transport-Security', 'max-age=31536000; includeSubDomains; preload');
  }

  // Prevent MIME-sniffing
  c.header('X-Content-Type-Options', 'nosniff');

  // Prevent clickjacking & framing
  c.header('X-Frame-Options', 'DENY');

  // Privacy: preserve origin on HTTPS cross-origin navigations, drop path
  c.header('Referrer-Policy', 'strict-origin-when-cross-origin');

  // Disable legacy browser XSS filters that introduce security holes (rely on CSP)
  c.header('X-XSS-Protection', '0');

  // Cross-Origin Isolation & Embedding protection
  c.header('Cross-Origin-Opener-Policy', 'same-origin');
  c.header('Cross-Origin-Resource-Policy', 'same-origin');

  // Restrict sensitive hardware capabilities
  c.header('Permissions-Policy', 'camera=(), microphone=(), geolocation=(), payment=(), usb=()');

  // Comprehensive Content Security Policy (CSP)
  const cspDirectives = [
    "default-src 'self'",
    "script-src 'self' 'unsafe-inline'",
    "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
    "font-src 'self' https://fonts.gstatic.com data:",
    "img-src 'self' data: blob:",
    "media-src 'self' blob:",
    "connect-src 'self'",
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "frame-ancestors 'none'",
    ...(isHttps ? ['upgrade-insecure-requests'] : []),
  ];

  c.header('Content-Security-Policy', cspDirectives.join('; '));
};

