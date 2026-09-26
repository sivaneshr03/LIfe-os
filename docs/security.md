# LifeOS: Security Architecture & Threat Model

## 1. Threat Model & Trust Assumptions
LifeOS is intended for private single-tenant deployment serving 1 to 5 trusted household/collaborative users. The threat model accounts for:
- Remote adversaries attempting unauthorized credential stuffing or session hijack.
- Cross-Site Scripting (XSS) attempting to steal persistent authentication credentials.
- Cross-Site Request Forgery (CSRF) aiming to mutate financial or personal data.
- Accidental insider privilege escalation (member accessing `/admin` controls).
- Physical access exposure on shared client hardware.

---

## 2. Authentication & Session Security

### 2.1 Cookie-Based Session Architecture
Authentication does NOT use bearer tokens (JWTs) stored in client-accessible storage. It uses server-managed opaque session tokens:
- **Token Generation:** 256-bit cryptographically secure random values generated via Web Crypto API `crypto.getRandomValues(new Uint8Array(32))`.
- **Session Storage:** Stored in Cloudflare D1 with user association, created timestamp, last active timestamp, and expiration timestamp.
- **Cookie Attributes:**
  - `HttpOnly`: Strictly prevents JavaScript read access (`document.cookie`), mitigating session theft via XSS.
  - `Secure`: Transmitted exclusively over encrypted HTTPS connections.
  - `SameSite=Lax`: Prevents ambient transmission on cross-site requests, mitigating standard CSRF vectors.
  - `Path=/`: Scoped to the entire origin.
- **Sliding Expiration:** Sessions expire after 30 days of inactivity. Every authenticated request updates `last_active_at`; if within 7 days of expiration, a refreshed cookie is re-issued.

### 2.2 Prohibited Token Storage (Strict Rule)
Session tokens, API keys, and user secrets must **NEVER** be persisted in:
- `localStorage`
- `sessionStorage`
- `IndexedDB`
- URL query parameters or hash fragments
- Client console logs or error monitoring telemetry

---

## 3. Password Security & Cryptography
- **Hashing Algorithm:** PBKDF2-SHA256 (minimum 100,000 iterations) or Argon2id via Cloudflare Workers Web Crypto.
- **Salts:** Unique 16-byte cryptographically random salt per user.
- **Password Complexity:** Minimum 12 characters for administrator accounts, 8 characters for member accounts.
- **Timing Attack Mitigation:** Constant-time comparison (`crypto.subtle.timingSafeEqual`) for all token and hash verifications.

---

## 4. Authorization & Access Control (RBAC)
Two roles exist within LifeOS:
1. `admin`: Full system control, user provisioning, global exports, and `/admin` UI access.
2. `member`: Access restricted strictly to own tasks, notes, habits, personal finance records, and shared views.

- **Enforcement Layer:** Authorization is enforced in Hono route middleware before reaching controller logic:
  ```typescript
  export const requireAdmin = async (c: Context, next: Next) => {
    const user = c.get('user');
    if (!user || user.role !== 'admin') {
      return c.json({ success: false, error: { code: 'FORBIDDEN', message: 'Admin access required' } }, 403);
    }
    await next();
  };
  ```

---

## 5. Network & HTTP Security Headers
Hono middleware injects standard defensive headers on every response:
- **Content-Security-Policy (CSP):** `default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; font-src 'self'; connect-src 'self'; frame-ancestors 'none';`
- **X-Frame-Options:** `DENY` (prevents clickjacking).
- **X-Content-Type-Options:** `nosniff` (prevents MIME sniffing).
- **Referrer-Policy:** `strict-origin-when-cross-origin`.
- **Permissions-Policy:** `camera=(), microphone=(), geolocation=()`.

---

## 6. CSRF & Request Origin Validation
State-changing requests (`POST`, `PUT`, `PATCH`, `DELETE`) are subject to automated origin verification:
- The `Origin` or `Sec-Fetch-Site` header must match the application host.
- Requests originating from external domains or mismatched protocols are rejected with `403 Forbidden` prior to handler execution.

---

## 7. Data Injection Prevention
- **SQL Injection:** Prohibited completely by requiring Drizzle ORM query builders and prepared statements for 100% of D1 database operations.
- **HTML/Markdown Sanitization:** Notes and Markdown descriptions are sanitized using DOMPurify before client rendering to prevent stored XSS attacks.
