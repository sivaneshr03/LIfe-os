import { sqliteTable, text, integer, index } from 'drizzle-orm/sqlite-core';

/**
 * System metadata table used for verifying database health
 */
export const systemMeta = sqliteTable('system_meta', {
  key: text('key').primaryKey(),
  value: text('value').notNull(),
  updatedAt: integer('updated_at', { mode: 'timestamp_ms' })
    .notNull()
    .$defaultFn(() => new Date()),
});

/**
 * Users table: Private app user accounts (1–5 users max)
 */
export const users = sqliteTable(
  'users',
  {
    id: text('id').primaryKey(),
    email: text('email').notNull().unique(),
    passwordHash: text('password_hash').notNull(),
    salt: text('salt').notNull(),
    name: text('name').notNull(),
    role: text('role', { enum: ['admin', 'user'] }).notNull().default('user'),
    status: text('status', { enum: ['active', 'invited', 'disabled'] }).notNull().default('active'),
    createdAt: integer('created_at', { mode: 'timestamp_ms' })
      .notNull()
      .$defaultFn(() => new Date()),
    updatedAt: integer('updated_at', { mode: 'timestamp_ms' })
      .notNull()
      .$defaultFn(() => new Date()),
  },
  (table) => ({
    emailIdx: index('idx_users_email').on(table.email),
  })
);

/**
 * Sessions table: Server-side opaque sessions delivered via HttpOnly cookies
 */
export const sessions = sqliteTable(
  'sessions',
  {
    id: text('id').primaryKey(), // 256-bit cryptographically secure opaque token
    userId: text('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    expiresAt: integer('expires_at', { mode: 'timestamp_ms' }).notNull(),
    createdAt: integer('created_at', { mode: 'timestamp_ms' })
      .notNull()
      .$defaultFn(() => new Date()),
    lastActiveAt: integer('last_active_at', { mode: 'timestamp_ms' })
      .notNull()
      .$defaultFn(() => new Date()),
    ipHash: text('ip_hash'),
    userAgent: text('user_agent'),
  },
  (table) => ({
    userExpiresIdx: index('idx_sessions_user_expires').on(table.userId, table.expiresAt),
  })
);

/**
 * User Preferences table: UI design tokens, theming, layout, and accessibility
 */
export const userPreferences = sqliteTable('user_preferences', {
  id: text('id').primaryKey(),
  userId: text('user_id')
    .notNull()
    .unique()
    .references(() => users.id, { onDelete: 'cascade' }),
  themeMode: text('theme_mode', { enum: ['system', 'light', 'dark'] })
    .notNull()
    .default('system'),
  accentColor: text('accent_color', { enum: ['emerald', 'indigo', 'violet', 'amber', 'rose', 'cyan'] })
    .notNull()
    .default('emerald'),
  fontSize: text('font_size', { enum: ['small', 'normal', 'large'] })
    .notNull()
    .default('normal'),
  density: text('density', { enum: ['compact', 'comfortable', 'spacious'] })
    .notNull()
    .default('comfortable'),
  borderRadius: text('border_radius', { enum: ['none', 'small', 'medium', 'large'] })
    .notNull()
    .default('medium'),
  reducedMotion: text('reduced_motion', { enum: ['system', 'reduce', 'no-preference'] })
    .notNull()
    .default('system'),
  sidebarCollapsed: integer('sidebar_collapsed').notNull().default(0),
  updatedAt: integer('updated_at', { mode: 'timestamp_ms' })
    .notNull()
    .$defaultFn(() => new Date()),
});

/**
 * Audit Events table: Security & administrative action tracking
 */
export const auditEvents = sqliteTable(
  'audit_events',
  {
    id: text('id').primaryKey(),
    userId: text('user_id').references(() => users.id, { onDelete: 'set null' }),
    eventType: text('event_type').notNull(),
    ipHash: text('ip_hash'),
    metadata: text('metadata'), // JSON string
    createdAt: integer('created_at', { mode: 'timestamp_ms' })
      .notNull()
      .$defaultFn(() => new Date()),
  },
  (table) => ({
    createdIdx: index('idx_audit_events_created').on(table.createdAt),
  })
);

/**
 * Invites table: Allowlist onboarding for private 1–5 user instance
 */
export const invites = sqliteTable('invites', {
  id: text('id').primaryKey(),
  code: text('code').notNull().unique(),
  email: text('email').notNull(),
  role: text('role', { enum: ['admin', 'user'] }).notNull().default('user'),
  createdBy: text('created_by')
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),
  expiresAt: integer('expires_at', { mode: 'timestamp_ms' }).notNull(),
  usedAt: integer('used_at', { mode: 'timestamp_ms' }),
  createdAt: integer('created_at', { mode: 'timestamp_ms' })
    .notNull()
    .$defaultFn(() => new Date()),
});

export type User = typeof users.$inferSelect;
export type InsertUser = typeof users.$inferInsert;
export type Session = typeof sessions.$inferSelect;
export type UserPreferences = typeof userPreferences.$inferSelect;
export type AuditEvent = typeof auditEvents.$inferSelect;
export type Invite = typeof invites.$inferSelect;
