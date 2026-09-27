import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import { eq } from 'drizzle-orm';
import { createDb } from '../db/client';
import { userPreferences } from '../db/schema';
import { requireAuth } from '../middleware/auth';
import { updatePreferencesSchema } from '../../shared/schemas/preferences';
import type { ApiSuccessResponse, UserPreferencesData } from '../../shared/types';
import type { AppBindings } from '../index';

const settingsRouter = new Hono<{ Bindings: AppBindings }>();

settingsRouter.use('*', requireAuth);

settingsRouter.get('/preferences', async (c) => {
  const user = c.get('user');
  const db = createDb(c.env.DB);

  let prefs = (await db.select().from(userPreferences).where(eq(userPreferences.userId, user.id)).limit(1))[0];

  if (!prefs) {
    // If not found, create defaults
    await db.insert(userPreferences).values({
      id: crypto.randomUUID(),
      userId: user.id,
      themeMode: 'system',
      accentColor: 'emerald',
      fontSize: 'normal',
      density: 'comfortable',
      borderRadius: 'medium',
      reducedMotion: 'system',
      sidebarCollapsed: 0,
      baseCurrency: 'INR',
      updatedAt: new Date(),
    });
    prefs = (await db.select().from(userPreferences).where(eq(userPreferences.userId, user.id)).limit(1))[0]!;
  }

  const data: UserPreferencesData = {
    themeMode: prefs.themeMode as 'system' | 'light' | 'dark',
    accentColor: prefs.accentColor as 'emerald' | 'indigo' | 'violet' | 'amber' | 'rose' | 'cyan',
    fontSize: prefs.fontSize as 'small' | 'normal' | 'large',
    density: prefs.density as 'compact' | 'comfortable' | 'spacious',
    borderRadius: prefs.borderRadius as 'none' | 'small' | 'medium' | 'large',
    reducedMotion: prefs.reducedMotion as 'system' | 'reduce' | 'no-preference',
    sidebarCollapsed: Boolean(prefs.sidebarCollapsed),
    timezone: prefs.timezone || 'UTC',
    baseCurrency: prefs.baseCurrency || 'INR',
  };

  return c.json<ApiSuccessResponse<UserPreferencesData>>({
    success: true,
    data,
  });
});

settingsRouter.patch('/preferences', zValidator('json', updatePreferencesSchema), async (c) => {
  const user = c.get('user');
  const db = createDb(c.env.DB);
  const input = c.req.valid('json');

  const updateValues: Record<string, unknown> = {
    updatedAt: new Date(),
  };

  if (input.themeMode !== undefined) updateValues.themeMode = input.themeMode;
  if (input.accentColor !== undefined) updateValues.accentColor = input.accentColor;
  if (input.fontSize !== undefined) updateValues.fontSize = input.fontSize;
  if (input.density !== undefined) updateValues.density = input.density;
  if (input.borderRadius !== undefined) updateValues.borderRadius = input.borderRadius;
  if (input.reducedMotion !== undefined) updateValues.reducedMotion = input.reducedMotion;
  if (input.sidebarCollapsed !== undefined) updateValues.sidebarCollapsed = input.sidebarCollapsed ? 1 : 0;
  if (input.timezone !== undefined) updateValues.timezone = input.timezone;
  if (input.baseCurrency !== undefined) updateValues.baseCurrency = input.baseCurrency;

  await db
    .update(userPreferences)
    .set(updateValues)
    .where(eq(userPreferences.userId, user.id));

  const updated = (await db.select().from(userPreferences).where(eq(userPreferences.userId, user.id)).limit(1))[0]!;

  const data: UserPreferencesData = {
    themeMode: updated.themeMode as 'system' | 'light' | 'dark',
    accentColor: updated.accentColor as 'emerald' | 'indigo' | 'violet' | 'amber' | 'rose' | 'cyan',
    fontSize: updated.fontSize as 'small' | 'normal' | 'large',
    density: updated.density as 'compact' | 'comfortable' | 'spacious',
    borderRadius: updated.borderRadius as 'none' | 'small' | 'medium' | 'large',
    reducedMotion: updated.reducedMotion as 'system' | 'reduce' | 'no-preference',
    sidebarCollapsed: Boolean(updated.sidebarCollapsed),
    timezone: updated.timezone || 'UTC',
    baseCurrency: updated.baseCurrency || 'INR',
  };

  return c.json<ApiSuccessResponse<UserPreferencesData>>({
    success: true,
    data,
  });
});

export { settingsRouter };
