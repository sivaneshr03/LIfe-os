import { z } from 'zod';
import { domainEnum, entityTypeEnum } from '../platformTypes';

export const categoryCreateSchema = z.object({
  domain: z.enum(domainEnum),
  name: z.string().min(1, 'Name is required').max(50, 'Name must be <= 50 characters').trim(),
  parentId: z.string().optional().nullable(),
  icon: z.string().max(50).optional().nullable(),
  color: z.string().max(30).optional().nullable(),
  description: z.string().max(255).optional().nullable(),
  sortOrder: z.number().int().optional().default(0),
});

export const categoryUpdateSchema = z.object({
  name: z.string().min(1, 'Name is required').max(50, 'Name must be <= 50 characters').trim().optional(),
  parentId: z.string().optional().nullable(),
  icon: z.string().max(50).optional().nullable(),
  color: z.string().max(30).optional().nullable(),
  description: z.string().max(255).optional().nullable(),
  isEnabled: z.boolean().optional(),
  sortOrder: z.number().int().optional(),
});

export const categoryQuerySchema = z.object({
  domain: z.enum(domainEnum).optional(),
  parentId: z.string().optional().nullable(),
  includeDisabled: z
    .enum(['true', 'false'])
    .optional()
    .transform((v) => (v === undefined ? undefined : v === 'true')),
  q: z.string().max(100).optional(),
});

export const tagCreateSchema = z.object({
  name: z.string().min(1, 'Tag name is required').max(30, 'Tag name must be <= 30 characters').trim(),
  color: z.string().max(30).optional().nullable(),
});

export const entityTagAttachSchema = z.object({
  tagId: z.string().min(1, 'Tag ID is required'),
});

export const reminderCreateSchema = z.object({
  entityType: z.enum(entityTypeEnum),
  entityId: z.string().optional().nullable(),
  title: z.string().min(1, 'Title is required').max(200, 'Title must be <= 200 characters').trim(),
  description: z.string().max(1000).optional().nullable(),
  remindAt: z.number().int().positive('remindAt must be a valid UTC epoch millisecond timestamp'),
  recurrenceRule: z.string().max(255).optional().nullable(),
});

export const reminderUpdateStatusSchema = z.object({
  status: z.enum(['pending', 'triggered', 'acknowledged', 'dismissed', 'snoozed']),
  snoozedUntil: z.number().int().positive().optional().nullable(),
});

export const notificationQuerySchema = z.object({
  unreadOnly: z
    .enum(['true', 'false'])
    .optional()
    .transform((v) => (v === undefined ? undefined : v === 'true')),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  cursor: z.string().optional(),
});

export const savedViewCreateSchema = z.object({
  domain: z.enum(domainEnum),
  name: z.string().min(1, 'Name is required').max(100).trim(),
  filterConfig: z.record(z.unknown()),
  sortConfig: z.record(z.unknown()).optional().nullable(),
  isPinned: z.boolean().optional().default(false),
  isDefault: z.boolean().optional().default(false),
  sortOrder: z.number().int().optional().default(0),
});

export const savedViewUpdateSchema = z.object({
  name: z.string().min(1).max(100).trim().optional(),
  filterConfig: z.record(z.unknown()).optional(),
  sortConfig: z.record(z.unknown()).optional().nullable(),
  isPinned: z.boolean().optional(),
  isDefault: z.boolean().optional(),
  sortOrder: z.number().int().optional(),
});

export const paginationQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
  q: z.string().max(100).optional(),
  sortBy: z.string().default('createdAt'),
  sortDir: z.enum(['asc', 'desc']).default('desc'),
  cursor: z.string().optional(),
});

export const attachmentMetaCreateSchema = z.object({
  entityType: z.enum(entityTypeEnum),
  entityId: z.string().min(1),
  fileName: z.string().min(1).max(255),
  fileSize: z.number().int().min(0).max(52428800), // 50 MB
  mimeType: z.string().min(1).max(100),
  sha256: z.string().max(64).optional().nullable(),
});
