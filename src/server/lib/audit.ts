import type { Context } from 'hono';
import { createDb } from '../db/client';
import { auditEvents } from '../db/schema';
import { generateOpaqueToken, hashIp } from './crypto';
import type { AppBindings } from '../index';

export async function logAuditEvent(
  c: Context<{ Bindings: AppBindings }>,
  eventType: string,
  metadata?: Record<string, unknown>,
  userId?: string | null
): Promise<void> {
  if (!c.env?.DB) return;

  try {
    const db = createDb(c.env.DB);
    const clientIp = c.req.header('cf-connecting-ip') || c.req.header('x-forwarded-for') || '127.0.0.1';
    const ipHash = await hashIp(clientIp);

    await db.insert(auditEvents).values({
      id: generateOpaqueToken(16),
      userId: userId || null,
      eventType,
      ipHash,
      metadata: metadata ? JSON.stringify(metadata) : null,
      createdAt: new Date(),
    });
  } catch (error) {
    console.error('[AuditLog] Failed to record audit event:', error);
  }
}
