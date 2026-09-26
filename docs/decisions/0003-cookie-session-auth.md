# [ADR-0003] Secure Cookie-Session Authentication Architecture

## Status
Accepted

## Context & Problem Statement
Single Page Applications (SPAs) frequently store JSON Web Tokens (JWTs) in `localStorage` or `sessionStorage`. If an XSS vulnerability occurs in any dependency, these tokens can be extracted by an attacker, leading to persistent account compromise.

## Decision Drivers
- High security posture against credential theft and XSS token exfiltration.
- Support for immediate session revocation from an admin panel.
- Clean integration with browser PWA capabilities and native fetch APIs.

## Considered Options
1. Bearer JWTs stored in `localStorage` / `sessionStorage`.
2. In-memory access tokens paired with refresh token cookies.
3. Server-side session tokens stored in Cloudflare D1 and delivered via `httpOnly`, `Secure`, `SameSite=Lax` cookies.

## Decision Outcome
Chosen option: **Server-side session tokens stored in Cloudflare D1 with `httpOnly`, `Secure`, `SameSite=Lax`, `Path=/` cookies**.

### Positive Consequences
- JavaScript running in the browser cannot inspect or exfiltrate the session token via XSS.
- Immediate revocation: Admins can terminate active sessions directly from `/admin`.
- Native browser cookie handling for all standard fetch calls (`credentials: 'include'`).
- CSRF risk mitigated by `SameSite=Lax` and Hono origin verification middleware.

### Negative Consequences / Trade-offs
- Authenticated requests require a quick database session lookup in D1 (optimized via index `idx_sessions_user_expires`).
