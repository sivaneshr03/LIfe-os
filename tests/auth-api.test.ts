import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import app from '../src/server/index';
import { createTestDatabase } from './test-db';
import type { ApiSuccessResponse, ApiErrorResponse, AuthSessionData, PublicUser, InviteData } from '../src/shared/types';
import { hashPassword, generateOpaqueToken } from '../src/server/lib/crypto';
import { users } from '../src/server/db/schema';
import { createDb } from '../src/server/db/client';
import { assertOwnership } from '../src/server/middleware/auth';
import type { Context } from 'hono';

describe('Auth & Authorization Integration Suite', () => {
  let testD1: D1Database;
  let disposeD1: () => Promise<void>;
  let adminCookie: string;
  let userCookie: string;

  beforeAll(async () => {
    const { db, dispose } = await createTestDatabase();
    testD1 = db;
    disposeD1 = dispose;
  });

  afterAll(async () => {
    if (disposeD1) await disposeD1();
  });

  it('reports setupRequired: true when database is empty', async () => {
    const res = await app.request('/api/auth/status', {}, { DB: testD1 });
    expect(res.status).toBe(200);

    const json = (await res.json()) as ApiSuccessResponse<{ setupRequired: boolean }>;
    expect(json.success).toBe(true);
    expect(json.data.setupRequired).toBe(true);
  });

  it('allows bootstrap creation of first administrator account', async () => {
    const res = await app.request(
      '/api/auth/bootstrap',
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: 'Primary Admin',
          email: 'admin@lifeos.internal',
          password: 'AdminPassword123!',
        }),
      },
      { DB: testD1 }
    );

    expect(res.status).toBe(201);
    const setCookie = res.headers.get('set-cookie');
    expect(setCookie).toBeDefined();
    expect(setCookie).toContain('session_id=');
    expect(setCookie).toContain('HttpOnly');
    expect(setCookie).toContain('SameSite=Lax');

    adminCookie = setCookie!.split(';')[0]!;

    const json = (await res.json()) as ApiSuccessResponse<AuthSessionData>;
    expect(json.success).toBe(true);
    expect(json.data.user.role).toBe('admin');
    expect(json.data.user.email).toBe('admin@lifeos.internal');
    expect(json.data.isInitialSetup).toBe(true);
    // Crucial security check: zero tokens in payload
    expect((json.data as unknown as Record<string, unknown>).token).toBeUndefined();
    expect((json.data as unknown as Record<string, unknown>).sessionId).toBeUndefined();
  });

  it('permanently blocks subsequent bootstrap attempts', async () => {
    const res = await app.request(
      '/api/auth/bootstrap',
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: 'Imposter Admin',
          email: 'imposter@lifeos.internal',
          password: 'AnotherPassword123!',
        }),
      },
      { DB: testD1 }
    );

    expect(res.status).toBe(403);
    const json = (await res.json()) as ApiErrorResponse;
    expect(json.success).toBe(false);
  });

  it('authenticates admin via login endpoint', async () => {
    const res = await app.request(
      '/api/auth/login',
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: 'admin@lifeos.internal',
          password: 'AdminPassword123!',
        }),
      },
      { DB: testD1 }
    );

    expect(res.status).toBe(200);
    const setCookie = res.headers.get('set-cookie');
    expect(setCookie).toBeDefined();
    expect(setCookie).toContain('HttpOnly');

    const json = (await res.json()) as ApiSuccessResponse<AuthSessionData>;
    expect(json.success).toBe(true);
    expect(json.data.user.role).toBe('admin');
  });

  it('rejects login with invalid password', async () => {
    const res = await app.request(
      '/api/auth/login',
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: 'admin@lifeos.internal',
          password: 'WrongPassword!',
        }),
      },
      { DB: testD1 }
    );

    expect(res.status).toBe(401);
    const json = (await res.json()) as ApiErrorResponse;
    expect(json.success).toBe(false);
    expect(json.error.message).toContain('Invalid email or password');
  });

  it('allows access to /api/auth/me when authenticated with session cookie', async () => {
    const res = await app.request(
      '/api/auth/me',
      {
        headers: { Cookie: adminCookie },
      },
      { DB: testD1 }
    );

    expect(res.status).toBe(200);
    const json = (await res.json()) as ApiSuccessResponse<AuthSessionData>;
    expect(json.success).toBe(true);
    expect(json.data.user.email).toBe('admin@lifeos.internal');
  });

  it('blocks unauthenticated requests to protected endpoints with 401', async () => {
    const res = await app.request('/api/auth/me', {}, { DB: testD1 });
    expect(res.status).toBe(401);

    const json = (await res.json()) as ApiErrorResponse;
    expect(json.success).toBe(false);
  });

  it('admin can create invites and view user list in /api/admin', async () => {
    // Admin generates invite
    const inviteRes = await app.request(
      '/api/admin/invites',
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Cookie: adminCookie,
        },
        body: JSON.stringify({
          email: 'member@lifeos.internal',
          role: 'user',
        }),
      },
      { DB: testD1 }
    );

    expect(inviteRes.status).toBe(201);
    const inviteJson = (await inviteRes.json()) as ApiSuccessResponse<InviteData>;
    expect(inviteJson.success).toBe(true);
    expect(inviteJson.data.email).toBe('member@lifeos.internal');

    // Admin views user list
    const usersRes = await app.request(
      '/api/admin/users',
      {
        headers: { Cookie: adminCookie },
      },
      { DB: testD1 }
    );

    expect(usersRes.status).toBe(200);
    const usersJson = (await usersRes.json()) as ApiSuccessResponse<PublicUser[]>;
    expect(usersJson.success).toBe(true);
    expect(usersJson.data.length).toBeGreaterThanOrEqual(1);
  });

  it('strictly blocks standard user from accessing /api/admin endpoints with 403 Forbidden', async () => {
    // Seed standard user directly in D1
    const db = createDb(testD1);
    const { hash, salt } = await hashPassword('UserPassword123!');
    const standardUserId = generateOpaqueToken(16);

    await db.insert(users).values({
      id: standardUserId,
      email: 'member@lifeos.internal',
      passwordHash: hash,
      salt,
      name: 'Standard Member',
      role: 'user',
      status: 'active',
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    // Login as standard user
    const loginRes = await app.request(
      '/api/auth/login',
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: 'member@lifeos.internal',
          password: 'UserPassword123!',
        }),
      },
      { DB: testD1 }
    );

    expect(loginRes.status).toBe(200);
    userCookie = loginRes.headers.get('set-cookie')!.split(';')[0]!;

    // Standard user attempts to access /api/admin/users
    const adminAccessRes = await app.request(
      '/api/admin/users',
      {
        headers: { Cookie: userCookie },
      },
      { DB: testD1 }
    );

    expect(adminAccessRes.status).toBe(403);
    const forbiddenJson = (await adminAccessRes.json()) as ApiErrorResponse;
    expect(forbiddenJson.success).toBe(false);
    expect(forbiddenJson.error.message).toContain('Administrator privileges required');
  });

  it('invalidates session on logout and clears cookie', async () => {
    const logoutRes = await app.request(
      '/api/auth/logout',
      {
        method: 'POST',
        headers: { Cookie: userCookie },
      },
      { DB: testD1 }
    );

    expect(logoutRes.status).toBe(200);
    const setCookie = logoutRes.headers.get('set-cookie');
    expect(setCookie).toBeDefined();

    // Verify session is no longer valid
    const meRes = await app.request(
      '/api/auth/me',
      {
        headers: { Cookie: userCookie },
      },
      { DB: testD1 }
    );
    expect(meRes.status).toBe(401);
  });

  it('allows a user to onboard with a valid invite code via /api/auth/register', async () => {
    // 1. Admin creates an invite
    const inviteRes = await app.request(
      '/api/admin/invites',
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Cookie: adminCookie,
        },
        body: JSON.stringify({
          email: 'invited.user@lifeos.internal',
          role: 'user',
        }),
      },
      { DB: testD1 }
    );
    expect(inviteRes.status).toBe(201);
    const inviteJson = (await inviteRes.json()) as ApiSuccessResponse<InviteData>;
    const inviteCode = inviteJson.data.code;

    // 2. User registers using the invite code
    const regRes = await app.request(
      '/api/auth/register',
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          code: inviteCode,
          name: 'Invited Household Member',
          password: 'MemberSecurePassword123!',
        }),
      },
      { DB: testD1 }
    );

    expect(regRes.status).toBe(201);
    const regSetCookie = regRes.headers.get('set-cookie');
    expect(regSetCookie).toBeDefined();
    expect(regSetCookie).toContain('session_id=');
    expect(regSetCookie).toContain('HttpOnly');

    const regJson = (await regRes.json()) as ApiSuccessResponse<AuthSessionData>;
    expect(regJson.success).toBe(true);
    expect(regJson.data.user.email).toBe('invited.user@lifeos.internal');
    expect(regJson.data.user.role).toBe('user');
    expect(regJson.data.preferences.themeMode).toBe('system');
    // Security check: no token leakage
    expect((regJson.data as unknown as Record<string, unknown>).token).toBeUndefined();

    // 3. Attempting to reuse the exact same invite code fails with 400
    const reuseRes = await app.request(
      '/api/auth/register',
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          code: inviteCode,
          name: 'Duplicate Registrant',
          password: 'AnotherPassword123!',
        }),
      },
      { DB: testD1 }
    );
    expect(reuseRes.status).toBe(400);
    const reuseJson = (await reuseRes.json()) as ApiErrorResponse;
    expect(reuseJson.error.message).toContain('already been used');

    // 4. Attempting to register with a non-existent invite code fails with 400
    const invalidRes = await app.request(
      '/api/auth/register',
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          code: 'nonexistent-code-1234',
          name: 'Random Visitor',
          password: 'RandomPassword123!',
        }),
      },
      { DB: testD1 }
    );
    expect(invalidRes.status).toBe(400);
    const invalidJson = (await invalidRes.json()) as ApiErrorResponse;
    expect(invalidJson.error.message).toContain('Invalid or unrecognized invite code');
  });

  it('assertOwnership correctly allows owner or admin and rejects others', () => {
    // Owner access
    const ownerContext = {
      get: (key: string) => {
        if (key === 'user') return { id: 'usr_owner_1', role: 'user' };
        return undefined;
      },
    } as unknown as Context;

    expect(() => assertOwnership(ownerContext, 'usr_owner_1')).not.toThrow();

    // Admin access to non-owned entity
    const adminContext = {
      get: (key: string) => {
        if (key === 'user') return { id: 'usr_admin_1', role: 'admin' };
        return undefined;
      },
    } as unknown as Context;

    expect(() => assertOwnership(adminContext, 'usr_owner_1')).not.toThrow();

    // Non-owner, non-admin access
    const strangerContext = {
      get: (key: string) => {
        if (key === 'user') return { id: 'usr_stranger_2', role: 'user' };
        return undefined;
      },
    } as unknown as Context;

    expect(() => assertOwnership(strangerContext, 'usr_owner_1')).toThrowError('Forbidden');

    // Unauthenticated context
    const unauthContext = {
      get: () => undefined,
    } as unknown as Context;

    expect(() => assertOwnership(unauthContext, 'usr_owner_1')).toThrowError('Authentication required');
  });

  it('enforces 5-user cap on private instance', async () => {
    const db = createDb(testD1);
    const existingUsers = await db.select().from(users);
    const needed = 5 - existingUsers.length;

    // Seed up to exactly 5 users
    for (let i = 0; i < needed; i++) {
      const { hash, salt } = await hashPassword('CapPassword123!');
      await db.insert(users).values({
        id: generateOpaqueToken(16),
        email: `cap.user.${i}@lifeos.internal`,
        passwordHash: hash,
        salt,
        name: `Cap User ${i}`,
        role: 'user',
        status: 'active',
        createdAt: new Date(),
        updatedAt: new Date(),
      });
    }

    // Now attempt to generate another invite
    const overCapInviteRes = await app.request(
      '/api/admin/invites',
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Cookie: adminCookie,
        },
        body: JSON.stringify({
          email: 'sixth.user@lifeos.internal',
          role: 'user',
        }),
      },
      { DB: testD1 }
    );

    expect(overCapInviteRes.status).toBe(400);
    const overCapJson = (await overCapInviteRes.json()) as ApiErrorResponse;
    expect(overCapJson.error.message).toContain('Private user limit reached');
  });
});
