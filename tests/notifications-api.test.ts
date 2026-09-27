import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { createTestDatabase } from './test-db';
import app from '../src/server/index';
import type { ApiSuccessResponse, InAppNotificationData } from '../src/shared/types';
import { inAppNotifications } from '../src/server/db/schema';
import { createDb } from '../src/server/db/client';

describe('Notifications API Suite', () => {
  let testD1: D1Database;
  let disposeDb: () => Promise<void>;
  let userCookie: string;
  let userId: string;

  beforeAll(async () => {
    const { db, dispose } = await createTestDatabase();
    testD1 = db;
    disposeDb = dispose;

    // Bootstrap user
    const res = await app.request(
      '/api/auth/bootstrap',
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: 'Notif Tester',
          email: 'notif@test.local',
          password: 'Password123!',
        }),
      },
      { DB: testD1 }
    );
    expect(res.status).toBe(201);
    const setCookie = res.headers.get('set-cookie') || '';
    userCookie = setCookie.split(';')[0];

    const meRes = await app.request(
      '/api/auth/me',
      { headers: { Cookie: userCookie } },
      { DB: testD1 }
    );
    const meJson = await meRes.json();
    userId = meJson.data.user.id;

    // Seed test notifications
    const dbClient = createDb(testD1);
    const now = Date.now();

    await dbClient.insert(inAppNotifications).values([
      {
        id: 'n_1',
        userId,
        type: 'reminder',
        title: 'Task Reminder: Send Invoice',
        body: 'Invoice #1042 needs to be sent to Client X.',
        level: 'info',
        entityType: 'task',
        entityId: 'task_1042',
        actionUrl: '/tasks?id=task_1042',
        isRead: 0,
        createdAt: new Date(now - 3000),
      },
      {
        id: 'n_2',
        userId,
        type: 'budget_alert',
        title: 'Budget Alert: Groceries',
        body: 'You have used 95% of your monthly groceries budget.',
        level: 'warning',
        entityType: 'finance_budget',
        entityId: 'bgt_groc',
        actionUrl: '/finance?tab=budgets&id=bgt_groc',
        isRead: 0,
        createdAt: new Date(now - 2000),
      },
      {
        id: 'n_3',
        userId,
        type: 'security',
        title: 'New Session Created',
        body: 'Logged in from Firefox on Windows.',
        level: 'info',
        entityType: 'custom',
        isRead: 1,
        readAt: new Date(now - 500),
        createdAt: new Date(now - 1000),
      },
    ]);
  });

  afterAll(async () => {
    if (disposeDb) {
      await disposeDb();
    }
  });

  it('fetches notification feed with cursor pagination', async () => {
    const res = await app.request(
      '/api/notifications?limit=2',
      { headers: { Cookie: userCookie } },
      { DB: testD1 }
    );

    expect(res.status).toBe(200);
    const json = (await res.json()) as ApiSuccessResponse<InAppNotificationData[]>;
    expect(json.success).toBe(true);
    expect(json.data.length).toBe(2);
    expect(json.meta).toBeDefined();
  });

  it('fetches unread notifications count', async () => {
    const res = await app.request(
      '/api/notifications/unread-count',
      { headers: { Cookie: userCookie } },
      { DB: testD1 }
    );

    expect(res.status).toBe(200);
    const json = (await res.json()) as ApiSuccessResponse<{ unreadCount: number }>;
    expect(json.success).toBe(true);
    expect(json.data.unreadCount).toBe(2); // n_1 and n_2
  });

  it('filters notifications by unreadOnly=true', async () => {
    const res = await app.request(
      '/api/notifications?unreadOnly=true',
      { headers: { Cookie: userCookie } },
      { DB: testD1 }
    );

    expect(res.status).toBe(200);
    const json = (await res.json()) as ApiSuccessResponse<InAppNotificationData[]>;
    expect(json.data.length).toBe(2);
    expect(json.data.every((n) => !n.isRead)).toBe(true);
  });

  it('marks a single notification as read via PATCH /api/notifications/:id/read', async () => {
    const res = await app.request(
      '/api/notifications/n_1/read',
      {
        method: 'PATCH',
        headers: { Cookie: userCookie },
      },
      { DB: testD1 }
    );

    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.success).toBe(true);
    expect(json.data.isRead).toBe(true);

    // Verify unread count decreased to 1
    const countRes = await app.request(
      '/api/notifications/unread-count',
      { headers: { Cookie: userCookie } },
      { DB: testD1 }
    );
    const countJson = await countRes.json();
    expect(countJson.data.unreadCount).toBe(1);
  });

  it('marks all remaining unread notifications as read via POST /api/notifications/mark-all-read', async () => {
    const res = await app.request(
      '/api/notifications/mark-all-read',
      {
        method: 'POST',
        headers: { Cookie: userCookie },
      },
      { DB: testD1 }
    );

    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.success).toBe(true);

    // Verify unread count is now 0
    const countRes = await app.request(
      '/api/notifications/unread-count',
      { headers: { Cookie: userCookie } },
      { DB: testD1 }
    );
    const countJson = await countRes.json();
    expect(countJson.data.unreadCount).toBe(0);
  });

  it('deletes a notification via DELETE /api/notifications/:id', async () => {
    const res = await app.request(
      '/api/notifications/n_3',
      {
        method: 'DELETE',
        headers: { Cookie: userCookie },
      },
      { DB: testD1 }
    );

    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.success).toBe(true);
    expect(json.data.id).toBe('n_3');
  });
});
