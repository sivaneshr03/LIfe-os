import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { createTestDatabase } from './test-db';
import app from '../src/server/index';
import type { ApiSuccessResponse, PublicUser, InviteData, AuditEventData } from '../src/shared/types';

describe('Admin Panel & RBAC API Suite', () => {
  let testD1: D1Database;
  let disposeDb: () => Promise<void>;
  let adminCookie: string;
  let adminId: string;
  let userCookie: string;
  let userId: string;

  beforeAll(async () => {
    const { db, dispose } = await createTestDatabase();
    testD1 = db;
    disposeDb = dispose;

    // 1. Bootstrap Admin
    const bootstrapRes = await app.request(
      '/api/auth/bootstrap',
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: 'Super Admin',
          email: 'admin@lifeos.local',
          password: 'AdminPassword123!',
        }),
      },
      { DB: testD1 }
    );
    expect(bootstrapRes.status).toBe(201);
    const adminRawCookie = bootstrapRes.headers.get('set-cookie') || '';
    adminCookie = adminRawCookie.split(';')[0];

    const adminMeRes = await app.request(
      '/api/auth/me',
      { headers: { Cookie: adminCookie } },
      { DB: testD1 }
    );
    const adminMeJson = await adminMeRes.json();
    adminId = adminMeJson.data.user.id;

    // 2. Create Invite and register Standard User
    const inviteRes = await app.request(
      '/api/admin/invites',
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Cookie: adminCookie,
        },
        body: JSON.stringify({
          email: 'standard@lifeos.local',
          role: 'user',
        }),
      },
      { DB: testD1 }
    );
    expect(inviteRes.status).toBe(201);
    const inviteJson = (await inviteRes.json()) as ApiSuccessResponse<InviteData>;
    const inviteCode = inviteJson.data.code;

    const regRes = await app.request(
      '/api/auth/register',
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: 'Standard User',
          email: 'standard@lifeos.local',
          password: 'UserPassword123!',
          code: inviteCode,
        }),
      },
      { DB: testD1 }
    );
    expect(regRes.status).toBe(201);
    const userRawCookie = regRes.headers.get('set-cookie') || '';
    userCookie = userRawCookie.split(';')[0];

    const userMeRes = await app.request(
      '/api/auth/me',
      { headers: { Cookie: userCookie } },
      { DB: testD1 }
    );
    const userMeJson = await userMeRes.json();
    userId = userMeJson.data.user.id;
  });

  afterAll(async () => {
    if (disposeDb) {
      await disposeDb();
    }
  });

  describe('RBAC Authorization Guard Enforcement', () => {
    it('strictly denies standard user from accessing GET /api/admin/overview with 403 Forbidden', async () => {
      const res = await app.request(
        '/api/admin/overview',
        { headers: { Cookie: userCookie } },
        { DB: testD1 }
      );
      expect(res.status).toBe(403);
    });

    it('strictly denies standard user from accessing GET /api/admin/users with 403 Forbidden', async () => {
      const res = await app.request(
        '/api/admin/users',
        { headers: { Cookie: userCookie } },
        { DB: testD1 }
      );
      expect(res.status).toBe(403);
    });

    it('strictly denies standard user from generating invites with 403 Forbidden', async () => {
      const res = await app.request(
        '/api/admin/invites',
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Cookie: userCookie,
          },
          body: JSON.stringify({
            email: 'unauthorized@test.local',
            role: 'user',
          }),
        },
        { DB: testD1 }
      );
      expect(res.status).toBe(403);
    });

    it('strictly denies standard user from viewing security audit logs with 403 Forbidden', async () => {
      const res = await app.request(
        '/api/admin/audit-logs',
        { headers: { Cookie: userCookie } },
        { DB: testD1 }
      );
      expect(res.status).toBe(403);
    });
  });

  describe('Admin Operations & System Overview', () => {
    it('allows administrator to fetch system overview stats', async () => {
      const res = await app.request(
        '/api/admin/overview',
        { headers: { Cookie: adminCookie } },
        { DB: testD1 }
      );

      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json.success).toBe(true);
      expect(json.data.users).toBe(2);
      expect(json.data.maxAllowedUsers).toBe(5);
      expect(json.data.modules).toBeDefined();
      expect(json.data.system.database).toBe('connected');
    });

    it('allows administrator to list all household users with session counts', async () => {
      const res = await app.request(
        '/api/admin/users',
        { headers: { Cookie: adminCookie } },
        { DB: testD1 }
      );

      expect(res.status).toBe(200);
      const json = (await res.json()) as ApiSuccessResponse<(PublicUser & { activeSessionCount: number })[]>;
      expect(json.data.length).toBe(2);
      expect(json.data.some((u) => u.role === 'admin')).toBe(true);
      expect(json.data.some((u) => u.role === 'user')).toBe(true);
    });

    it('allows administrator to list, generate, and revoke invites', async () => {
      // 1. Generate new invite
      const createRes = await app.request(
        '/api/admin/invites',
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Cookie: adminCookie,
          },
          body: JSON.stringify({
            email: 'member2@lifeos.local',
            role: 'user',
          }),
        },
        { DB: testD1 }
      );

      expect(createRes.status).toBe(201);
      const createdJson = await createRes.json();
      const inviteId = createdJson.data.id;

      // 2. List invites
      const listRes = await app.request(
        '/api/admin/invites',
        { headers: { Cookie: adminCookie } },
        { DB: testD1 }
      );
      const listJson = await listRes.json();
      expect(listJson.data.some((i: InviteData) => i.id === inviteId)).toBe(true);

      // 3. Revoke invite
      const deleteRes = await app.request(
        `/api/admin/invites/${inviteId}`,
        {
          method: 'DELETE',
          headers: { Cookie: adminCookie },
        },
        { DB: testD1 }
      );
      expect(deleteRes.status).toBe(200);
    });

    it('prevents administrator from demoting themselves if they are the only admin', async () => {
      const res = await app.request(
        `/api/admin/users/${adminId}/role`,
        {
          method: 'PATCH',
          headers: {
            'Content-Type': 'application/json',
            Cookie: adminCookie,
          },
          body: JSON.stringify({ role: 'user' }),
        },
        { DB: testD1 }
      );

      expect(res.status).toBe(400);
      const json = await res.json();
      expect(json.message || json.error?.message).toContain('at least one administrator');
    });

    it('allows administrator to promote standard user to admin and then change back', async () => {
      // Promote user to admin
      const promoteRes = await app.request(
        `/api/admin/users/${userId}/role`,
        {
          method: 'PATCH',
          headers: {
            'Content-Type': 'application/json',
            Cookie: adminCookie,
          },
          body: JSON.stringify({ role: 'admin' }),
        },
        { DB: testD1 }
      );
      expect(promoteRes.status).toBe(200);

      // Change back to user
      const demoteRes = await app.request(
        `/api/admin/users/${userId}/role`,
        {
          method: 'PATCH',
          headers: {
            'Content-Type': 'application/json',
            Cookie: adminCookie,
          },
          body: JSON.stringify({ role: 'user' }),
        },
        { DB: testD1 }
      );
      expect(demoteRes.status).toBe(200);
    });

    it('allows administrator to deactivate user account and then re-enable', async () => {
      // Deactivate
      const disableRes = await app.request(
        `/api/admin/users/${userId}/disable`,
        {
          method: 'POST',
          headers: { Cookie: adminCookie },
        },
        { DB: testD1 }
      );
      expect(disableRes.status).toBe(200);

      // Verify user's session is terminated: user gets 401
      const checkRes = await app.request(
        '/api/tasks',
        { headers: { Cookie: userCookie } },
        { DB: testD1 }
      );
      expect(checkRes.status).toBe(401);

      // Re-enable
      const enableRes = await app.request(
        `/api/admin/users/${userId}/enable`,
        {
          method: 'POST',
          headers: { Cookie: adminCookie },
        },
        { DB: testD1 }
      );
      expect(enableRes.status).toBe(200);
    });

    it('fetches and filters security audit logs', async () => {
      const res = await app.request(
        '/api/admin/audit-logs',
        { headers: { Cookie: adminCookie } },
        { DB: testD1 }
      );

      expect(res.status).toBe(200);
      const json = (await res.json()) as ApiSuccessResponse<AuditEventData[]>;
      expect(json.data.length).toBeGreaterThanOrEqual(1);
      expect(json.data.some((l) => l.eventType.startsWith('admin.'))).toBe(true);
    });
  });
});
