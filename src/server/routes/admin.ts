import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import { HTTPException } from 'hono/http-exception';
import { eq, desc, sql } from 'drizzle-orm';
import { createDb } from '../db/client';
import { users, sessions, auditEvents, invites } from '../db/schema';
import { requireAdmin } from '../middleware/auth';
import { generateOpaqueToken } from '../lib/crypto';
import { logAuditEvent } from '../lib/audit';
import { inviteSchema } from '../../shared/schemas/auth';
import type { ApiSuccessResponse, PublicUser, AuditEventData, InviteData } from '../../shared/types';
import type { AppBindings } from '../index';

const adminRouter = new Hono<{ Bindings: AppBindings }>();

// All admin routes require role === 'admin'
adminRouter.use('*', requireAdmin);

// List users with session count
adminRouter.get('/users', async (c) => {
  const db = createDb(c.env.DB);

  const allUsers = await db.select().from(users).orderBy(desc(users.createdAt));
  const activeSessions = await db.select().from(sessions);

  const userList: (PublicUser & { activeSessionCount: number })[] = allUsers.map((u) => {
    const userSessions = activeSessions.filter((s) => s.userId === u.id && s.expiresAt.getTime() > Date.now());
    return {
      id: u.id,
      email: u.email,
      name: u.name,
      role: u.role as 'admin' | 'user',
      status: u.status as 'active' | 'invited' | 'disabled',
      createdAt: u.createdAt.getTime(),
      activeSessionCount: userSessions.length,
    };
  });

  return c.json<ApiSuccessResponse<(PublicUser & { activeSessionCount: number })[]>>({
    success: true,
    data: userList,
  });
});

// Generate an invite code (allowlist onboarding)
adminRouter.post('/invites', zValidator('json', inviteSchema), async (c) => {
  const db = createDb(c.env.DB);
  const currentUser = c.get('user');
  const { email, role } = c.req.valid('json');

  // Verify total user cap (max 5 users for private instance)
  const countResult = await db.select({ count: sql<number>`count(*)` }).from(users);
  if (Number(countResult[0]?.count || 0) >= 5) {
    throw new HTTPException(400, {
      message: 'Private user limit reached (maximum 5 users allowed for this instance).',
    });
  }

  const inviteCode = generateOpaqueToken(12);
  const inviteId = generateOpaqueToken(16);
  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days

  await db.insert(invites).values({
    id: inviteId,
    code: inviteCode,
    email,
    role,
    createdBy: currentUser.id,
    expiresAt,
    createdAt: new Date(),
  });

  await logAuditEvent(c, 'admin.invite_created', { email, role }, currentUser.id);

  const inviteData: InviteData = {
    id: inviteId,
    code: inviteCode,
    email,
    role,
    expiresAt: expiresAt.getTime(),
    createdAt: Date.now(),
  };

  return c.json<ApiSuccessResponse<InviteData>>({
    success: true,
    data: inviteData,
  }, 201);
});

// Disable a user account
adminRouter.post('/users/:id/disable', async (c) => {
  const db = createDb(c.env.DB);
  const currentUser = c.get('user');
  const targetId = c.req.param('id');

  if (targetId === currentUser.id) {
    throw new HTTPException(400, { message: 'Cannot disable your own administrator account' });
  }

  await db
    .update(users)
    .set({ status: 'disabled', updatedAt: new Date() })
    .where(eq(users.id, targetId));

  // Invalidate any active sessions immediately
  await db.delete(sessions).where(eq(sessions.userId, targetId));

  await logAuditEvent(c, 'admin.user_disabled', { targetId }, currentUser.id);

  return c.json<ApiSuccessResponse<{ message: string }>>({
    success: true,
    data: { message: 'User disabled and all active sessions terminated' },
  });
});

// View security audit trail
adminRouter.get('/audit-logs', async (c) => {
  const db = createDb(c.env.DB);
  const logs = await db.select().from(auditEvents).orderBy(desc(auditEvents.createdAt)).limit(50);

  const logData: AuditEventData[] = logs.map((l) => ({
    id: l.id,
    userId: l.userId,
    eventType: l.eventType,
    ipHash: l.ipHash,
    metadata: l.metadata ? (JSON.parse(l.metadata) as Record<string, unknown>) : null,
    createdAt: l.createdAt.getTime(),
  }));

  return c.json<ApiSuccessResponse<AuditEventData[]>>({
    success: true,
    data: logData,
  });
});

export { adminRouter };
