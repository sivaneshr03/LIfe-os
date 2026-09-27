import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import app from '../src/server/index';
import { createTestDatabase } from './test-db';
import type {
  ApiSuccessResponse,
  CategoryData,
  TagData,
  EntityTagData,
  ReminderData,
  InAppNotificationData,
  SavedViewData,
  AttachmentMetaData,
  ImportExportJobData,
} from '../src/shared/types';

describe('Shared Platform Services API Suite', () => {
  let testD1: D1Database;
  let disposeD1: () => Promise<void>;
  let userACookie: string;
  let userBCookie: string;

  beforeAll(async () => {
    const { db, dispose } = await createTestDatabase();
    testD1 = db;
    disposeD1 = dispose;

    // Bootstrap User A
    const resA = await app.request(
      '/api/auth/bootstrap',
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: 'User A',
          email: 'usera@example.com',
          password: 'Password123!',
        }),
      },
      { DB: testD1 }
    );
    const setCookieA = resA.headers.get('set-cookie');
    userACookie = setCookieA?.split(';')[0] || '';

    // Create invite for User B
    const inviteRes = await app.request(
      '/api/admin/invites',
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Cookie: userACookie,
        },
        body: JSON.stringify({
          email: 'userb@example.com',
          role: 'user',
        }),
      },
      { DB: testD1 }
    );
    const inviteJson = (await inviteRes.json()) as ApiSuccessResponse<{ code: string }>;

    // Register User B
    const resB = await app.request(
      '/api/auth/register',
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          code: inviteJson.data.code,
          name: 'User B',
          password: 'Password123!',
        }),
      },
      { DB: testD1 }
    );
    const setCookieB = resB.headers.get('set-cookie');
    userBCookie = setCookieB?.split(';')[0] || '';
  });

  afterAll(async () => {
    if (disposeD1) await disposeD1();
  });

  describe('Categories & Subcategories with Domain Isolation', () => {
    it('seeds default categories automatically upon account creation', async () => {
      const res = await app.request(
        '/api/categories?domain=finance',
        { headers: { Cookie: userACookie } },
        { DB: testD1 }
      );
      expect(res.status).toBe(200);
      const json = (await res.json()) as ApiSuccessResponse<CategoryData[]>;
      expect(json.success).toBe(true);
      expect(json.data.length).toBeGreaterThan(0);

      // Check subcategories are nested
      const housing = json.data.find((c) => c.slug === 'housing');
      expect(housing).toBeDefined();
      expect(housing?.subcategories?.length).toBeGreaterThan(0);
    });

    it('isolates categories by domain (finance vs task)', async () => {
      const financeRes = await app.request(
        '/api/categories?domain=finance',
        { headers: { Cookie: userACookie } },
        { DB: testD1 }
      );
      const financeCats = ((await financeRes.json()) as ApiSuccessResponse<CategoryData[]>).data;
      expect(financeCats.every((c) => c.domain === 'finance')).toBe(true);

      const taskRes = await app.request(
        '/api/categories?domain=task',
        { headers: { Cookie: userACookie } },
        { DB: testD1 }
      );
      const taskCats = ((await taskRes.json()) as ApiSuccessResponse<CategoryData[]>).data;
      expect(taskCats.every((c) => c.domain === 'task')).toBe(true);
    });

    it('creates custom category and custom subcategory', async () => {
      // Create parent category in task domain
      const parentRes = await app.request(
        '/api/categories',
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Cookie: userACookie },
          body: JSON.stringify({
            domain: 'task',
            name: 'Client Projects',
            color: '#10b981',
          }),
        },
        { DB: testD1 }
      );
      expect(parentRes.status).toBe(201);
      const parent = ((await parentRes.json()) as ApiSuccessResponse<CategoryData>).data;
      expect(parent.name).toBe('Client Projects');
      expect(parent.domain).toBe('task');
      expect(parent.parentId).toBeNull();

      // Create subcategory
      const subRes = await app.request(
        '/api/categories',
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Cookie: userACookie },
          body: JSON.stringify({
            domain: 'task',
            parentId: parent.id,
            name: 'Alpha Redesign',
          }),
        },
        { DB: testD1 }
      );
      expect(subRes.status).toBe(201);
      const sub = ((await subRes.json()) as ApiSuccessResponse<CategoryData>).data;
      expect(sub.parentId).toBe(parent.id);

      // Verify nested structure on GET
      const listRes = await app.request(
        '/api/categories?domain=task',
        { headers: { Cookie: userACookie } },
        { DB: testD1 }
      );
      const list = ((await listRes.json()) as ApiSuccessResponse<CategoryData[]>).data;
      const foundParent = list.find((c) => c.id === parent.id);
      expect(foundParent).toBeDefined();
      // Verify querying subcategories cleanly scoped via query param parentId
      const scopedRes = await app.request(
        `/api/categories?parentId=${parent.id}`,
        { headers: { Cookie: userACookie } },
        { DB: testD1 }
      );
      expect(scopedRes.status).toBe(200);
      const scopedList = ((await scopedRes.json()) as ApiSuccessResponse<CategoryData[]>).data;
      expect(scopedList.length).toBe(1);
      expect(scopedList[0].id).toBe(sub.id);

      // Verify querying subcategories cleanly scoped via dedicated endpoint /:parentId/subcategories
      const dedicatedSubRes = await app.request(
        `/api/categories/${parent.id}/subcategories`,
        { headers: { Cookie: userACookie } },
        { DB: testD1 }
      );
      expect(dedicatedSubRes.status).toBe(200);
      const dedicatedList = ((await dedicatedSubRes.json()) as ApiSuccessResponse<CategoryData[]>).data;
      expect(dedicatedList.length).toBe(1);
      expect(dedicatedList[0].id).toBe(sub.id);
    });

    it('supports moving subcategories and rejects setting self as parent', async () => {
      // Create two parents in task domain
      const p1Res = await app.request('/api/categories', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Cookie: userACookie },
        body: JSON.stringify({ domain: 'task', name: 'Work A' }),
      }, { DB: testD1 });
      const p1 = ((await p1Res.json()) as ApiSuccessResponse<CategoryData>).data;

      const p2Res = await app.request('/api/categories', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Cookie: userACookie },
        body: JSON.stringify({ domain: 'task', name: 'Work B' }),
      }, { DB: testD1 });
      const p2 = ((await p2Res.json()) as ApiSuccessResponse<CategoryData>).data;

      // Create child under p1
      const childRes = await app.request('/api/categories', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Cookie: userACookie },
        body: JSON.stringify({ domain: 'task', parentId: p1.id, name: 'Child Task' }),
      }, { DB: testD1 });
      const child = ((await childRes.json()) as ApiSuccessResponse<CategoryData>).data;

      // Reject self as parent
      const selfParentRes = await app.request(`/api/categories/${child.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', Cookie: userACookie },
        body: JSON.stringify({ parentId: child.id }),
      }, { DB: testD1 });
      expect(selfParentRes.status).toBe(400);

      // Reassign to p2
      const moveRes = await app.request(`/api/categories/${child.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', Cookie: userACookie },
        body: JSON.stringify({ parentId: p2.id }),
      }, { DB: testD1 });
      expect(moveRes.status).toBe(200);

      // Verify under p2 subcategories
      const p2SubRes = await app.request(`/api/categories/${p2.id}/subcategories`, {
        headers: { Cookie: userACookie },
      }, { DB: testD1 });
      const p2Subs = ((await p2SubRes.json()) as ApiSuccessResponse<CategoryData[]>).data;
      expect(p2Subs.some((s) => s.id === child.id)).toBe(true);
    });

    it('rejects assigning a parent category from a different domain', async () => {
      // Find a finance category
      const financeRes = await app.request(
        '/api/categories?domain=finance',
        { headers: { Cookie: userACookie } },
        { DB: testD1 }
      );
      const financeCat = ((await financeRes.json()) as ApiSuccessResponse<CategoryData[]>).data[0];

      // Try creating a task subcategory with finance parent
      const invalidRes = await app.request(
        '/api/categories',
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Cookie: userACookie },
          body: JSON.stringify({
            domain: 'task',
            parentId: financeCat.id,
            name: 'Invalid Cross-Domain Child',
          }),
        },
        { DB: testD1 }
      );
      expect(invalidRes.status).toBe(400);
    });

    it('disables category non-destructively without destroying records', async () => {
      // Create a category
      const catRes = await app.request(
        '/api/categories',
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Cookie: userACookie },
          body: JSON.stringify({
            domain: 'note',
            name: 'Old Archive Category',
          }),
        },
        { DB: testD1 }
      );
      const cat = ((await catRes.json()) as ApiSuccessResponse<CategoryData>).data;

      // Disable it
      const patchRes = await app.request(
        `/api/categories/${cat.id}`,
        {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json', Cookie: userACookie },
          body: JSON.stringify({ isEnabled: false }),
        },
        { DB: testD1 }
      );
      expect(patchRes.status).toBe(200);

      // Default query excludes disabled category
      const listRes = await app.request(
        '/api/categories?domain=note',
        { headers: { Cookie: userACookie } },
        { DB: testD1 }
      );
      const activeList = ((await listRes.json()) as ApiSuccessResponse<CategoryData[]>).data;
      expect(activeList.some((c) => c.id === cat.id)).toBe(false);

      // Query with includeDisabled: true includes it
      const allRes = await app.request(
        '/api/categories?domain=note&includeDisabled=true',
        { headers: { Cookie: userACookie } },
        { DB: testD1 }
      );
      const allList = ((await allRes.json()) as ApiSuccessResponse<CategoryData[]>).data;
      const found = allList.find((c) => c.id === cat.id);
      expect(found).toBeDefined();
      expect(found?.isEnabled).toBe(false);
    });

    it('prevents deleting a parent category that has active subcategories', async () => {
      // Create parent & sub
      const parentRes = await app.request(
        '/api/categories',
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Cookie: userACookie },
          body: JSON.stringify({ domain: 'fitness', name: 'Parent Cardio' }),
        },
        { DB: testD1 }
      );
      const parent = ((await parentRes.json()) as ApiSuccessResponse<CategoryData>).data;

      await app.request(
        '/api/categories',
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Cookie: userACookie },
          body: JSON.stringify({ domain: 'fitness', parentId: parent.id, name: 'Rowing' }),
        },
        { DB: testD1 }
      );

      // Attempt to delete parent
      const deleteRes = await app.request(
        `/api/categories/${parent.id}`,
        { method: 'DELETE', headers: { Cookie: userACookie } },
        { DB: testD1 }
      );
      expect(deleteRes.status).toBe(400);
    });
  });

  describe('Tags & Polymorphic Entity Associations', () => {
    let tagId: string;

    it('creates tag in user dictionary', async () => {
      const res = await app.request(
        '/api/tags',
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Cookie: userACookie },
          body: JSON.stringify({ name: 'High Priority', color: '#ef4444' }),
        },
        { DB: testD1 }
      );
      expect(res.status).toBe(201);
      const json = (await res.json()) as ApiSuccessResponse<TagData>;
      tagId = json.data.id;
      expect(json.data.slug).toBe('high-priority');
    });

    it('attaches tag to polymorphic entity types (task and finance_transaction)', async () => {
      // Attach to task
      const attachTaskRes = await app.request(
        `/api/tags/entities/task/task_001`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Cookie: userACookie },
          body: JSON.stringify({ tagId }),
        },
        { DB: testD1 }
      );
      expect(attachTaskRes.status).toBe(201);

      // Attach to finance transaction
      const attachTxnRes = await app.request(
        `/api/tags/entities/finance_transaction/txn_999`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Cookie: userACookie },
          body: JSON.stringify({ tagId }),
        },
        { DB: testD1 }
      );
      expect(attachTxnRes.status).toBe(201);

      // Fetch task tags
      const getTaskTags = await app.request(
        `/api/tags/entities/task/task_001`,
        { headers: { Cookie: userACookie } },
        { DB: testD1 }
      );
      const taskTags = ((await getTaskTags.json()) as ApiSuccessResponse<EntityTagData[]>).data;
      expect(taskTags.length).toBe(1);
      expect(taskTags[0].tagId).toBe(tagId);
      expect(taskTags[0].tag?.name).toBe('High Priority');
    });

    it('removes tag from single entity without affecting others', async () => {
      // Delete from task_001
      const delRes = await app.request(
        `/api/tags/entities/task/task_001/${tagId}`,
        { method: 'DELETE', headers: { Cookie: userACookie } },
        { DB: testD1 }
      );
      expect(delRes.status).toBe(200);

      // Verify removed from task
      const taskTagsRes = await app.request(
        `/api/tags/entities/task/task_001`,
        { headers: { Cookie: userACookie } },
        { DB: testD1 }
      );
      const taskTags = ((await taskTagsRes.json()) as ApiSuccessResponse<EntityTagData[]>).data;
      expect(taskTags.length).toBe(0);

      // Verify still present on finance transaction
      const txnTagsRes = await app.request(
        `/api/tags/entities/finance_transaction/txn_999`,
        { headers: { Cookie: userACookie } },
        { DB: testD1 }
      );
      const txnTags = ((await txnTagsRes.json()) as ApiSuccessResponse<EntityTagData[]>).data;
      expect(txnTags.length).toBe(1);
    });
  });

  describe('Generic Multi-Entity Reminders', () => {
    it('creates, snoozes, and dismisses reminders across entity types', async () => {
      const remindAt = Date.now() + 60 * 60 * 1000;

      // Create reminder for task
      const createRes = await app.request(
        '/api/reminders',
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Cookie: userACookie },
          body: JSON.stringify({
            entityType: 'task',
            entityId: 'task_001',
            title: 'Complete Quarter End Audit',
            remindAt,
          }),
        },
        { DB: testD1 }
      );
      expect(createRes.status).toBe(201);
      const rem = ((await createRes.json()) as ApiSuccessResponse<ReminderData>).data;
      expect(rem.status).toBe('pending');

      // Snooze reminder
      const snoozeUntil = Date.now() + 2 * 60 * 60 * 1000;
      const snoozeRes = await app.request(
        `/api/reminders/${rem.id}/status`,
        {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json', Cookie: userACookie },
          body: JSON.stringify({
            status: 'snoozed',
            snoozedUntil: snoozeUntil,
          }),
        },
        { DB: testD1 }
      );
      expect(snoozeRes.status).toBe(200);
      const snoozed = ((await snoozeRes.json()) as ApiSuccessResponse<ReminderData>).data;
      expect(snoozed.status).toBe('snoozed');
      expect(snoozed.snoozedUntil).toBe(snoozeUntil);

      // Dismiss reminder
      const dismissRes = await app.request(
        `/api/reminders/${rem.id}/status`,
        {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json', Cookie: userACookie },
          body: JSON.stringify({ status: 'dismissed' }),
        },
        { DB: testD1 }
      );
      expect(dismissRes.status).toBe(200);
      const dismissed = ((await dismissRes.json()) as ApiSuccessResponse<ReminderData>).data;
      expect(dismissed.status).toBe('dismissed');
      expect(dismissed.dismissedAt).not.toBeNull();
    });
  });

  describe('Saved Views & Filter Presets', () => {
    it('creates, retrieves, and updates saved view presets', async () => {
      const createRes = await app.request(
        '/api/saved-views',
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Cookie: userACookie },
          body: JSON.stringify({
            domain: 'finance',
            name: 'High Expenses Q3',
            filterConfig: { minAmountCents: 50000, category: 'Housing' },
            isPinned: true,
          }),
        },
        { DB: testD1 }
      );
      expect(createRes.status).toBe(201);
      const view = ((await createRes.json()) as ApiSuccessResponse<SavedViewData>).data;
      expect(view.name).toBe('High Expenses Q3');
      expect(view.isPinned).toBe(true);

      const listRes = await app.request(
        '/api/saved-views?domain=finance',
        { headers: { Cookie: userACookie } },
        { DB: testD1 }
      );
      const list = ((await listRes.json()) as ApiSuccessResponse<SavedViewData[]>).data;
      expect(list.some((v) => v.id === view.id)).toBe(true);
    });
  });

  describe('In-App Notifications Feed & Pagination', () => {
    it('retrieves notifications and marks them as read', async () => {
      // Seed a notification in DB directly
      const notifId = 'notif_test_001';
      await testD1
        .prepare(
          `INSERT INTO in_app_notifications (id, user_id, type, title, body, level, is_read, created_at)
           VALUES (?, (SELECT id FROM users WHERE email = 'usera@example.com'), 'system', 'Welcome!', 'Welcome to LifeOS', 'info', 0, ?)`
        )
        .bind(notifId, Date.now())
        .run();

      const feedRes = await app.request(
        '/api/notifications?unreadOnly=true',
        { headers: { Cookie: userACookie } },
        { DB: testD1 }
      );
      expect(feedRes.status).toBe(200);
      const feedJson = (await feedRes.json()) as ApiSuccessResponse<InAppNotificationData[]>;
      expect(feedJson.data.some((n) => n.id === notifId)).toBe(true);

      // Mark single notification read
      const markRes = await app.request(
        `/api/notifications/${notifId}/read`,
        { method: 'PATCH', headers: { Cookie: userACookie } },
        { DB: testD1 }
      );
      expect(markRes.status).toBe(200);

      // Verify unread feed is now empty
      const afterRes = await app.request(
        '/api/notifications?unreadOnly=true',
        { headers: { Cookie: userACookie } },
        { DB: testD1 }
      );
      const afterJson = (await afterRes.json()) as ApiSuccessResponse<InAppNotificationData[]>;
      expect(afterJson.data.some((n) => n.id === notifId)).toBe(false);
    });
  });

  describe('Attachment Metadata (Deferred R2 Storage)', () => {
    it('records and retrieves attachment metadata without storing binary files', async () => {
      const createRes = await app.request(
        '/api/attachments',
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Cookie: userACookie },
          body: JSON.stringify({
            entityType: 'task',
            entityId: 'task_001',
            fileName: 'specification.pdf',
            fileSize: 1048576,
            mimeType: 'application/pdf',
          }),
        },
        { DB: testD1 }
      );
      expect(createRes.status).toBe(201);
      const att = ((await createRes.json()) as ApiSuccessResponse<AttachmentMetaData>).data;
      expect(att.fileName).toBe('specification.pdf');
      expect(att.storageProvider).toBe('deferred');

      const listRes = await app.request(
        '/api/attachments?entityType=task&entityId=task_001',
        { headers: { Cookie: userACookie } },
        { DB: testD1 }
      );
      const list = ((await listRes.json()) as ApiSuccessResponse<AttachmentMetaData[]>).data;
      expect(list.some((a) => a.id === att.id)).toBe(true);
    });
  });

  describe('Import / Export Job Tracking', () => {
    it('creates and checks background job tracking record', async () => {
      const jobRes = await app.request(
        '/api/jobs',
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Cookie: userACookie },
          body: JSON.stringify({
            type: 'export',
            domain: 'finance',
            format: 'csv',
          }),
        },
        { DB: testD1 }
      );
      expect(jobRes.status).toBe(201);
      const job = ((await jobRes.json()) as ApiSuccessResponse<ImportExportJobData>).data;
      expect(job.status).toBe('pending');
      expect(job.format).toBe('csv');

      const getJob = await app.request(
        `/api/jobs/${job.id}`,
        { headers: { Cookie: userACookie } },
        { DB: testD1 }
      );
      expect(getJob.status).toBe(200);
      const fetched = ((await getJob.json()) as ApiSuccessResponse<ImportExportJobData>).data;
      expect(fetched.id).toBe(job.id);
    });
  });

  describe('User Scoping & Isolation Invariant', () => {
    it('guarantees User B cannot read or mutate User A resources', async () => {
      // User A creates a secret category
      const catRes = await app.request(
        '/api/categories',
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Cookie: userACookie },
          body: JSON.stringify({ domain: 'note', name: 'User A Secret Journal' }),
        },
        { DB: testD1 }
      );
      const catA = ((await catRes.json()) as ApiSuccessResponse<CategoryData>).data;

      // User B attempts to patch User A category -> 404 (ownership scope)
      const patchRes = await app.request(
        `/api/categories/${catA.id}`,
        {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json', Cookie: userBCookie },
          body: JSON.stringify({ name: 'Hacked by User B' }),
        },
        { DB: testD1 }
      );
      expect(patchRes.status).toBe(404);

      // User B query does not include User A category
      const userBList = await app.request(
        '/api/categories?domain=note&includeDisabled=true',
        { headers: { Cookie: userBCookie } },
        { DB: testD1 }
      );
      const bCats = ((await userBList.json()) as ApiSuccessResponse<CategoryData[]>).data;
      expect(bCats.some((c) => c.id === catA.id)).toBe(false);
    });
  });
});
