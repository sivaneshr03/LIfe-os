import { sqliteTable, text, integer, index, uniqueIndex, type AnySQLiteColumn } from 'drizzle-orm/sqlite-core';
import { domainEnum, entityTypeEnum } from '../../shared/platformTypes';
import {
  taskStatusEnum,
  taskPriorityEnum,
  projectStatusEnum,
  recurrenceFrequencyEnum,
  recurrenceEndTypeEnum,
  recurrenceExceptionActionEnum,
} from '../../shared/productivityTypes';
import {
  habitFrequencyEnum,
  trackerTypeEnum,
  trackerPeriodEnum,
  workoutTypeEnum,
  goalStatusEnum,
  goalTimeframeEnum,
} from '../../shared/trackerTypes';
import {
  financeAccountTypeEnum,
  financeTransactionTypeEnum,
  budgetPeriodEnum,
  financeDebtTypeEnum,
} from '../../shared/financeTypes';

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
 * User Preferences table: UI design tokens, theming, layout, accessibility, and defaults
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
  timezone: text('timezone').notNull().default('UTC'),
  baseCurrency: text('base_currency').notNull().default('INR'),
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

/**
 * Categories table: Domain-isolated hierarchical taxonomy (Finance, Tasks, Notes, Fitness, Tracker, Goal)
 */
export const categories = sqliteTable(
  'categories',
  {
    id: text('id').primaryKey(),
    userId: text('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    domain: text('domain', { enum: domainEnum }).notNull(),
    parentId: text('parent_id').references((): AnySQLiteColumn => categories.id, {
      onDelete: 'restrict',
    }),
    name: text('name').notNull(),
    slug: text('slug').notNull(),
    icon: text('icon'),
    color: text('color'),
    description: text('description'),
    isDefault: integer('is_default').notNull().default(0),
    isEnabled: integer('is_enabled').notNull().default(1),
    sortOrder: integer('sort_order').notNull().default(0),
    createdAt: integer('created_at', { mode: 'timestamp_ms' })
      .notNull()
      .$defaultFn(() => new Date()),
    updatedAt: integer('updated_at', { mode: 'timestamp_ms' })
      .notNull()
      .$defaultFn(() => new Date()),
  },
  (table) => ({
    userDomainIdx: index('idx_categories_user_domain').on(table.userId, table.domain, table.isEnabled),
    userParentIdx: index('idx_categories_user_parent').on(table.userId, table.parentId),
    uniqueCategorySlug: uniqueIndex('uidx_categories_user_domain_parent_slug').on(
      table.userId,
      table.domain,
      table.parentId,
      table.slug
    ),
  })
);

/**
 * Tags table: Generic user tag dictionary
 */
export const tags = sqliteTable(
  'tags',
  {
    id: text('id').primaryKey(),
    userId: text('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    name: text('name').notNull(),
    slug: text('slug').notNull(),
    color: text('color'),
    createdAt: integer('created_at', { mode: 'timestamp_ms' })
      .notNull()
      .$defaultFn(() => new Date()),
    updatedAt: integer('updated_at', { mode: 'timestamp_ms' })
      .notNull()
      .$defaultFn(() => new Date()),
  },
  (table) => ({
    userTagSlugUnique: uniqueIndex('uidx_tags_user_slug').on(table.userId, table.slug),
    userTagCreatedIdx: index('idx_tags_user_created').on(table.userId, table.createdAt),
  })
);

/**
 * Entity Tags table: Polymorphic association between tags and any domain entity
 */
export const entityTags = sqliteTable(
  'entity_tags',
  {
    id: text('id').primaryKey(),
    userId: text('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    tagId: text('tag_id')
      .notNull()
      .references(() => tags.id, { onDelete: 'cascade' }),
    entityType: text('entity_type', { enum: entityTypeEnum }).notNull(),
    entityId: text('entity_id').notNull(),
    createdAt: integer('created_at', { mode: 'timestamp_ms' })
      .notNull()
      .$defaultFn(() => new Date()),
  },
  (table) => ({
    uniqueEntityTag: uniqueIndex('uidx_entity_tags_unique').on(
      table.userId,
      table.entityType,
      table.entityId,
      table.tagId
    ),
    entityLookupIdx: index('idx_entity_tags_lookup').on(table.userId, table.entityType, table.entityId),
    tagLookupIdx: index('idx_entity_tags_tag').on(table.userId, table.tagId),
  })
);

/**
 * Reminders table: Generic multi-entity scheduled reminders
 */
export const reminders = sqliteTable(
  'reminders',
  {
    id: text('id').primaryKey(),
    userId: text('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    entityType: text('entity_type', { enum: entityTypeEnum }).notNull(),
    entityId: text('entity_id'),
    title: text('title').notNull(),
    description: text('description'),
    remindAt: integer('remind_at', { mode: 'timestamp_ms' }).notNull(),
    recurrenceRule: text('recurrence_rule'),
    status: text('status', { enum: ['pending', 'triggered', 'acknowledged', 'dismissed', 'snoozed'] })
      .notNull()
      .default('pending'),
    snoozedUntil: integer('snoozed_until', { mode: 'timestamp_ms' }),
    dismissedAt: integer('dismissed_at', { mode: 'timestamp_ms' }),
    createdAt: integer('created_at', { mode: 'timestamp_ms' })
      .notNull()
      .$defaultFn(() => new Date()),
    updatedAt: integer('updated_at', { mode: 'timestamp_ms' })
      .notNull()
      .$defaultFn(() => new Date()),
  },
  (table) => ({
    userDueIdx: index('idx_reminders_user_due').on(table.userId, table.status, table.remindAt),
    userEntityIdx: index('idx_reminders_user_entity').on(table.userId, table.entityType, table.entityId),
  })
);

/**
 * In-App Notifications table: Feed of alerts, reminders, and system notifications
 */
export const inAppNotifications = sqliteTable(
  'in_app_notifications',
  {
    id: text('id').primaryKey(),
    userId: text('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    type: text('type', {
      enum: ['reminder', 'system', 'budget_alert', 'import_completed', 'security', 'streak'],
    }).notNull(),
    title: text('title').notNull(),
    body: text('body').notNull(),
    level: text('level', { enum: ['info', 'warning', 'critical', 'success'] })
      .notNull()
      .default('info'),
    entityType: text('entity_type', { enum: entityTypeEnum }),
    entityId: text('entity_id'),
    actionUrl: text('action_url'),
    isRead: integer('is_read').notNull().default(0),
    readAt: integer('read_at', { mode: 'timestamp_ms' }),
    createdAt: integer('created_at', { mode: 'timestamp_ms' })
      .notNull()
      .$defaultFn(() => new Date()),
  },
  (table) => ({
    userUnreadIdx: index('idx_notifications_user_unread').on(table.userId, table.isRead, table.createdAt),
    userCreatedIdx: index('idx_notifications_user_created').on(table.userId, table.createdAt),
  })
);

/**
 * Activity Events table: User activity stream and domain event audit trail
 */
export const activityEvents = sqliteTable(
  'activity_events',
  {
    id: text('id').primaryKey(),
    userId: text('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    domain: text('domain', { enum: [...domainEnum, 'auth', 'system'] }).notNull(),
    action: text('action').notNull(),
    entityType: text('entity_type').notNull(),
    entityId: text('entity_id').notNull(),
    summary: text('summary').notNull(),
    metadata: text('metadata'),
    ipHash: text('ip_hash'),
    createdAt: integer('created_at', { mode: 'timestamp_ms' })
      .notNull()
      .$defaultFn(() => new Date()),
  },
  (table) => ({
    userTimelineIdx: index('idx_activity_user_timeline').on(table.userId, table.domain, table.createdAt),
    userEntityIdx: index('idx_activity_user_entity').on(table.userId, table.entityType, table.entityId),
  })
);

/**
 * Saved Views table: User-configured filter and sort presets per domain
 */
export const savedViews = sqliteTable(
  'saved_views',
  {
    id: text('id').primaryKey(),
    userId: text('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    domain: text('domain', { enum: domainEnum }).notNull(),
    name: text('name').notNull(),
    filterConfig: text('filter_config').notNull(),
    sortConfig: text('sort_config'),
    isPinned: integer('is_pinned').notNull().default(0),
    isDefault: integer('is_default').notNull().default(0),
    sortOrder: integer('sort_order').notNull().default(0),
    createdAt: integer('created_at', { mode: 'timestamp_ms' })
      .notNull()
      .$defaultFn(() => new Date()),
    updatedAt: integer('updated_at', { mode: 'timestamp_ms' })
      .notNull()
      .$defaultFn(() => new Date()),
  },
  (table) => ({
    userDomainIdx: index('idx_saved_views_user_domain').on(
      table.userId,
      table.domain,
      table.isPinned,
      table.sortOrder
    ),
  })
);

/**
 * Import/Export Job Records table: Background batch job statuses
 */
export const importExportJobs = sqliteTable(
  'import_export_jobs',
  {
    id: text('id').primaryKey(),
    userId: text('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    type: text('type', { enum: ['import', 'export'] }).notNull(),
    domain: text('domain', { enum: [...domainEnum, 'all'] }).notNull(),
    format: text('format', { enum: ['json', 'csv'] }).notNull(),
    status: text('status', { enum: ['pending', 'processing', 'completed', 'failed'] })
      .notNull()
      .default('pending'),
    totalItems: integer('total_items').notNull().default(0),
    processedItems: integer('processed_items').notNull().default(0),
    errorCount: integer('error_count').notNull().default(0),
    errorDetails: text('error_details'),
    summary: text('summary'),
    createdAt: integer('created_at', { mode: 'timestamp_ms' })
      .notNull()
      .$defaultFn(() => new Date()),
    completedAt: integer('completed_at', { mode: 'timestamp_ms' }),
  },
  (table) => ({
    userStatusIdx: index('idx_jobs_user_status').on(table.userId, table.type, table.status, table.createdAt),
  })
);

/**
 * Attachment Metadata table: Binary file references (R2 storage deferred)
 */
export const attachmentMeta = sqliteTable(
  'attachment_meta',
  {
    id: text('id').primaryKey(),
    userId: text('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    entityType: text('entity_type', { enum: entityTypeEnum }).notNull(),
    entityId: text('entity_id').notNull(),
    fileName: text('file_name').notNull(),
    fileSize: integer('file_size').notNull(),
    mimeType: text('mime_type').notNull(),
    storageProvider: text('storage_provider', { enum: ['deferred', 'local_stub'] })
      .notNull()
      .default('deferred'),
    storageKey: text('storage_key'),
    sha256: text('sha256'),
    createdAt: integer('created_at', { mode: 'timestamp_ms' })
      .notNull()
      .$defaultFn(() => new Date()),
  },
  (table) => ({
    userEntityIdx: index('idx_attachments_user_entity').on(table.userId, table.entityType, table.entityId),
  })
);

export type User = typeof users.$inferSelect;
export type InsertUser = typeof users.$inferInsert;
export type Session = typeof sessions.$inferSelect;
export type UserPreferences = typeof userPreferences.$inferSelect;
export type AuditEvent = typeof auditEvents.$inferSelect;
export type Invite = typeof invites.$inferSelect;

export type Category = typeof categories.$inferSelect;
export type InsertCategory = typeof categories.$inferInsert;
export type Tag = typeof tags.$inferSelect;
export type InsertTag = typeof tags.$inferInsert;
export type EntityTag = typeof entityTags.$inferSelect;
export type InsertEntityTag = typeof entityTags.$inferInsert;
export type Reminder = typeof reminders.$inferSelect;
export type InsertReminder = typeof reminders.$inferInsert;
export type InAppNotification = typeof inAppNotifications.$inferSelect;
export type InsertInAppNotification = typeof inAppNotifications.$inferInsert;
export type ActivityEvent = typeof activityEvents.$inferSelect;
export type InsertActivityEvent = typeof activityEvents.$inferInsert;
export type SavedView = typeof savedViews.$inferSelect;
export type InsertSavedView = typeof savedViews.$inferInsert;
export type ImportExportJob = typeof importExportJobs.$inferSelect;
export type InsertImportExportJob = typeof importExportJobs.$inferInsert;
export type AttachmentMeta = typeof attachmentMeta.$inferSelect;
export type InsertAttachmentMeta = typeof attachmentMeta.$inferInsert;

/**
 * Projects table: Structured initiative tracking
 */
export const projects = sqliteTable(
  'projects',
  {
    id: text('id').primaryKey(),
    userId: text('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    categoryId: text('category_id').references(() => categories.id, { onDelete: 'set null' }),
    name: text('name').notNull(),
    slug: text('slug').notNull(),
    description: text('description'),
    color: text('color'),
    icon: text('icon'),
    status: text('status', { enum: projectStatusEnum }).notNull().default('active'),
    targetDate: text('target_date'),
    sortOrder: integer('sort_order').notNull().default(0),
    createdAt: integer('created_at', { mode: 'timestamp_ms' })
      .notNull()
      .$defaultFn(() => new Date()),
    updatedAt: integer('updated_at', { mode: 'timestamp_ms' })
      .notNull()
      .$defaultFn(() => new Date()),
  },
  (table) => ({
    userProjectSlug: uniqueIndex('uidx_projects_user_slug').on(table.userId, table.slug),
    userProjectStatus: index('idx_projects_user_status').on(table.userId, table.status, table.sortOrder),
  })
);

/**
 * Boards table: Kanban boards for projects or generic views
 */
export const boards = sqliteTable(
  'boards',
  {
    id: text('id').primaryKey(),
    userId: text('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    projectId: text('project_id').references(() => projects.id, { onDelete: 'cascade' }),
    name: text('name').notNull(),
    description: text('description'),
    isDefault: integer('is_default').notNull().default(0),
    createdAt: integer('created_at', { mode: 'timestamp_ms' })
      .notNull()
      .$defaultFn(() => new Date()),
    updatedAt: integer('updated_at', { mode: 'timestamp_ms' })
      .notNull()
      .$defaultFn(() => new Date()),
  },
  (table) => ({
    userBoardIdx: index('idx_boards_user_project').on(table.userId, table.projectId),
  })
);

/**
 * Board Columns table: Customizable workflow stages mapped to task statuses
 */
export const boardColumns = sqliteTable(
  'board_columns',
  {
    id: text('id').primaryKey(),
    userId: text('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    boardId: text('board_id')
      .notNull()
      .references(() => boards.id, { onDelete: 'cascade' }),
    name: text('name').notNull(),
    statusMapping: text('status_mapping', { enum: taskStatusEnum }).notNull().default('todo'),
    color: text('color'),
    wipLimit: integer('wip_limit'),
    sortOrder: integer('sort_order').notNull().default(0),
    createdAt: integer('created_at', { mode: 'timestamp_ms' })
      .notNull()
      .$defaultFn(() => new Date()),
    updatedAt: integer('updated_at', { mode: 'timestamp_ms' })
      .notNull()
      .$defaultFn(() => new Date()),
  },
  (table) => ({
    boardColumnOrderIdx: index('idx_board_columns_order').on(table.userId, table.boardId, table.sortOrder),
  })
);

/**
 * Recurrence Rules table: Decoupled recurrence definitions
 */
export const recurrenceRules = sqliteTable(
  'recurrence_rules',
  {
    id: text('id').primaryKey(),
    userId: text('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    templateTaskId: text('template_task_id').notNull(),
    frequency: text('frequency', { enum: recurrenceFrequencyEnum }).notNull(),
    interval: integer('interval').notNull().default(1),
    byDayOfWeek: text('by_day_of_week'),
    byDayOfMonth: integer('by_day_of_month'),
    byMonth: integer('by_month'),
    endType: text('end_type', { enum: recurrenceEndTypeEnum }).notNull().default('never'),
    endCount: integer('end_count'),
    endDate: text('end_date'),
    timezone: text('timezone').notNull().default('UTC'),
    isActive: integer('is_active').notNull().default(1),
    lastGeneratedDate: text('last_generated_date'),
    createdAt: integer('created_at', { mode: 'timestamp_ms' })
      .notNull()
      .$defaultFn(() => new Date()),
    updatedAt: integer('updated_at', { mode: 'timestamp_ms' })
      .notNull()
      .$defaultFn(() => new Date()),
  },
  (table) => ({
    userRuleActiveIdx: index('idx_recurrence_user_active').on(table.userId, table.isActive),
  })
);

/**
 * Recurrence Exceptions table: Skip, shift, and customization history
 */
export const recurrenceExceptions = sqliteTable(
  'recurrence_exceptions',
  {
    id: text('id').primaryKey(),
    userId: text('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    recurrenceRuleId: text('recurrence_rule_id')
      .notNull()
      .references(() => recurrenceRules.id, { onDelete: 'cascade' }),
    occurrenceDate: text('occurrence_date').notNull(),
    action: text('action', { enum: recurrenceExceptionActionEnum }).notNull(),
    rescheduledToDate: text('rescheduled_to_date'),
    overrideTaskId: text('override_task_id'),
    reason: text('reason'),
    createdAt: integer('created_at', { mode: 'timestamp_ms' })
      .notNull()
      .$defaultFn(() => new Date()),
  },
  (table) => ({
    uniqueRuleOccurrence: uniqueIndex('uidx_recurrence_exception_date').on(
      table.userId,
      table.recurrenceRuleId,
      table.occurrenceDate
    ),
  })
);

/**
 * Tasks table: Unified hierarchical task system
 */
export const tasks = sqliteTable(
  'tasks',
  {
    id: text('id').primaryKey(),
    userId: text('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    projectId: text('project_id').references(() => projects.id, { onDelete: 'set null' }),
    boardId: text('board_id').references(() => boards.id, { onDelete: 'set null' }),
    boardColumnId: text('board_column_id').references(() => boardColumns.id, { onDelete: 'set null' }),
    categoryId: text('category_id').references(() => categories.id, { onDelete: 'set null' }),
    parentTaskId: text('parent_task_id').references((): AnySQLiteColumn => tasks.id, {
      onDelete: 'cascade',
    }),
    title: text('title').notNull(),
    description: text('description'),
    status: text('status', { enum: taskStatusEnum }).notNull().default('todo'),
    priority: text('priority', { enum: taskPriorityEnum }).notNull().default('medium'),
    dueDate: text('due_date'),
    dueTime: text('due_time'),
    dueTimestampMs: integer('due_timestamp_ms', { mode: 'timestamp_ms' }),
    startDate: text('start_date'),
    completedAt: integer('completed_at', { mode: 'timestamp_ms' }),
    archivedAt: integer('archived_at', { mode: 'timestamp_ms' }),
    sortOrder: integer('sort_order').notNull().default(0),
    sortOrderBoard: integer('sort_order_board').notNull().default(0),
    estimatedMinutes: integer('estimated_minutes'),
    actualMinutes: integer('actual_minutes'),
    recurrenceRuleId: text('recurrence_rule_id').references(() => recurrenceRules.id, { onDelete: 'set null' }),
    recurrenceOccurrenceDate: text('recurrence_occurrence_date'),
    isRecurringTemplate: integer('is_recurring_template').notNull().default(0),
    createdAt: integer('created_at', { mode: 'timestamp_ms' })
      .notNull()
      .$defaultFn(() => new Date()),
    updatedAt: integer('updated_at', { mode: 'timestamp_ms' })
      .notNull()
      .$defaultFn(() => new Date()),
  },
  (table) => ({
    userStatusDueIdx: index('idx_tasks_user_status_due').on(table.userId, table.status, table.dueDate),
    userProjectIdx: index('idx_tasks_user_project').on(table.userId, table.projectId, table.sortOrder),
    userBoardColIdx: index('idx_tasks_user_board_col').on(
      table.userId,
      table.boardColumnId,
      table.sortOrderBoard
    ),
    userParentTaskIdx: index('idx_tasks_user_parent').on(table.userId, table.parentTaskId),
    userRecurrenceIdx: index('idx_tasks_user_recurrence').on(
      table.userId,
      table.recurrenceRuleId,
      table.recurrenceOccurrenceDate
    ),
  })
);

/**
 * Task Checklist Items table: Step-by-step checklist tracking
 */
export const taskChecklistItems = sqliteTable(
  'task_checklist_items',
  {
    id: text('id').primaryKey(),
    userId: text('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    taskId: text('task_id')
      .notNull()
      .references(() => tasks.id, { onDelete: 'cascade' }),
    title: text('title').notNull(),
    isCompleted: integer('is_completed').notNull().default(0),
    completedAt: integer('completed_at', { mode: 'timestamp_ms' }),
    sortOrder: integer('sort_order').notNull().default(0),
    createdAt: integer('created_at', { mode: 'timestamp_ms' })
      .notNull()
      .$defaultFn(() => new Date()),
    updatedAt: integer('updated_at', { mode: 'timestamp_ms' })
      .notNull()
      .$defaultFn(() => new Date()),
  },
  (table) => ({
    taskChecklistOrderIdx: index('idx_task_checklist_order').on(table.taskId, table.sortOrder),
  })
);

/**
 * Daily Notes table: 1 entry per calendar day per user
 */
export const dailyNotes = sqliteTable(
  'daily_notes',
  {
    id: text('id').primaryKey(),
    userId: text('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    date: text('date').notNull(),
    content: text('content').notNull().default(''),
    summary: text('summary'),
    mood: integer('mood'),
    energy: integer('energy'),
    wordCount: integer('word_count').notNull().default(0),
    isPinned: integer('is_pinned').notNull().default(0),
    createdAt: integer('created_at', { mode: 'timestamp_ms' })
      .notNull()
      .$defaultFn(() => new Date()),
    updatedAt: integer('updated_at', { mode: 'timestamp_ms' })
      .notNull()
      .$defaultFn(() => new Date()),
  },
  (table) => ({
    userDailyDateUnique: uniqueIndex('uidx_daily_notes_user_date').on(table.userId, table.date),
  })
);

/**
 * General Notes table: Knowledge base and project notes
 */
export const notes = sqliteTable(
  'notes',
  {
    id: text('id').primaryKey(),
    userId: text('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    categoryId: text('category_id').references(() => categories.id, { onDelete: 'set null' }),
    projectId: text('project_id').references(() => projects.id, { onDelete: 'set null' }),
    parentNoteId: text('parent_note_id').references((): AnySQLiteColumn => notes.id, {
      onDelete: 'set null',
    }),
    title: text('title').notNull(),
    slug: text('slug').notNull(),
    content: text('content').notNull().default(''),
    summary: text('summary'),
    isPinned: integer('is_pinned').notNull().default(0),
    isArchived: integer('is_archived').notNull().default(0),
    wordCount: integer('word_count').notNull().default(0),
    readingTimeMinutes: integer('reading_time_minutes').notNull().default(0),
    createdAt: integer('created_at', { mode: 'timestamp_ms' })
      .notNull()
      .$defaultFn(() => new Date()),
    updatedAt: integer('updated_at', { mode: 'timestamp_ms' })
      .notNull()
      .$defaultFn(() => new Date()),
  },
  (table) => ({
    userNoteListIdx: index('idx_notes_user_list').on(
      table.userId,
      table.isArchived,
      table.isPinned,
      table.updatedAt
    ),
    userNoteCategoryIdx: index('idx_notes_user_category').on(table.userId, table.categoryId),
    userNoteProjectIdx: index('idx_notes_user_project').on(table.userId, table.projectId),
  })
);

/**
 * Prompts table: Reusable AI prompt manager
 */
export const prompts = sqliteTable(
  'prompts',
  {
    id: text('id').primaryKey(),
    userId: text('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    categoryId: text('category_id').references(() => categories.id, { onDelete: 'set null' }),
    title: text('title').notNull(),
    slug: text('slug').notNull(),
    description: text('description'),
    targetModel: text('target_model'),
    currentVersion: integer('current_version').notNull().default(1),
    isFavorite: integer('is_favorite').notNull().default(0),
    createdAt: integer('created_at', { mode: 'timestamp_ms' })
      .notNull()
      .$defaultFn(() => new Date()),
    updatedAt: integer('updated_at', { mode: 'timestamp_ms' })
      .notNull()
      .$defaultFn(() => new Date()),
  },
  (table) => ({
    userPromptSlugUnique: uniqueIndex('uidx_prompts_user_slug').on(table.userId, table.slug),
    userPromptFavoriteIdx: index('idx_prompts_user_favorite').on(table.userId, table.isFavorite),
  })
);

/**
 * Prompt Versions table: Immutable revisions of prompt templates
 */
export const promptVersions = sqliteTable(
  'prompt_versions',
  {
    id: text('id').primaryKey(),
    userId: text('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    promptId: text('prompt_id')
      .notNull()
      .references(() => prompts.id, { onDelete: 'cascade' }),
    version: integer('version').notNull(),
    systemPrompt: text('system_prompt'),
    template: text('template').notNull(),
    variables: text('variables'),
    changeNotes: text('change_notes'),
    createdAt: integer('created_at', { mode: 'timestamp_ms' })
      .notNull()
      .$defaultFn(() => new Date()),
  },
  (table) => ({
    uniquePromptVersion: uniqueIndex('uidx_prompt_version').on(
      table.userId,
      table.promptId,
      table.version
    ),
  })
);

export type Project = typeof projects.$inferSelect;
export type InsertProject = typeof projects.$inferInsert;
export type Board = typeof boards.$inferSelect;
export type InsertBoard = typeof boards.$inferInsert;
export type BoardColumn = typeof boardColumns.$inferSelect;
export type InsertBoardColumn = typeof boardColumns.$inferInsert;
export type RecurrenceRule = typeof recurrenceRules.$inferSelect;
export type InsertRecurrenceRule = typeof recurrenceRules.$inferInsert;
export type RecurrenceException = typeof recurrenceExceptions.$inferSelect;
export type InsertRecurrenceException = typeof recurrenceExceptions.$inferInsert;
export type Task = typeof tasks.$inferSelect;
export type InsertTask = typeof tasks.$inferInsert;
export type TaskChecklistItem = typeof taskChecklistItems.$inferSelect;
export type InsertTaskChecklistItem = typeof taskChecklistItems.$inferInsert;
export type DailyNote = typeof dailyNotes.$inferSelect;
export type InsertDailyNote = typeof dailyNotes.$inferInsert;
export type Note = typeof notes.$inferSelect;
export type InsertNote = typeof notes.$inferInsert;
export type Prompt = typeof prompts.$inferSelect;
export type InsertPrompt = typeof prompts.$inferInsert;
export type PromptVersion = typeof promptVersions.$inferSelect;
export type InsertPromptVersion = typeof promptVersions.$inferInsert;

/**
 * Habits table: Habit definition and weekly target configuration
 */
export const habits = sqliteTable(
  'habits',
  {
    id: text('id').primaryKey(),
    userId: text('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    categoryId: text('category_id').references(() => categories.id, { onDelete: 'set null' }),
    name: text('name').notNull(),
    description: text('description'),
    frequencyType: text('frequency_type', { enum: habitFrequencyEnum }).notNull().default('daily'),
    targetDaysPerWeek: integer('target_days_per_week').notNull().default(7),
    targetDaysOfWeek: text('target_days_of_week'), // JSON array e.g. [1,2,3,4,5]
    color: text('color'),
    icon: text('icon'),
    archived: integer('archived').notNull().default(0),
    sortOrder: integer('sort_order').notNull().default(0),
    createdAt: integer('created_at', { mode: 'timestamp_ms' })
      .notNull()
      .$defaultFn(() => new Date()),
    updatedAt: integer('updated_at', { mode: 'timestamp_ms' })
      .notNull()
      .$defaultFn(() => new Date()),
  },
  (table) => ({
    userHabitIdx: index('idx_habits_user_archived').on(table.userId, table.archived, table.sortOrder),
    userHabitCategoryIdx: index('idx_habits_user_category').on(table.userId, table.categoryId),
  })
);

/**
 * Habit Logs table: Daily completion log
 */
export const habitLogs = sqliteTable(
  'habit_logs',
  {
    id: text('id').primaryKey(),
    userId: text('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    habitId: text('habit_id')
      .notNull()
      .references(() => habits.id, { onDelete: 'cascade' }),
    date: text('date').notNull(), // YYYY-MM-DD
    completed: integer('completed').notNull().default(1),
    notes: text('notes'),
    createdAt: integer('created_at', { mode: 'timestamp_ms' })
      .notNull()
      .$defaultFn(() => new Date()),
  },
  (table) => ({
    userHabitDateUnique: uniqueIndex('uidx_habit_logs_user_habit_date').on(
      table.userId,
      table.habitId,
      table.date
    ),
    userDateIdx: index('idx_habit_logs_user_date').on(table.userId, table.date),
  })
);

/**
 * Trackers table: Custom flexible metrics (numeric, boolean, rating, duration)
 */
export const trackers = sqliteTable(
  'trackers',
  {
    id: text('id').primaryKey(),
    userId: text('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    categoryId: text('category_id').references(() => categories.id, { onDelete: 'set null' }),
    name: text('name').notNull(),
    description: text('description'),
    type: text('type', { enum: trackerTypeEnum }).notNull(),
    unit: text('unit'),
    targetValue: integer('target_value'),
    targetPeriod: text('target_period', { enum: trackerPeriodEnum }),
    color: text('color'),
    icon: text('icon'),
    archived: integer('archived').notNull().default(0),
    sortOrder: integer('sort_order').notNull().default(0),
    createdAt: integer('created_at', { mode: 'timestamp_ms' })
      .notNull()
      .$defaultFn(() => new Date()),
    updatedAt: integer('updated_at', { mode: 'timestamp_ms' })
      .notNull()
      .$defaultFn(() => new Date()),
  },
  (table) => ({
    userTrackerIdx: index('idx_trackers_user_archived').on(table.userId, table.archived, table.sortOrder),
    userTrackerCategoryIdx: index('idx_trackers_user_category').on(table.userId, table.categoryId),
  })
);

/**
 * Tracker Entries table: Timestamped data points
 */
export const trackerEntries = sqliteTable(
  'tracker_entries',
  {
    id: text('id').primaryKey(),
    userId: text('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    trackerId: text('tracker_id')
      .notNull()
      .references(() => trackers.id, { onDelete: 'cascade' }),
    date: text('date').notNull(), // YYYY-MM-DD
    timestampMs: integer('timestamp_ms', { mode: 'timestamp_ms' }).notNull(),
    value: integer('value').notNull().default(1),
    textValue: text('text_value'),
    notes: text('notes'),
    createdAt: integer('created_at', { mode: 'timestamp_ms' })
      .notNull()
      .$defaultFn(() => new Date()),
  },
  (table) => ({
    userTrackerDateIdx: index('idx_tracker_entries_user_tracker_date').on(
      table.userId,
      table.trackerId,
      table.date
    ),
  })
);

/**
 * Workouts table: Fitness training sessions
 */
export const workouts = sqliteTable(
  'workouts',
  {
    id: text('id').primaryKey(),
    userId: text('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    name: text('name').notNull(),
    type: text('type', { enum: workoutTypeEnum }).notNull().default('strength'),
    date: text('date').notNull(), // YYYY-MM-DD
    durationMinutes: integer('duration_minutes'),
    caloriesBurned: integer('calories_burned'),
    notes: text('notes'),
    createdAt: integer('created_at', { mode: 'timestamp_ms' })
      .notNull()
      .$defaultFn(() => new Date()),
    updatedAt: integer('updated_at', { mode: 'timestamp_ms' })
      .notNull()
      .$defaultFn(() => new Date()),
  },
  (table) => ({
    userWorkoutDateIdx: index('idx_workouts_user_date').on(table.userId, table.date),
  })
);

/**
 * Workout Exercises table: Exercises performed within a workout
 */
export const workoutExercises = sqliteTable(
  'workout_exercises',
  {
    id: text('id').primaryKey(),
    userId: text('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    workoutId: text('workout_id')
      .notNull()
      .references(() => workouts.id, { onDelete: 'cascade' }),
    exerciseName: text('exercise_name').notNull(),
    sortOrder: integer('sort_order').notNull().default(0),
    sets: text('sets').notNull().default('[]'), // JSON array of ExerciseSet
    notes: text('notes'),
    createdAt: integer('created_at', { mode: 'timestamp_ms' })
      .notNull()
      .$defaultFn(() => new Date()),
  },
  (table) => ({
    workoutOrderIdx: index('idx_workout_exercises_order').on(table.workoutId, table.sortOrder),
  })
);

/**
 * Workout Templates table: Reusable workout routines
 */
export const workoutTemplates = sqliteTable(
  'workout_templates',
  {
    id: text('id').primaryKey(),
    userId: text('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    name: text('name').notNull(),
    type: text('type', { enum: workoutTypeEnum }).notNull().default('strength'),
    description: text('description'),
    category: text('category'),
    defaultRestSeconds: integer('default_rest_seconds').notNull().default(90),
    sortOrder: integer('sort_order').notNull().default(0),
    createdAt: integer('created_at', { mode: 'timestamp_ms' })
      .notNull()
      .$defaultFn(() => new Date()),
    updatedAt: integer('updated_at', { mode: 'timestamp_ms' })
      .notNull()
      .$defaultFn(() => new Date()),
  },
  (table) => ({
    userTemplateIdx: index('idx_workout_templates_user').on(table.userId, table.type, table.sortOrder),
  })
);

/**
 * Workout Template Exercises table: Planned exercises for workout routines
 */
export const workoutTemplateExercises = sqliteTable(
  'workout_template_exercises',
  {
    id: text('id').primaryKey(),
    userId: text('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    templateId: text('template_id')
      .notNull()
      .references(() => workoutTemplates.id, { onDelete: 'cascade' }),
    exerciseName: text('exercise_name').notNull(),
    targetSets: integer('target_sets').notNull().default(3),
    targetReps: integer('target_reps'),
    targetWeightGrams: integer('target_weight_grams').default(0),
    targetDurationSeconds: integer('target_duration_seconds'),
    restSeconds: integer('rest_seconds').default(90),
    sortOrder: integer('sort_order').notNull().default(0),
    notes: text('notes'),
    createdAt: integer('created_at', { mode: 'timestamp_ms' })
      .notNull()
      .$defaultFn(() => new Date()),
  },
  (table) => ({
    templateExerciseOrderIdx: index('idx_workout_template_exercises_order').on(
      table.templateId,
      table.sortOrder
    ),
  })
);

/**
 * Body Measurements table: Weight and anthropometric tracking (all integer units)
 */
export const bodyMeasurements = sqliteTable(
  'body_measurements',
  {
    id: text('id').primaryKey(),
    userId: text('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    date: text('date').notNull(), // YYYY-MM-DD
    weightGrams: integer('weight_grams'), // Integer grams (e.g. 78450 = 78.45 kg)
    bodyFatBps: integer('body_fat_bps'), // Basis points (1540 = 15.40%)
    chestMm: integer('chest_mm'),
    waistMm: integer('waist_mm'),
    hipsMm: integer('hips_mm'),
    bicepLeftMm: integer('bicep_left_mm'),
    bicepRightMm: integer('bicep_right_mm'),
    thighLeftMm: integer('thigh_left_mm'),
    thighRightMm: integer('thigh_right_mm'),
    calfLeftMm: integer('calf_left_mm'),
    calfRightMm: integer('calf_right_mm'),
    neckMm: integer('neck_mm'),
    shoulderMm: integer('shoulder_mm'),
    forearmMm: integer('forearm_mm'),
    notes: text('notes'),
    createdAt: integer('created_at', { mode: 'timestamp_ms' })
      .notNull()
      .$defaultFn(() => new Date()),
    updatedAt: integer('updated_at', { mode: 'timestamp_ms' })
      .notNull()
      .$defaultFn(() => new Date()),
  },
  (table) => ({
    userMeasurementDateUnique: uniqueIndex('uidx_body_measurements_user_date').on(
      table.userId,
      table.date
    ),
    userMeasurementDateIdx: index('idx_body_measurements_user_date').on(table.userId, table.date),
  })
);

/**
 * Goals table: High-level objectives and strategic milestones
 */
export const goals = sqliteTable(
  'goals',
  {
    id: text('id').primaryKey(),
    userId: text('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    categoryId: text('category_id').references(() => categories.id, { onDelete: 'set null' }),
    projectId: text('project_id').references(() => projects.id, { onDelete: 'set null' }),
    title: text('title').notNull(),
    description: text('description'),
    timeframe: text('timeframe', { enum: goalTimeframeEnum }),
    targetDate: text('target_date'), // YYYY-MM-DD
    status: text('status', { enum: goalStatusEnum }).notNull().default('not_started'),
    progressPercentage: integer('progress_percentage').notNull().default(0),
    color: text('color'),
    icon: text('icon'),
    notes: text('notes'),
    createdAt: integer('created_at', { mode: 'timestamp_ms' })
      .notNull()
      .$defaultFn(() => new Date()),
    updatedAt: integer('updated_at', { mode: 'timestamp_ms' })
      .notNull()
      .$defaultFn(() => new Date()),
  },
  (table) => ({
    userGoalStatusIdx: index('idx_goals_user_status_date').on(table.userId, table.status, table.targetDate),
    userGoalCategoryIdx: index('idx_goals_user_category').on(table.userId, table.categoryId),
  })
);

/**
 * Goal Milestones table: Measurable key results towards a goal
 */
export const goalMilestones = sqliteTable(
  'goal_milestones',
  {
    id: text('id').primaryKey(),
    userId: text('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    goalId: text('goal_id')
      .notNull()
      .references(() => goals.id, { onDelete: 'cascade' }),
    title: text('title').notNull(),
    targetValue: integer('target_value').notNull().default(100),
    currentValue: integer('current_value').notNull().default(0),
    unit: text('unit').notNull().default('%'),
    isCompleted: integer('is_completed').notNull().default(0),
    dueDate: text('due_date'), // YYYY-MM-DD
    sortOrder: integer('sort_order').notNull().default(0),
    createdAt: integer('created_at', { mode: 'timestamp_ms' })
      .notNull()
      .$defaultFn(() => new Date()),
    updatedAt: integer('updated_at', { mode: 'timestamp_ms' })
      .notNull()
      .$defaultFn(() => new Date()),
  },
  (table) => ({
    goalMilestoneOrderIdx: index('idx_goal_milestones_order').on(table.goalId, table.sortOrder),
  })
);

/**
 * Goal Progress Logs table: Historical trail of milestone progress adjustments
 */
export const goalProgressLogs = sqliteTable(
  'goal_progress_logs',
  {
    id: text('id').primaryKey(),
    userId: text('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    goalId: text('goal_id')
      .notNull()
      .references(() => goals.id, { onDelete: 'cascade' }),
    milestoneId: text('milestone_id').references(() => goalMilestones.id, { onDelete: 'set null' }),
    previousProgress: integer('previous_progress').notNull(),
    newProgress: integer('new_progress').notNull(),
    changeDelta: integer('change_delta').notNull(),
    notes: text('notes'),
    loggedAt: text('logged_at').notNull(), // YYYY-MM-DD
    createdAt: integer('created_at', { mode: 'timestamp_ms' })
      .notNull()
      .$defaultFn(() => new Date()),
  },
  (table) => ({
    userGoalProgressIdx: index('idx_goal_progress_logs_user_goal').on(
      table.userId,
      table.goalId,
      table.createdAt
    ),
  })
);

/**
 * Goal Task Links table: Associate productivity tasks directly with goals & milestones
 */
export const goalTaskLinks = sqliteTable(
  'goal_task_links',
  {
    id: text('id').primaryKey(),
    userId: text('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    goalId: text('goal_id')
      .notNull()
      .references(() => goals.id, { onDelete: 'cascade' }),
    taskId: text('task_id')
      .notNull()
      .references(() => tasks.id, { onDelete: 'cascade' }),
    milestoneId: text('milestone_id').references(() => goalMilestones.id, { onDelete: 'set null' }),
    createdAt: integer('created_at', { mode: 'timestamp_ms' })
      .notNull()
      .$defaultFn(() => new Date()),
  },
  (table) => ({
    userGoalTaskUnique: uniqueIndex('uidx_goal_task_links_user_goal_task').on(
      table.userId,
      table.goalId,
      table.taskId
    ),
    taskGoalIdx: index('idx_goal_task_links_task').on(table.taskId),
  })
);

export type Habit = typeof habits.$inferSelect;
export type InsertHabit = typeof habits.$inferInsert;
export type HabitLog = typeof habitLogs.$inferSelect;
export type InsertHabitLog = typeof habitLogs.$inferInsert;
export type Tracker = typeof trackers.$inferSelect;
export type InsertTracker = typeof trackers.$inferInsert;
export type TrackerEntry = typeof trackerEntries.$inferSelect;
export type InsertTrackerEntry = typeof trackerEntries.$inferInsert;
export type Workout = typeof workouts.$inferSelect;
export type InsertWorkout = typeof workouts.$inferInsert;
export type WorkoutExercise = typeof workoutExercises.$inferSelect;
export type InsertWorkoutExercise = typeof workoutExercises.$inferInsert;
export type WorkoutTemplate = typeof workoutTemplates.$inferSelect;
export type InsertWorkoutTemplate = typeof workoutTemplates.$inferInsert;
export type WorkoutTemplateExercise = typeof workoutTemplateExercises.$inferSelect;
export type InsertWorkoutTemplateExercise = typeof workoutTemplateExercises.$inferInsert;
export type BodyMeasurement = typeof bodyMeasurements.$inferSelect;
export type InsertBodyMeasurement = typeof bodyMeasurements.$inferInsert;
export type Goal = typeof goals.$inferSelect;
export type InsertGoal = typeof goals.$inferInsert;
export type GoalMilestone = typeof goalMilestones.$inferSelect;
export type InsertGoalMilestone = typeof goalMilestones.$inferInsert;
export type GoalProgressLog = typeof goalProgressLogs.$inferSelect;
export type InsertGoalProgressLog = typeof goalProgressLogs.$inferInsert;
export type GoalTaskLink = typeof goalTaskLinks.$inferSelect;
export type InsertGoalTaskLink = typeof goalTaskLinks.$inferInsert;

/**
 * Finance Accounts table: Checking, savings, credit, cash, loans, investments
 */
export const financeAccounts = sqliteTable(
  'finance_accounts',
  {
    id: text('id').primaryKey(),
    userId: text('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    categoryId: text('category_id').references(() => categories.id, { onDelete: 'set null' }),
    name: text('name').notNull(),
    type: text('type', { enum: financeAccountTypeEnum }).notNull(),
    currency: text('currency').notNull().default('USD'),
    balanceCents: integer('balance_cents').notNull().default(0),
    description: text('description'),
    color: text('color'),
    icon: text('icon'),
    isArchived: integer('is_archived').notNull().default(0),
    sortOrder: integer('sort_order').notNull().default(0),
    createdAt: integer('created_at', { mode: 'timestamp_ms' })
      .notNull()
      .$defaultFn(() => new Date()),
    updatedAt: integer('updated_at', { mode: 'timestamp_ms' })
      .notNull()
      .$defaultFn(() => new Date()),
  },
  (table) => ({
    userAccountIdx: index('idx_finance_accounts_user_archived').on(
      table.userId,
      table.isArchived,
      table.sortOrder
    ),
    userAccountCategoryIdx: index('idx_finance_accounts_user_category').on(table.userId, table.categoryId),
  })
);

/**
 * Finance Contacts table: People for tracking money given/borrowed/loans
 */
export const financeContacts = sqliteTable(
  'finance_contacts',
  {
    id: text('id').primaryKey(),
    userId: text('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    name: text('name').notNull(),
    email: text('email'),
    phone: text('phone'),
    notes: text('notes'),
    createdAt: integer('created_at', { mode: 'timestamp_ms' })
      .notNull()
      .$defaultFn(() => new Date()),
    updatedAt: integer('updated_at', { mode: 'timestamp_ms' })
      .notNull()
      .$defaultFn(() => new Date()),
  },
  (table) => ({
    userContactNameIdx: index('idx_finance_contacts_user_name').on(table.userId, table.name),
  })
);

/**
 * Finance Transactions table: Atomic double-entry movement of funds
 */
export const financeTransactions = sqliteTable(
  'finance_transactions',
  {
    id: text('id').primaryKey(),
    userId: text('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    accountId: text('account_id')
      .notNull()
      .references(() => financeAccounts.id, { onDelete: 'cascade' }),
    categoryId: text('category_id').references(() => categories.id, { onDelete: 'set null' }),
    type: text('type', { enum: financeTransactionTypeEnum }).notNull(),
    amountCents: integer('amount_cents').notNull(),
    transactionDate: text('transaction_date').notNull(), // YYYY-MM-DD
    timestampMs: integer('timestamp_ms', { mode: 'timestamp_ms' }).notNull(),
    payee: text('payee'),
    notes: text('notes'),
    transferAccountId: text('transfer_account_id').references(() => financeAccounts.id, {
      onDelete: 'set null',
    }),
    transferTransactionId: text('transfer_transaction_id'),
    isReconciled: integer('is_reconciled').notNull().default(1),
    hasSplits: integer('has_splits').notNull().default(0),
    createdAt: integer('created_at', { mode: 'timestamp_ms' })
      .notNull()
      .$defaultFn(() => new Date()),
    updatedAt: integer('updated_at', { mode: 'timestamp_ms' })
      .notNull()
      .$defaultFn(() => new Date()),
  },
  (table) => ({
    userAccountDateIdx: index('idx_finance_txns_user_acc_date').on(
      table.userId,
      table.accountId,
      table.transactionDate
    ),
    userCategoryDateIdx: index('idx_finance_txns_user_cat_date').on(
      table.userId,
      table.categoryId,
      table.transactionDate
    ),
  })
);

/**
 * Finance Transaction Splits table: Sub-item category breakdowns for a single transaction
 */
export const financeTransactionSplits = sqliteTable(
  'finance_transaction_splits',
  {
    id: text('id').primaryKey(),
    userId: text('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    transactionId: text('transaction_id')
      .notNull()
      .references(() => financeTransactions.id, { onDelete: 'cascade' }),
    categoryId: text('category_id').references(() => categories.id, { onDelete: 'set null' }),
    amountCents: integer('amount_cents').notNull(),
    notes: text('notes'),
    createdAt: integer('created_at', { mode: 'timestamp_ms' })
      .notNull()
      .$defaultFn(() => new Date()),
    updatedAt: integer('updated_at', { mode: 'timestamp_ms' })
      .notNull()
      .$defaultFn(() => new Date()),
  },
  (table) => ({
    userTxnSplitIdx: index('idx_finance_txnsplits_user_txn').on(table.userId, table.transactionId),
    userCategorySplitIdx: index('idx_finance_txnsplits_user_cat').on(table.userId, table.categoryId),
  })
);

/**
 * Finance Budgets table: Spending envelopes by category and period
 */
export const financeBudgets = sqliteTable(
  'finance_budgets',
  {
    id: text('id').primaryKey(),
    userId: text('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    categoryId: text('category_id')
      .notNull()
      .references(() => categories.id, { onDelete: 'cascade' }),
    period: text('period', { enum: budgetPeriodEnum }).notNull().default('monthly'),
    yearMonth: text('year_month').notNull(), // YYYY-MM
    amountCents: integer('amount_cents').notNull(),
    rollover: integer('rollover').notNull().default(0),
    notes: text('notes'),
    createdAt: integer('created_at', { mode: 'timestamp_ms' })
      .notNull()
      .$defaultFn(() => new Date()),
    updatedAt: integer('updated_at', { mode: 'timestamp_ms' })
      .notNull()
      .$defaultFn(() => new Date()),
  },
  (table) => ({
    userCatPeriodUnique: uniqueIndex('uidx_finance_budgets_user_cat_month').on(
      table.userId,
      table.categoryId,
      table.yearMonth
    ),
  })
);

/**
 * Finance Debts table: Credit cards, loans, mortgages, money given/borrowed
 */
export const financeDebts = sqliteTable(
  'finance_debts',
  {
    id: text('id').primaryKey(),
    userId: text('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    accountId: text('account_id').references(() => financeAccounts.id, { onDelete: 'set null' }),
    contactId: text('contact_id').references(() => financeContacts.id, { onDelete: 'set null' }),
    debtType: text('debt_type', { enum: financeDebtTypeEnum }).notNull().default('loan'),
    name: text('name').notNull(),
    creditor: text('creditor').notNull(),
    totalOwedCents: integer('total_owed_cents').notNull(),
    interestRateBps: integer('interest_rate_bps').notNull().default(0),
    minimumPaymentCents: integer('minimum_payment_cents').notNull().default(0),
    dueDate: text('due_date'), // YYYY-MM-DD
    targetPayoffDate: text('target_payoff_date'), // YYYY-MM-DD
    isPaidOff: integer('is_paid_off').notNull().default(0),
    notes: text('notes'),
    createdAt: integer('created_at', { mode: 'timestamp_ms' })
      .notNull()
      .$defaultFn(() => new Date()),
    updatedAt: integer('updated_at', { mode: 'timestamp_ms' })
      .notNull()
      .$defaultFn(() => new Date()),
  },
  (table) => ({
    userDebtPaidIdx: index('idx_finance_debts_user_paidoff').on(table.userId, table.isPaidOff),
    userDebtContactIdx: index('idx_finance_debts_user_contact').on(table.userId, table.contactId),
  })
);

/**
 * Finance Debt Payments table: Ledger of debt principal and interest payments
 */
export const financeDebtPayments = sqliteTable(
  'finance_debt_payments',
  {
    id: text('id').primaryKey(),
    userId: text('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    debtId: text('debt_id')
      .notNull()
      .references(() => financeDebts.id, { onDelete: 'cascade' }),
    transactionId: text('transaction_id').references(() => financeTransactions.id, {
      onDelete: 'set null',
    }),
    date: text('date').notNull(), // YYYY-MM-DD
    amountCents: integer('amount_cents').notNull(),
    principalCents: integer('principal_cents'),
    interestCents: integer('interest_cents'),
    notes: text('notes'),
    createdAt: integer('created_at', { mode: 'timestamp_ms' })
      .notNull()
      .$defaultFn(() => new Date()),
  },
  (table) => ({
    userDebtDateIdx: index('idx_finance_debt_payments_user_debt_date').on(
      table.userId,
      table.debtId,
      table.date
    ),
  })
);

/**
 * Finance Net Worth Snapshots table: Monthly historical balance sheet records
 */
export const financeNetWorthSnapshots = sqliteTable(
  'finance_net_worth_snapshots',
  {
    id: text('id').primaryKey(),
    userId: text('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    yearMonth: text('year_month').notNull(), // YYYY-MM
    totalAssetsCents: integer('total_assets_cents').notNull(),
    totalLiabilitiesCents: integer('total_liabilities_cents').notNull(),
    netWorthCents: integer('net_worth_cents').notNull(),
    currency: text('currency').notNull().default('USD'),
    notes: text('notes'),
    createdAt: integer('created_at', { mode: 'timestamp_ms' })
      .notNull()
      .$defaultFn(() => new Date()),
  },
  (table) => ({
    userSnapshotMonthUnique: uniqueIndex('uidx_finance_snapshots_user_month').on(
      table.userId,
      table.yearMonth
    ),
  })
);

export type FinanceAccount = typeof financeAccounts.$inferSelect;
export type InsertFinanceAccount = typeof financeAccounts.$inferInsert;
export type FinanceContact = typeof financeContacts.$inferSelect;
export type InsertFinanceContact = typeof financeContacts.$inferInsert;
export type FinanceTransaction = typeof financeTransactions.$inferSelect;
export type InsertFinanceTransaction = typeof financeTransactions.$inferInsert;
export type FinanceTransactionSplit = typeof financeTransactionSplits.$inferSelect;
export type InsertFinanceTransactionSplit = typeof financeTransactionSplits.$inferInsert;
export type FinanceBudget = typeof financeBudgets.$inferSelect;
export type InsertFinanceBudget = typeof financeBudgets.$inferInsert;
export type FinanceDebt = typeof financeDebts.$inferSelect;
export type InsertFinanceDebt = typeof financeDebts.$inferInsert;
export type FinanceDebtPayment = typeof financeDebtPayments.$inferSelect;
export type InsertFinanceDebtPayment = typeof financeDebtPayments.$inferInsert;
export type FinanceNetWorthSnapshot = typeof financeNetWorthSnapshots.$inferSelect;
export type InsertFinanceNetWorthSnapshot = typeof financeNetWorthSnapshots.$inferInsert;

export const assetTypeEnumValues = ['stock', 'mutual_fund', 'etf', 'crypto', 'real_estate', 'other'] as const;
export const quoteSourceEnumValues = ['manual', 'csv_import', 'trade_derived'] as const;
export const investmentTransactionTypeEnumValues = [
  'buy',
  'sell',
  'dividend',
  'fee',
  'split',
  'transfer_in',
  'transfer_out',
] as const;

/**
 * Investment Assets table: Portfolio holdings with micro-units and integer cents
 */
export const investmentAssets = sqliteTable(
  'investment_assets',
  {
    id: text('id').primaryKey(),
    userId: text('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    accountId: text('account_id').references(() => financeAccounts.id, { onDelete: 'set null' }),
    symbol: text('symbol').notNull(),
    name: text('name').notNull(),
    assetType: text('asset_type', { enum: assetTypeEnumValues }).notNull(),
    unitsMicro: integer('units_micro').notNull().default(0),
    avgCostBasisCents: integer('avg_cost_basis_cents').notNull().default(0),
    latestPriceCents: integer('latest_price_cents').notNull().default(0),
    latestPriceAt: integer('latest_price_at', { mode: 'timestamp_ms' }),
    realizedGainLossCents: integer('realized_gain_loss_cents').notNull().default(0),
    createdAt: integer('created_at', { mode: 'timestamp_ms' })
      .notNull()
      .$defaultFn(() => new Date()),
    updatedAt: integer('updated_at', { mode: 'timestamp_ms' })
      .notNull()
      .$defaultFn(() => new Date()),
  },
  (table) => ({
    userSymbolIdx: index('idx_investment_assets_user_symbol').on(table.userId, table.symbol),
    userTypeIdx: index('idx_investment_assets_user_type').on(table.userId, table.assetType),
    userAccountIdx: index('idx_investment_assets_user_acc').on(table.userId, table.accountId),
  })
);

/**
 * Investment Quotes table: Historical price quotes
 */
export const investmentQuotes = sqliteTable(
  'investment_quotes',
  {
    id: text('id').primaryKey(),
    assetId: text('asset_id')
      .notNull()
      .references(() => investmentAssets.id, { onDelete: 'cascade' }),
    priceCents: integer('price_cents').notNull(),
    recordedAt: integer('recorded_at', { mode: 'timestamp_ms' })
      .notNull()
      .$defaultFn(() => new Date()),
    source: text('source', { enum: quoteSourceEnumValues }).notNull().default('manual'),
  },
  (table) => ({
    assetTimeIdx: index('idx_investment_quotes_asset_time').on(table.assetId, table.recordedAt),
  })
);

/**
 * Investment Transactions table: Atomic trade, dividend, and fee history
 */
export const investmentTransactions = sqliteTable(
  'investment_transactions',
  {
    id: text('id').primaryKey(),
    userId: text('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    assetId: text('asset_id')
      .notNull()
      .references(() => investmentAssets.id, { onDelete: 'cascade' }),
    accountId: text('account_id').references(() => financeAccounts.id, { onDelete: 'set null' }),
    type: text('type', { enum: investmentTransactionTypeEnumValues }).notNull(),
    date: text('date').notNull(),
    unitsMicro: integer('units_micro').notNull().default(0),
    pricePerUnitCents: integer('price_per_unit_cents').notNull().default(0),
    totalAmountCents: integer('total_amount_cents').notNull().default(0),
    feeCents: integer('fee_cents').notNull().default(0),
    realizedGainCents: integer('realized_gain_cents'),
    notes: text('notes'),
    createdAt: integer('created_at', { mode: 'timestamp_ms' })
      .notNull()
      .$defaultFn(() => new Date()),
  },
  (table) => ({
    userDateIdx: index('idx_invest_tx_user_date').on(table.userId, table.date),
    assetDateIdx: index('idx_invest_tx_asset_date').on(table.assetId, table.date),
    userTypeIdx: index('idx_invest_tx_user_type').on(table.userId, table.type),
  })
);

export type InvestmentAsset = typeof investmentAssets.$inferSelect;
export type InsertInvestmentAsset = typeof investmentAssets.$inferInsert;
export type InvestmentQuote = typeof investmentQuotes.$inferSelect;
export type InsertInvestmentQuote = typeof investmentQuotes.$inferInsert;
export type InvestmentTransaction = typeof investmentTransactions.$inferSelect;
export type InsertInvestmentTransaction = typeof investmentTransactions.$inferInsert;




