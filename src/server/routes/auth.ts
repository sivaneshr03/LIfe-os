import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import { setCookie, deleteCookie } from 'hono/cookie';
import { HTTPException } from 'hono/http-exception';
import { eq, sql } from 'drizzle-orm';
import { createDb } from '../db/client';
import { users, sessions, userPreferences, invites, type User } from '../db/schema';
import { hashPassword, verifyPassword, generateOpaqueToken, hashIp } from '../lib/crypto';
import { logAuditEvent } from '../lib/audit';
import { requireAuth, SESSION_COOKIE_NAME } from '../middleware/auth';
import { createRateLimiter } from '../middleware/rateLimit';
import { loginSchema, bootstrapSchema, changePasswordSchema, acceptInviteSchema } from '../../shared/schemas/auth';
import type { ApiSuccessResponse, AuthSessionData, PublicUser, UserPreferencesData } from '../../shared/types';
import type { AppBindings } from '../index';

const authRouter = new Hono<{ Bindings: AppBindings }>();

function formatPublicUser(u: User): PublicUser {
  return {
    id: u.id,
    email: u.email,
    name: u.name,
    role: u.role as 'admin' | 'user',
    status: u.status as 'active' | 'invited' | 'disabled',
    createdAt: u.createdAt.getTime(),
  };
}

const defaultPreferences: UserPreferencesData = {
  themeMode: 'system',
  accentColor: 'emerald',
  fontSize: 'normal',
  density: 'comfortable',
  borderRadius: 'medium',
  reducedMotion: 'system',
  sidebarCollapsed: false,
};

// Check if first-run setup is required
authRouter.get('/status', async (c) => {
  if (!c.env?.DB) throw new HTTPException(503, { message: 'Database unavailable' });
  const db = createDb(c.env.DB);
  const countResult = await db.select({ count: sql<number>`count(*)` }).from(users);
  const userCount = Number(countResult[0]?.count || 0);

  return c.json<ApiSuccessResponse<{ setupRequired: boolean }>>({
    success: true,
    data: { setupRequired: userCount === 0 },
  });
});

// First-time Admin Bootstrap (Permitted ONLY if 0 users exist)
authRouter.post('/bootstrap', zValidator('json', bootstrapSchema), async (c) => {
  if (!c.env?.DB) throw new HTTPException(503, { message: 'Database unavailable' });
  const db = createDb(c.env.DB);
  const body = c.req.valid('json');

  const countResult = await db.select({ count: sql<number>`count(*)` }).from(users);
  const userCount = Number(countResult[0]?.count || 0);

  if (userCount > 0) {
    throw new HTTPException(403, {
      message: 'Setup has already been completed. New users must be invited by an Administrator.',
    });
  }

  const { hash, salt } = await hashPassword(body.password);
  const userId = generateOpaqueToken(16);
  const now = new Date();

  await db.insert(users).values({
    id: userId,
    email: body.email,
    passwordHash: hash,
    salt,
    name: body.name,
    role: 'admin',
    status: 'active',
    createdAt: now,
    updatedAt: now,
  });

  // Create default preferences
  await db.insert(userPreferences).values({
    id: generateOpaqueToken(16),
    userId,
    themeMode: 'system',
    accentColor: 'emerald',
    fontSize: 'normal',
    density: 'comfortable',
    borderRadius: 'medium',
    reducedMotion: 'system',
    sidebarCollapsed: 0,
    updatedAt: now,
  });

  // Create initial 30-day session
  const sessionId = generateOpaqueToken(32);
  const expiresAt = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
  const clientIp = c.req.header('cf-connecting-ip') || c.req.header('x-forwarded-for') || '127.0.0.1';
  const ipHash = await hashIp(clientIp);

  await db.insert(sessions).values({
    id: sessionId,
    userId,
    expiresAt,
    createdAt: now,
    lastActiveAt: now,
    ipHash,
    userAgent: c.req.header('user-agent')?.slice(0, 255),
  });

  const isProd = c.env.ENVIRONMENT === 'production' || c.env.ENVIRONMENT === 'preview';
  setCookie(c, SESSION_COOKIE_NAME, sessionId, {
    httpOnly: true,
    secure: isProd,
    sameSite: 'Lax',
    path: '/',
    maxAge: 30 * 24 * 60 * 60,
  });

  await logAuditEvent(c, 'auth.bootstrap_success', { email: body.email }, userId);

  const createdUser = (await db.select().from(users).where(eq(users.id, userId)).limit(1))[0]!;

  return c.json<ApiSuccessResponse<AuthSessionData>>({
    success: true,
    data: {
      user: formatPublicUser(createdUser),
      preferences: defaultPreferences,
      isInitialSetup: true,
    },
  }, 201);
});

// Login endpoint with rate limiting (max 5 failed attempts per 15 minutes)
authRouter.post('/login', createRateLimiter({ max: 5, windowMs: 15 * 60 * 1000 }), zValidator('json', loginSchema), async (c) => {
  if (!c.env?.DB) throw new HTTPException(503, { message: 'Database unavailable' });
  const db = createDb(c.env.DB);
  const { email, password } = c.req.valid('json');

  const userRecord = (await db.select().from(users).where(eq(users.email, email)).limit(1))[0];

  if (!userRecord || userRecord.status !== 'active') {
    await logAuditEvent(c, 'auth.login_failed', { email, reason: 'user_not_found_or_disabled' });
    throw new HTTPException(401, { message: 'Invalid email or password' });
  }

  const isValidPassword = await verifyPassword(password, userRecord.passwordHash, userRecord.salt);

  if (!isValidPassword) {
    await logAuditEvent(c, 'auth.login_failed', { email, reason: 'invalid_password' }, userRecord.id);
    throw new HTTPException(401, { message: 'Invalid email or password' });
  }

  const sessionId = generateOpaqueToken(32);
  const now = new Date();
  const expiresAt = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
  const clientIp = c.req.header('cf-connecting-ip') || c.req.header('x-forwarded-for') || '127.0.0.1';
  const ipHash = await hashIp(clientIp);

  await db.insert(sessions).values({
    id: sessionId,
    userId: userRecord.id,
    expiresAt,
    createdAt: now,
    lastActiveAt: now,
    ipHash,
    userAgent: c.req.header('user-agent')?.slice(0, 255),
  });

  const isProd = c.env.ENVIRONMENT === 'production' || c.env.ENVIRONMENT === 'preview';
  setCookie(c, SESSION_COOKIE_NAME, sessionId, {
    httpOnly: true,
    secure: isProd,
    sameSite: 'Lax',
    path: '/',
    maxAge: 30 * 24 * 60 * 60,
  });

  await logAuditEvent(c, 'auth.login_success', {}, userRecord.id);

  // Fetch preferences
  const prefs = (await db.select().from(userPreferences).where(eq(userPreferences.userId, userRecord.id)).limit(1))[0];
  const userPrefsData: UserPreferencesData = prefs
    ? {
        themeMode: prefs.themeMode as 'system' | 'light' | 'dark',
        accentColor: prefs.accentColor as 'emerald' | 'indigo' | 'violet' | 'amber' | 'rose' | 'cyan',
        fontSize: prefs.fontSize as 'small' | 'normal' | 'large',
        density: prefs.density as 'compact' | 'comfortable' | 'spacious',
        borderRadius: prefs.borderRadius as 'none' | 'small' | 'medium' | 'large',
        reducedMotion: prefs.reducedMotion as 'system' | 'reduce' | 'no-preference',
        sidebarCollapsed: Boolean(prefs.sidebarCollapsed),
      }
    : defaultPreferences;

  return c.json<ApiSuccessResponse<AuthSessionData>>({
    success: true,
    data: {
      user: formatPublicUser(userRecord),
      preferences: userPrefsData,
      isInitialSetup: false,
    },
  });
});

// Onboard a user using an invite code (allowlist onboarding foundation)
authRouter.post('/register', zValidator('json', acceptInviteSchema), async (c) => {
  if (!c.env?.DB) throw new HTTPException(503, { message: 'Database unavailable' });
  const db = createDb(c.env.DB);
  const { code, name, password } = c.req.valid('json');

  // Verify invite
  const inviteRecord = (await db.select().from(invites).where(eq(invites.code, code)).limit(1))[0];
  if (!inviteRecord) {
    await logAuditEvent(c, 'auth.register_failed', { reason: 'invalid_invite_code' });
    throw new HTTPException(400, { message: 'Invalid or unrecognized invite code' });
  }

  if (inviteRecord.usedAt !== null) {
    await logAuditEvent(c, 'auth.register_failed', { reason: 'invite_already_used', email: inviteRecord.email });
    throw new HTTPException(400, { message: 'This invite code has already been used' });
  }

  const now = new Date();
  if (inviteRecord.expiresAt.getTime() < now.getTime()) {
    await logAuditEvent(c, 'auth.register_failed', { reason: 'invite_expired', email: inviteRecord.email });
    throw new HTTPException(400, { message: 'This invite code has expired' });
  }

  // Check 5-user cap
  const countResult = await db.select({ count: sql<number>`count(*)` }).from(users);
  const userCount = Number(countResult[0]?.count || 0);
  if (userCount >= 5) {
    throw new HTTPException(400, {
      message: 'Private user limit reached (maximum 5 users allowed for this instance).',
    });
  }

  // Check if email is already registered
  const existingUser = (await db.select().from(users).where(eq(users.email, inviteRecord.email)).limit(1))[0];
  if (existingUser) {
    throw new HTTPException(400, { message: 'A user account with this email already exists' });
  }

  const { hash, salt } = await hashPassword(password);
  const userId = generateOpaqueToken(16);

  // Insert user
  await db.insert(users).values({
    id: userId,
    email: inviteRecord.email,
    passwordHash: hash,
    salt,
    name,
    role: inviteRecord.role,
    status: 'active',
    createdAt: now,
    updatedAt: now,
  });

  // Mark invite as used
  await db
    .update(invites)
    .set({ usedAt: now })
    .where(eq(invites.id, inviteRecord.id));

  // Create default preferences
  await db.insert(userPreferences).values({
    id: generateOpaqueToken(16),
    userId,
    themeMode: 'system',
    accentColor: 'emerald',
    fontSize: 'normal',
    density: 'comfortable',
    borderRadius: 'medium',
    reducedMotion: 'system',
    sidebarCollapsed: 0,
    updatedAt: now,
  });

  // Create initial 30-day session
  const sessionId = generateOpaqueToken(32);
  const expiresAt = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
  const clientIp = c.req.header('cf-connecting-ip') || c.req.header('x-forwarded-for') || '127.0.0.1';
  const ipHash = await hashIp(clientIp);

  await db.insert(sessions).values({
    id: sessionId,
    userId,
    expiresAt,
    createdAt: now,
    lastActiveAt: now,
    ipHash,
    userAgent: c.req.header('user-agent')?.slice(0, 255),
  });

  const isProd = c.env.ENVIRONMENT === 'production' || c.env.ENVIRONMENT === 'preview';
  setCookie(c, SESSION_COOKIE_NAME, sessionId, {
    httpOnly: true,
    secure: isProd,
    sameSite: 'Lax',
    path: '/',
    maxAge: 30 * 24 * 60 * 60,
  });

  await logAuditEvent(c, 'auth.invite_registered', { email: inviteRecord.email, role: inviteRecord.role }, userId);

  const createdUser = (await db.select().from(users).where(eq(users.id, userId)).limit(1))[0]!;

  return c.json<ApiSuccessResponse<AuthSessionData>>({
    success: true,
    data: {
      user: formatPublicUser(createdUser),
      preferences: defaultPreferences,
      isInitialSetup: false,
    },
  }, 201);
});

// Logout endpoint
authRouter.post('/logout', async (c) => {
  const sessionId = c.req.header('cookie')?.match(new RegExp(`${SESSION_COOKIE_NAME}=([^;]+)`))?.[1];

  if (sessionId && c.env?.DB) {
    const db = createDb(c.env.DB);
    await db.delete(sessions).where(eq(sessions.id, sessionId));
    await logAuditEvent(c, 'auth.logout');
  }

  deleteCookie(c, SESSION_COOKIE_NAME, { path: '/' });

  return c.json<ApiSuccessResponse<{ loggedOut: true }>>({
    success: true,
    data: { loggedOut: true },
  });
});

// Current user profile & session verification
authRouter.get('/me', requireAuth, async (c) => {
  const user = c.get('user');
  const db = createDb(c.env.DB);

  const prefs = (await db.select().from(userPreferences).where(eq(userPreferences.userId, user.id)).limit(1))[0];
  const userPrefsData: UserPreferencesData = prefs
    ? {
        themeMode: prefs.themeMode as 'system' | 'light' | 'dark',
        accentColor: prefs.accentColor as 'emerald' | 'indigo' | 'violet' | 'amber' | 'rose' | 'cyan',
        fontSize: prefs.fontSize as 'small' | 'normal' | 'large',
        density: prefs.density as 'compact' | 'comfortable' | 'spacious',
        borderRadius: prefs.borderRadius as 'none' | 'small' | 'medium' | 'large',
        reducedMotion: prefs.reducedMotion as 'system' | 'reduce' | 'no-preference',
        sidebarCollapsed: Boolean(prefs.sidebarCollapsed),
      }
    : defaultPreferences;

  return c.json<ApiSuccessResponse<AuthSessionData>>({
    success: true,
    data: {
      user: formatPublicUser(user),
      preferences: userPrefsData,
      isInitialSetup: false,
    },
  });
});

// Password change
authRouter.post('/change-password', requireAuth, zValidator('json', changePasswordSchema), async (c) => {
  const user = c.get('user');
  const db = createDb(c.env.DB);
  const { currentPassword, newPassword } = c.req.valid('json');

  const isValidCurrent = await verifyPassword(currentPassword, user.passwordHash, user.salt);
  if (!isValidCurrent) {
    throw new HTTPException(400, { message: 'Current password does not match' });
  }

  const { hash: newHash, salt: newSalt } = await hashPassword(newPassword);

  await db
    .update(users)
    .set({
      passwordHash: newHash,
      salt: newSalt,
      updatedAt: new Date(),
    })
    .where(eq(users.id, user.id));

  await logAuditEvent(c, 'auth.password_changed', {}, user.id);

  return c.json<ApiSuccessResponse<{ message: string }>>({
    success: true,
    data: { message: 'Password successfully updated' },
  });
});

export { authRouter };
