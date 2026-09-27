export const domainEnum = ['finance', 'task', 'note', 'fitness', 'tracker', 'goal'] as const;
export type CategoryDomain = (typeof domainEnum)[number];

export const entityTypeEnum = [
  'task',
  'note',
  'finance_transaction',
  'finance_account',
  'finance_budget',
  'habit',
  'tracker',
  'goal',
  'attachment',
  'custom',
] as const;
export type EntityType = (typeof entityTypeEnum)[number];

export interface CategoryData {
  id: string;
  userId: string;
  domain: CategoryDomain;
  parentId?: string | null;
  name: string;
  slug: string;
  icon?: string | null;
  color?: string | null;
  description?: string | null;
  isDefault: boolean;
  isEnabled: boolean;
  sortOrder: number;
  createdAt: number;
  updatedAt: number;
  subcategories?: CategoryData[];
}

export interface TagData {
  id: string;
  userId: string;
  name: string;
  slug: string;
  color?: string | null;
  createdAt: number;
  updatedAt: number;
}

export interface EntityTagData {
  id: string;
  userId: string;
  tagId: string;
  entityType: EntityType;
  entityId: string;
  createdAt: number;
  tag?: TagData;
}

export type ReminderStatus = 'pending' | 'triggered' | 'acknowledged' | 'dismissed' | 'snoozed';

export interface ReminderData {
  id: string;
  userId: string;
  entityType: EntityType;
  entityId?: string | null;
  title: string;
  description?: string | null;
  remindAt: number;
  recurrenceRule?: string | null;
  status: ReminderStatus;
  snoozedUntil?: number | null;
  dismissedAt?: number | null;
  createdAt: number;
  updatedAt: number;
}

export type NotificationLevel = 'info' | 'warning' | 'critical' | 'success';
export type NotificationType =
  | 'reminder'
  | 'system'
  | 'budget_alert'
  | 'import_completed'
  | 'security'
  | 'streak';

export interface InAppNotificationData {
  id: string;
  userId: string;
  type: NotificationType;
  title: string;
  body: string;
  level: NotificationLevel;
  entityType?: EntityType | null;
  entityId?: string | null;
  actionUrl?: string | null;
  isRead: boolean;
  readAt?: number | null;
  createdAt: number;
}

export interface ActivityEventRecord {
  id: string;
  userId: string;
  domain: CategoryDomain | 'auth' | 'system';
  action: string;
  entityType: EntityType | 'session' | 'user' | 'system';
  entityId: string;
  summary: string;
  metadata?: Record<string, unknown> | null;
  ipHash?: string | null;
  createdAt: number;
}

export interface SavedViewData {
  id: string;
  userId: string;
  domain: CategoryDomain;
  name: string;
  filterConfig: Record<string, unknown>;
  sortConfig?: Record<string, unknown> | null;
  isPinned: boolean;
  isDefault: boolean;
  sortOrder: number;
  createdAt: number;
  updatedAt: number;
}

export type JobType = 'import' | 'export';
export type JobFormat = 'json' | 'csv';
export type JobStatus = 'pending' | 'processing' | 'completed' | 'failed';

export interface ImportExportJobData {
  id: string;
  userId: string;
  type: JobType;
  domain: CategoryDomain | 'all';
  format: JobFormat;
  status: JobStatus;
  totalItems: number;
  processedItems: number;
  errorCount: number;
  errorDetails?: Array<{ row?: number; message: string }> | null;
  summary?: Record<string, unknown> | null;
  createdAt: number;
  completedAt?: number | null;
}

export interface AttachmentMetaData {
  id: string;
  userId: string;
  entityType: EntityType;
  entityId: string;
  fileName: string;
  fileSize: number;
  mimeType: string;
  storageProvider: 'deferred' | 'local_stub';
  storageKey?: string | null;
  sha256?: string | null;
  createdAt: number;
}

export interface PaginationMeta {
  page?: number;
  pageSize?: number;
  totalCount?: number;
  totalPages?: number;
  hasNextPage?: boolean;
  hasPrevPage?: boolean;
  cursor?: string;
}
