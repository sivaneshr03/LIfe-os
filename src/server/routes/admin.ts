import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import { HTTPException } from 'hono/http-exception';
import { eq, and, desc, sql } from 'drizzle-orm';
import { z } from 'zod';
import { createDb } from '../db/client';
import {
  users,
  sessions,
  auditEvents,
  activityEvents,
  invites,
  tasks,
  notes,
  financeTransactions,
  financeAccounts,
  financeDebts,
  financeBudgets,
  investmentAssets,
  goals,
  habits,
  trackers,
  workouts,
  reminders,
  inAppNotifications,
  importExportJobs,
} from '../db/schema';
import { requireAdmin } from '../middleware/auth';
import { generateOpaqueToken } from '../lib/crypto';
import { logAuditEvent } from '../lib/audit';
import { inviteSchema } from '../../shared/schemas/auth';
import type {
  ApiSuccessResponse,
  PublicUser,
  AuditEventData,
  InviteData,
  ImportExportJobData,
} from '../../shared/types';
import type { AppBindings } from '../index';

const adminRouter = new Hono<{ Bindings: AppBindings }>();

// All admin routes require role === 'admin'
adminRouter.use('*', requireAdmin);

/**
 * GET /api/admin/overview
 * Returns household system statistics, entity counters, and health metrics
 */
adminRouter.get('/overview', async (c) => {
  const db = createDb(c.env.DB);

  const [
    usersCount,
    activeSessionsCount,
    tasksCount,
    notesCount,
    transactionsCount,
    accountsCount,
    debtsCount,
    budgetsCount,
    investmentsCount,
    goalsCount,
    habitsCount,
    trackersCount,
    workoutsCount,
    remindersCount,
    notificationsCount,
    jobsCount,
  ] = await Promise.all([
    db.select({ count: sql<number>`count(*)` }).from(users),
    db
      .select({ count: sql<number>`count(*)` })
      .from(sessions)
      .where(sql`expires_at > ${Date.now()}`),
    db.select({ count: sql<number>`count(*)` }).from(tasks),
    db.select({ count: sql<number>`count(*)` }).from(notes),
    db.select({ count: sql<number>`count(*)` }).from(financeTransactions),
    db.select({ count: sql<number>`count(*)` }).from(financeAccounts),
    db.select({ count: sql<number>`count(*)` }).from(financeDebts),
    db.select({ count: sql<number>`count(*)` }).from(financeBudgets),
    db.select({ count: sql<number>`count(*)` }).from(investmentAssets),
    db.select({ count: sql<number>`count(*)` }).from(goals),
    db.select({ count: sql<number>`count(*)` }).from(habits),
    db.select({ count: sql<number>`count(*)` }).from(trackers),
    db.select({ count: sql<number>`count(*)` }).from(workouts),
    db.select({ count: sql<number>`count(*)` }).from(reminders),
    db.select({ count: sql<number>`count(*)` }).from(inAppNotifications),
    db.select({ count: sql<number>`count(*)` }).from(importExportJobs),
  ]);

  const stats = {
    users: Number(usersCount[0]?.count || 0),
    activeSessions: Number(activeSessionsCount[0]?.count || 0),
    maxAllowedUsers: 5,
    modules: {
      tasks: Number(tasksCount[0]?.count || 0),
      notes: Number(notesCount[0]?.count || 0),
      financeTransactions: Number(transactionsCount[0]?.count || 0),
      financeAccounts: Number(accountsCount[0]?.count || 0),
      financeDebts: Number(debtsCount[0]?.count || 0),
      financeBudgets: Number(budgetsCount[0]?.count || 0),
      investmentAssets: Number(investmentsCount[0]?.count || 0),
      goals: Number(goalsCount[0]?.count || 0),
      habits: Number(habitsCount[0]?.count || 0),
      trackers: Number(trackersCount[0]?.count || 0),
      workouts: Number(workoutsCount[0]?.count || 0),
      reminders: Number(remindersCount[0]?.count || 0),
      notifications: Number(notificationsCount[0]?.count || 0),
      jobs: Number(jobsCount[0]?.count || 0),
    },
    system: {
      environment: c.env.ENVIRONMENT || 'local',
      database: 'connected',
      uptimeSeconds: Math.floor(process.uptime ? process.uptime() : 0),
      timestamp: Date.now(),
    },
  };

  return c.json<ApiSuccessResponse<typeof stats>>({
    success: true,
    data: stats,
  });
});

/**
 * GET /api/admin/users
 * Lists users with active session count
 */
adminRouter.get('/users', async (c) => {
  const db = createDb(c.env.DB);

  const allUsers = await db.select().from(users).orderBy(desc(users.createdAt));
  const activeSessions = await db.select().from(sessions);

  const userList: (PublicUser & { activeSessionCount: number })[] = allUsers.map((u) => {
    const userSessions = activeSessions.filter(
      (s) => s.userId === u.id && s.expiresAt.getTime() > Date.now()
    );
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

/**
 * GET /api/admin/invites
 * Lists pending invites
 */
adminRouter.get('/invites', async (c) => {
  const db = createDb(c.env.DB);
  const rows = await db
    .select()
    .from(invites)
    .orderBy(desc(invites.createdAt));

  const data: InviteData[] = rows.map((r) => ({
    id: r.id,
    code: r.code,
    email: r.email,
    role: r.role as 'admin' | 'user',
    expiresAt: r.expiresAt.getTime(),
    usedAt: r.usedAt ? r.usedAt.getTime() : null,
    createdAt: r.createdAt.getTime(),
  }));

  return c.json<ApiSuccessResponse<InviteData[]>>({
    success: true,
    data,
  });
});

/**
 * POST /api/admin/invites
 * Generate an invite code (allowlist onboarding)
 */
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

  return c.json<ApiSuccessResponse<InviteData>>(
    {
      success: true,
      data: inviteData,
    },
    201
  );
});

/**
 * DELETE /api/admin/invites/:id
 * Revokes a pending invite
 */
adminRouter.delete('/invites/:id', async (c) => {
  const db = createDb(c.env.DB);
  const currentUser = c.get('user');
  const id = c.req.param('id');

  const existing = (await db.select().from(invites).where(eq(invites.id, id)).limit(1))[0];
  if (!existing) {
    throw new HTTPException(404, { message: 'Invite not found' });
  }

  await db.delete(invites).where(eq(invites.id, id));
  await logAuditEvent(c, 'admin.invite_revoked', { inviteId: id, email: existing.email }, currentUser.id);

  return c.json<ApiSuccessResponse<{ message: string }>>({
    success: true,
    data: { message: 'Invite revoked successfully' },
  });
});

/**
 * POST /api/admin/users/:id/disable
 * Disable a user account and terminate active sessions
 */
adminRouter.post('/users/:id/disable', async (c) => {
  const db = createDb(c.env.DB);
  const currentUser = c.get('user');
  const targetId = c.req.param('id');

  if (targetId === currentUser.id) {
    throw new HTTPException(400, { message: 'Cannot disable your own administrator account' });
  }

  const targetUser = (await db.select().from(users).where(eq(users.id, targetId)).limit(1))[0];
  if (!targetUser) {
    throw new HTTPException(404, { message: 'User not found' });
  }

  await db
    .update(users)
    .set({ status: 'disabled', updatedAt: new Date() })
    .where(eq(users.id, targetId));

  // Invalidate any active sessions immediately
  await db.delete(sessions).where(eq(sessions.userId, targetId));

  await logAuditEvent(c, 'admin.user_disabled', { targetId, email: targetUser.email }, currentUser.id);

  return c.json<ApiSuccessResponse<{ message: string }>>({
    success: true,
    data: { message: 'User disabled and all active sessions terminated' },
  });
});

/**
 * POST /api/admin/users/:id/enable
 * Re-enable a disabled user account
 */
adminRouter.post('/users/:id/enable', async (c) => {
  const db = createDb(c.env.DB);
  const currentUser = c.get('user');
  const targetId = c.req.param('id');

  const targetUser = (await db.select().from(users).where(eq(users.id, targetId)).limit(1))[0];
  if (!targetUser) {
    throw new HTTPException(404, { message: 'User not found' });
  }

  await db
    .update(users)
    .set({ status: 'active', updatedAt: new Date() })
    .where(eq(users.id, targetId));

  await logAuditEvent(c, 'admin.user_enabled', { targetId, email: targetUser.email }, currentUser.id);

  return c.json<ApiSuccessResponse<{ message: string }>>({
    success: true,
    data: { message: 'User re-enabled successfully' },
  });
});

/**
 * PATCH /api/admin/users/:id/role
 * Change role of user (admin <-> user)
 */
adminRouter.patch(
  '/users/:id/role',
  zValidator('json', z.object({ role: z.enum(['admin', 'user']) })),
  async (c) => {
    const db = createDb(c.env.DB);
    const currentUser = c.get('user');
    const targetId = c.req.param('id');
    const { role } = c.req.valid('json');

    const targetUser = (await db.select().from(users).where(eq(users.id, targetId)).limit(1))[0];
    if (!targetUser) {
      throw new HTTPException(404, { message: 'User not found' });
    }

    if (targetId === currentUser.id && role !== 'admin') {
      // Check if there are other admins before allowing demotion
      const otherAdmins = await db
        .select({ id: users.id })
        .from(users)
        .where(and(eq(users.role, 'admin'), sql`id != ${currentUser.id}`));
      if (otherAdmins.length === 0) {
        throw new HTTPException(400, {
          message: 'Cannot demote yourself: instance must have at least one administrator',
        });
      }
    }

    await db
      .update(users)
      .set({ role, updatedAt: new Date() })
      .where(eq(users.id, targetId));

    // Security hardening: Invalidate sessions for target user so privileges are refreshed immediately
    if (targetId !== currentUser.id) {
      await db.delete(sessions).where(eq(sessions.userId, targetId));
    }

    await logAuditEvent(
      c,
      'admin.role_changed',
      { targetId, previousRole: targetUser.role, newRole: role },
      currentUser.id
    );

    return c.json<ApiSuccessResponse<{ message: string; role: string }>>({
      success: true,
      data: { message: `User role changed to ${role}`, role },
    });
  }
);

/**
 * DELETE /api/admin/users/:id/sessions
 * Revokes all sessions for a user
 */
adminRouter.delete('/users/:id/sessions', async (c) => {
  const db = createDb(c.env.DB);
  const currentUser = c.get('user');
  const targetId = c.req.param('id');

  await db.delete(sessions).where(eq(sessions.userId, targetId));
  await logAuditEvent(c, 'admin.sessions_revoked', { targetId }, currentUser.id);

  return c.json<ApiSuccessResponse<{ message: string }>>({
    success: true,
    data: { message: 'User sessions revoked successfully' },
  });
});

/**
 * GET /api/admin/jobs
 * Lists import and export jobs
 */
adminRouter.get('/jobs', async (c) => {
  const db = createDb(c.env.DB);
  const rows = await db
    .select()
    .from(importExportJobs)
    .orderBy(desc(importExportJobs.createdAt))
    .limit(50);

  const data: ImportExportJobData[] = rows.map((r) => ({
    id: r.id,
    userId: r.userId,
    type: r.type as 'import' | 'export',
    domain: r.domain as ImportExportJobData['domain'],
    format: r.format as 'json' | 'csv',
    status: r.status as 'pending' | 'processing' | 'completed' | 'failed',
    totalItems: r.totalItems,
    processedItems: r.processedItems,
    errorCount: r.errorCount,
    errorDetails: r.errorDetails
      ? (JSON.parse(r.errorDetails) as Array<{ row?: number; message: string }>)
      : null,
    summary: r.summary ? (JSON.parse(r.summary) as Record<string, unknown>) : null,
    createdAt: r.createdAt.getTime(),
    completedAt: r.completedAt ? r.completedAt.getTime() : null,
  }));

  return c.json<ApiSuccessResponse<ImportExportJobData[]>>({
    success: true,
    data,
  });
});

/**
 * POST /api/admin/jobs/:id/retry
 * Retries a failed job
 */
adminRouter.post('/jobs/:id/retry', async (c) => {
  const db = createDb(c.env.DB);
  const currentUser = c.get('user');
  const id = c.req.param('id');

  const existing = (await db.select().from(importExportJobs).where(eq(importExportJobs.id, id)).limit(1))[0];
  if (!existing) {
    throw new HTTPException(404, { message: 'Job not found' });
  }

  await db
    .update(importExportJobs)
    .set({
      status: 'pending',
      errorCount: 0,
      errorDetails: null,
    })
    .where(eq(importExportJobs.id, id));

  await logAuditEvent(c, 'admin.job_retried', { jobId: id }, currentUser.id);

  return c.json<ApiSuccessResponse<{ message: string }>>({
    success: true,
    data: { message: 'Job queued for retry' },
  });
});

/**
 * GET /api/admin/audit-logs
 * View security audit trail
 */
adminRouter.get('/audit-logs', async (c) => {
  const db = createDb(c.env.DB);
  const eventType = c.req.query('eventType');
  const userId = c.req.query('userId');

  const conditions = [];
  if (eventType) {
    conditions.push(eq(auditEvents.eventType, eventType));
  }
  if (userId) {
    conditions.push(eq(auditEvents.userId, userId));
  }

  const logs = await db
    .select()
    .from(auditEvents)
    .where(conditions.length > 0 ? and(...conditions) : undefined)
    .orderBy(desc(auditEvents.createdAt))
    .limit(100);

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

/**
 * GET /api/admin/activity-logs & /api/admin/audit-events
 * View activity stream
 */
adminRouter.get('/activity-logs', async (c) => {
  const db = createDb(c.env.DB);
  const logs = await db
    .select()
    .from(activityEvents)
    .orderBy(desc(activityEvents.createdAt))
    .limit(100);

  return c.json<ApiSuccessResponse<typeof logs>>({
    success: true,
    data: logs,
  });
});

adminRouter.get('/audit-events', async (c) => {
  const db = createDb(c.env.DB);
  const logs = await db
    .select()
    .from(activityEvents)
    .orderBy(desc(activityEvents.createdAt))
    .limit(100);

  return c.json<ApiSuccessResponse<typeof logs>>({
    success: true,
    data: logs,
  });
});

export { adminRouter };
