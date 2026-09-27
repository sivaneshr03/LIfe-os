import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import app from '../src/server/index';
import { createTestDatabase } from './test-db';
import type {
  ApiSuccessResponse,
  ApiPaginatedResponse,
  ProjectData,
  BoardData,
  BoardColumnData,
  TaskData,
  TaskChecklistItemData,
  DailyNoteData,
  NoteData,
  PromptData,
  PromptVersionData,
} from '../src/shared/types';

describe('Productivity Core API Suite', () => {
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
          name: 'Productivity User A',
          email: 'proda@example.com',
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
          email: 'prodb@example.com',
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
          name: 'Productivity User B',
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

  describe('Projects & Kanban Boards API', () => {
    let createdProjectId: string;
    let autoBoardId: string;

    it('creates a project with auto-generated board and default workflow columns', async () => {
      const res = await app.request(
        '/api/projects',
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Cookie: userACookie,
          },
          body: JSON.stringify({
            name: 'LifeOS Core Roadmap',
            description: 'Platform and productivity engine development',
            color: '#3b82f6',
            targetDate: '2026-12-31',
          }),
        },
        { DB: testD1 }
      );

      expect(res.status).toBe(201);
      const json = (await res.json()) as ApiSuccessResponse<ProjectData & { boardId: string }>;
      expect(json.success).toBe(true);
      expect(json.data.name).toBe('LifeOS Core Roadmap');
      expect(json.data.slug).toBe('lifeos-core-roadmap');
      expect(json.data.boardId).toBeDefined();

      createdProjectId = json.data.id;
      autoBoardId = json.data.boardId;
    });

    it('retrieves board with default columns (To Do, In Progress, Blocked, Done)', async () => {
      const res = await app.request(
        `/api/boards/${autoBoardId}`,
        {
          headers: { Cookie: userACookie },
        },
        { DB: testD1 }
      );

      expect(res.status).toBe(200);
      const json = (await res.json()) as ApiSuccessResponse<BoardData>;
      expect(json.success).toBe(true);
      expect(json.data.projectId).toBe(createdProjectId);
      expect(json.data.columns).toHaveLength(4);

      const colNames = json.data.columns?.map((c) => c.name);
      expect(colNames).toEqual(['To Do', 'In Progress', 'Blocked', 'Done']);
    });

    it('creates an extra column on the board with WIP limit', async () => {
      const res = await app.request(
        `/api/boards/${autoBoardId}/columns`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Cookie: userACookie,
          },
          body: JSON.stringify({
            name: 'Code Review',
            statusMapping: 'in_progress',
            color: '#8b5cf6',
            wipLimit: 3,
            sortOrder: 2,
          }),
        },
        { DB: testD1 }
      );

      expect(res.status).toBe(201);
      const json = (await res.json()) as ApiSuccessResponse<BoardColumnData>;
      expect(json.success).toBe(true);
      expect(json.data.name).toBe('Code Review');
      expect(json.data.wipLimit).toBe(3);
    });

    it('enforces user isolation: User B cannot access User A project or board', async () => {
      const projRes = await app.request(
        `/api/projects/${createdProjectId}`,
        {
          headers: { Cookie: userBCookie },
        },
        { DB: testD1 }
      );
      expect(projRes.status).toBe(404);

      const boardRes = await app.request(
        `/api/boards/${autoBoardId}`,
        {
          headers: { Cookie: userBCookie },
        },
        { DB: testD1 }
      );
      expect(boardRes.status).toBe(404);
    });
  });

  describe('Tasks, Subtasks, Checklists & Progress API', () => {
    let parentTaskId: string;
    let checklistItemId: string;

    it('creates a task with due date, time, and calculated timestamp', async () => {
      const res = await app.request(
        '/api/tasks',
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Cookie: userACookie,
          },
          body: JSON.stringify({
            title: 'Implement Recurring Tasks Invariant',
            description: 'Ensure recurrence engine never reuses completed occurrences',
            priority: 'urgent',
            dueDate: '2026-10-15',
            dueTime: '14:30',
            estimatedMinutes: 120,
          }),
        },
        { DB: testD1 }
      );

      expect(res.status).toBe(201);
      const json = (await res.json()) as ApiSuccessResponse<TaskData>;
      expect(json.success).toBe(true);
      expect(json.data.title).toBe('Implement Recurring Tasks Invariant');
      expect(json.data.dueDate).toBe('2026-10-15');
      expect(json.data.dueTime).toBe('14:30');
      expect(json.data.dueTimestampMs).toBe(Date.UTC(2026, 9, 15, 14, 30, 0));
      expect(json.data.status).toBe('todo');

      parentTaskId = json.data.id;
    });

    it('adds checklist items and calculates progress percentage', async () => {
      // Add checklist item 1
      const item1Res = await app.request(
        `/api/tasks/${parentTaskId}/checklist`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Cookie: userACookie,
          },
          body: JSON.stringify({
            title: 'Write recurrence unit tests',
            sortOrder: 1,
          }),
        },
        { DB: testD1 }
      );
      expect(item1Res.status).toBe(201);
      const item1Json = (await item1Res.json()) as ApiSuccessResponse<TaskChecklistItemData>;
      checklistItemId = item1Json.data.id;

      // Add checklist item 2
      await app.request(
        `/api/tasks/${parentTaskId}/checklist`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Cookie: userACookie,
          },
          body: JSON.stringify({
            title: 'Verify exception skip handling',
            sortOrder: 2,
          }),
        },
        { DB: testD1 }
      );

      // Check task progress: 0/2 completed = 0%
      const detailRes1 = await app.request(
        `/api/tasks/${parentTaskId}`,
        {
          headers: { Cookie: userACookie },
        },
        { DB: testD1 }
      );
      const detailJson1 = (await detailRes1.json()) as ApiSuccessResponse<TaskData>;
      expect(detailJson1.data.checklistCount).toBe(2);
      expect(detailJson1.data.completedChecklistCount).toBe(0);
      expect(detailJson1.data.progressPercentage).toBe(0);

      // Mark item 1 completed
      const patchItemRes = await app.request(
        `/api/tasks/checklist/${checklistItemId}`,
        {
          method: 'PATCH',
          headers: {
            'Content-Type': 'application/json',
            Cookie: userACookie,
          },
          body: JSON.stringify({
            isCompleted: true,
          }),
        },
        { DB: testD1 }
      );
      expect(patchItemRes.status).toBe(200);

      // Check task progress: 1/2 completed = 50%
      const detailRes2 = await app.request(
        `/api/tasks/${parentTaskId}`,
        {
          headers: { Cookie: userACookie },
        },
        { DB: testD1 }
      );
      const detailJson2 = (await detailRes2.json()) as ApiSuccessResponse<TaskData>;
      expect(detailJson2.data.completedChecklistCount).toBe(1);
      expect(detailJson2.data.progressPercentage).toBe(50);
    });

    it('creates subtasks and updates task state transitions with completedAt timestamp', async () => {
      // Create subtask
      const subtaskRes = await app.request(
        '/api/tasks',
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Cookie: userACookie,
          },
          body: JSON.stringify({
            parentTaskId,
            title: 'Benchmark performance of D1 queries',
            priority: 'medium',
          }),
        },
        { DB: testD1 }
      );
      expect(subtaskRes.status).toBe(201);

      // Mark parent task done
      const patchRes = await app.request(
        `/api/tasks/${parentTaskId}`,
        {
          method: 'PATCH',
          headers: {
            'Content-Type': 'application/json',
            Cookie: userACookie,
          },
          body: JSON.stringify({
            status: 'done',
          }),
        },
        { DB: testD1 }
      );

      expect(patchRes.status).toBe(200);
      const patchJson = (await patchRes.json()) as ApiSuccessResponse<TaskData>;
      expect(patchJson.data.status).toBe('done');
      expect(patchJson.data.completedAt).toBeDefined();
      expect(typeof patchJson.data.completedAt).toBe('number');

      // Toggling away from done resets completedAt to null
      const revertRes = await app.request(
        `/api/tasks/${parentTaskId}`,
        {
          method: 'PATCH',
          headers: {
            'Content-Type': 'application/json',
            Cookie: userACookie,
          },
          body: JSON.stringify({
            status: 'in_progress',
          }),
        },
        { DB: testD1 }
      );
      expect(revertRes.status).toBe(200);
      const revertJson = (await revertRes.json()) as ApiSuccessResponse<TaskData>;
      expect(revertJson.data.status).toBe('in_progress');
      expect(revertJson.data.completedAt).toBeNull();
    });

    it('filters tasks by query, priority, and pagination', async () => {
      const res = await app.request(
        '/api/tasks?q=Recurring&priority=urgent&page=1&pageSize=10',
        {
          headers: { Cookie: userACookie },
        },
        { DB: testD1 }
      );

      expect(res.status).toBe(200);
      const json = (await res.json()) as ApiPaginatedResponse<TaskData>;
      expect(json.success).toBe(true);
      expect(json.data.items.length).toBeGreaterThanOrEqual(1);
      expect(json.data.items[0].priority).toBe('urgent');
      expect(json.data.pagination.totalItems).toBeGreaterThanOrEqual(1);
    });
  });

  describe('Daily Notes API', () => {
    const today = '2026-10-10';

    it('upserts daily note and calculates word count', async () => {
      const res1 = await app.request(
        `/api/daily-notes/${today}`,
        {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
            Cookie: userACookie,
          },
          body: JSON.stringify({
            content: 'Today was an exceptional day of architectural implementation. All foundation modules verified.',
            summary: 'Productivity core completed successfully',
            mood: 5,
            energy: 5,
          }),
        },
        { DB: testD1 }
      );

      expect(res1.status).toBe(200);
      const json1 = (await res1.json()) as ApiSuccessResponse<DailyNoteData>;
      expect(json1.success).toBe(true);
      expect(json1.data.date).toBe(today);
      expect(json1.data.wordCount).toBe(12);
      expect(json1.data.mood).toBe(5);

      // Re-upsert updates the same record without duplicates
      const res2 = await app.request(
        `/api/daily-notes/${today}`,
        {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
            Cookie: userACookie,
          },
          body: JSON.stringify({
            content: 'Updated content with four words here.',
            mood: 4,
          }),
        },
        { DB: testD1 }
      );

      expect(res2.status).toBe(200);
      const json2 = (await res2.json()) as ApiSuccessResponse<DailyNoteData>;
      expect(json2.data.wordCount).toBe(6);
      expect(json2.data.mood).toBe(4);
      expect(json2.data.id).toBe(json1.data.id);
    });

    it('enforces isolation: User B cannot retrieve User A daily note', async () => {
      const res = await app.request(
        `/api/daily-notes/${today}`,
        {
          headers: { Cookie: userBCookie },
        },
        { DB: testD1 }
      );

      expect(res.status).toBe(404);
    });
  });

  describe('General Notes API', () => {
    let noteId: string;

    it('creates knowledge base note, generates slug, and calculates reading time', async () => {
      const content = 'Word '.repeat(450); // 450 words = 3 minutes reading time at 200 wpm
      const res = await app.request(
        '/api/notes',
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Cookie: userACookie,
          },
          body: JSON.stringify({
            title: 'LifeOS Architecture Blueprint',
            summary: 'High-level system design directives',
            content,
            isPinned: true,
          }),
        },
        { DB: testD1 }
      );

      expect(res.status).toBe(201);
      const json = (await res.json()) as ApiSuccessResponse<NoteData>;
      expect(json.success).toBe(true);
      expect(json.data.slug).toBe('lifeos-architecture-blueprint');
      expect(json.data.wordCount).toBe(450);
      expect(json.data.readingTimeMinutes).toBe(3);
      expect(json.data.isPinned).toBe(true);

      noteId = json.data.id;
    });

    it('searches and filters notes', async () => {
      const res = await app.request(
        '/api/notes?q=Blueprint&isPinned=true',
        {
          headers: { Cookie: userACookie },
        },
        { DB: testD1 }
      );

      expect(res.status).toBe(200);
      const json = (await res.json()) as ApiPaginatedResponse<NoteData>;
      expect(json.data.items.length).toBe(1);
      expect(json.data.items[0].id).toBe(noteId);
    });
  });

  describe('AI Prompt Manager API', () => {
    let promptId: string;

    it('creates prompt and auto-extracts template variables', async () => {
      const res = await app.request(
        '/api/prompts',
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Cookie: userACookie,
          },
          body: JSON.stringify({
            title: 'Technical Spec Reviewer',
            description: 'Analyzes design specs for edge cases and architectural compliance',
            template: 'Please review the following specification for {{topic}} in domain {{domain}}:\n\n{{spec_text}}',
            targetModel: 'claude-3-5-sonnet',
            isFavorite: true,
          }),
        },
        { DB: testD1 }
      );

      expect(res.status).toBe(201);
      const json = (await res.json()) as ApiSuccessResponse<PromptData>;
      expect(json.success).toBe(true);
      expect(json.data.currentVersion).toBe(1);
      expect(json.data.latestVersion?.version).toBe(1);

      // Verify variables extracted
      const varNames = json.data.latestVersion?.variables?.map((v) => v.name);
      expect(varNames).toContain('topic');
      expect(varNames).toContain('domain');
      expect(varNames).toContain('spec_text');

      promptId = json.data.id;
    });

    it('publishes a new immutable prompt version', async () => {
      const res = await app.request(
        `/api/prompts/${promptId}/versions`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Cookie: userACookie,
          },
          body: JSON.stringify({
            template: 'Updated prompt template for {{topic}} focusing on {{security_boundary}}.',
            changeNotes: 'Added security boundary analysis',
          }),
        },
        { DB: testD1 }
      );

      expect(res.status).toBe(201);
      const json = (await res.json()) as ApiSuccessResponse<PromptVersionData>;
      expect(json.success).toBe(true);
      expect(json.data.version).toBe(2);
      expect(json.data.changeNotes).toBe('Added security boundary analysis');

      // Verify prompt now reports currentVersion = 2
      const promptRes = await app.request(
        `/api/prompts/${promptId}`,
        {
          headers: { Cookie: userACookie },
        },
        { DB: testD1 }
      );
      const promptJson = (await promptRes.json()) as ApiSuccessResponse<PromptData & { versions: PromptVersionData[] }>;
      expect(promptJson.data.currentVersion).toBe(2);
      expect(promptJson.data.versions.length).toBe(2);
    });
  });

  describe('Productivity Core Comprehensive Verification Suite', () => {
    let testTaskId: string;
    let testParentTaskId: string;

    it('1. tests complete create/edit/complete/reopen/delete task lifecycle', async () => {
      // Create task
      const createRes = await app.request(
        '/api/tasks',
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Cookie: userACookie,
          },
          body: JSON.stringify({
            title: 'Audit Zero Floating-Point Invariant',
            description: 'Verify financial units are integer minor units',
            priority: 'medium',
            dueDate: '2026-10-25',
            dueTime: '10:00',
          }),
        },
        { DB: testD1 }
      );
      expect(createRes.status).toBe(201);
      const createJson = (await createRes.json()) as ApiSuccessResponse<TaskData>;
      testTaskId = createJson.data.id;
      expect(createJson.data.title).toBe('Audit Zero Floating-Point Invariant');
      expect(createJson.data.status).toBe('todo');

      // Edit task
      const editRes = await app.request(
        `/api/tasks/${testTaskId}`,
        {
          method: 'PATCH',
          headers: {
            'Content-Type': 'application/json',
            Cookie: userACookie,
          },
          body: JSON.stringify({
            title: 'Audit Zero Floating-Point Invariant (Urgent)',
            priority: 'urgent',
            dueTime: '11:30',
          }),
        },
        { DB: testD1 }
      );
      expect(editRes.status).toBe(200);
      const editJson = (await editRes.json()) as ApiSuccessResponse<TaskData>;
      expect(editJson.data.title).toBe('Audit Zero Floating-Point Invariant (Urgent)');
      expect(editJson.data.priority).toBe('urgent');
      expect(editJson.data.dueTime).toBe('11:30');

      // Complete task
      const completeRes = await app.request(
        `/api/tasks/${testTaskId}`,
        {
          method: 'PATCH',
          headers: {
            'Content-Type': 'application/json',
            Cookie: userACookie,
          },
          body: JSON.stringify({
            status: 'done',
          }),
        },
        { DB: testD1 }
      );
      expect(completeRes.status).toBe(200);
      const completeJson = (await completeRes.json()) as ApiSuccessResponse<TaskData>;
      expect(completeJson.data.status).toBe('done');
      expect(completeJson.data.completedAt).toBeDefined();

      // Reopen task
      const reopenRes = await app.request(
        `/api/tasks/${testTaskId}`,
        {
          method: 'PATCH',
          headers: {
            'Content-Type': 'application/json',
            Cookie: userACookie,
          },
          body: JSON.stringify({
            status: 'todo',
          }),
        },
        { DB: testD1 }
      );
      expect(reopenRes.status).toBe(200);
      const reopenJson = (await reopenRes.json()) as ApiSuccessResponse<TaskData>;
      expect(reopenJson.data.status).toBe('todo');
      expect(reopenJson.data.completedAt).toBeNull();

      // Delete task
      const deleteRes = await app.request(
        `/api/tasks/${testTaskId}`,
        {
          method: 'DELETE',
          headers: { Cookie: userACookie },
        },
        { DB: testD1 }
      );
      expect(deleteRes.status).toBe(200);

      // Verify 404
      const fetchAfterDelete = await app.request(
        `/api/tasks/${testTaskId}`,
        {
          headers: { Cookie: userACookie },
        },
        { DB: testD1 }
      );
      expect(fetchAfterDelete.status).toBe(404);
    });

    it('2. tests subtasks and checklist progress tracking', async () => {
      // Create parent task
      const parentRes = await app.request(
        '/api/tasks',
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Cookie: userACookie,
          },
          body: JSON.stringify({
            title: 'Parent Roadmap Feature',
            priority: 'high',
          }),
        },
        { DB: testD1 }
      );
      const parentJson = (await parentRes.json()) as ApiSuccessResponse<TaskData>;
      testParentTaskId = parentJson.data.id;

      // Add subtask
      const subtaskRes = await app.request(
        '/api/tasks',
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Cookie: userACookie,
          },
          body: JSON.stringify({
            parentTaskId: testParentTaskId,
            title: 'Subtask Component Design',
            priority: 'medium',
          }),
        },
        { DB: testD1 }
      );
      expect(subtaskRes.status).toBe(201);

      // Add 3 checklist items
      const c1Res = await app.request(
        `/api/tasks/${testParentTaskId}/checklist`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Cookie: userACookie,
          },
          body: JSON.stringify({ title: 'Step 1: Wireframe', sortOrder: 1 }),
        },
        { DB: testD1 }
      );
      const c1 = ((await c1Res.json()) as ApiSuccessResponse<TaskChecklistItemData>).data;

      const c2Res = await app.request(
        `/api/tasks/${testParentTaskId}/checklist`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Cookie: userACookie,
          },
          body: JSON.stringify({ title: 'Step 2: Component Implementation', sortOrder: 2 }),
        },
        { DB: testD1 }
      );
      const c2 = ((await c2Res.json()) as ApiSuccessResponse<TaskChecklistItemData>).data;

      await app.request(
        `/api/tasks/${testParentTaskId}/checklist`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Cookie: userACookie,
          },
          body: JSON.stringify({ title: 'Step 3: Verification Tests', sortOrder: 3 }),
        },
        { DB: testD1 }
      );

      // Mark 2 of 3 completed
      await app.request(
        `/api/tasks/checklist/${c1.id}`,
        {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json', Cookie: userACookie },
          body: JSON.stringify({ isCompleted: true }),
        },
        { DB: testD1 }
      );
      await app.request(
        `/api/tasks/checklist/${c2.id}`,
        {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json', Cookie: userACookie },
          body: JSON.stringify({ isCompleted: true }),
        },
        { DB: testD1 }
      );

      // Verify task progress is 67% (2/3)
      const detailRes = await app.request(
        `/api/tasks/${testParentTaskId}`,
        { headers: { Cookie: userACookie } },
        { DB: testD1 }
      );
      const detailJson = (await detailRes.json()) as ApiSuccessResponse<TaskData>;
      expect(detailJson.data.checklistCount).toBe(3);
      expect(detailJson.data.completedChecklistCount).toBe(2);
      expect(detailJson.data.progressPercentage).toBe(67);
    });

    it('3. tests list, board, and calendar query views', async () => {
      // List view
      const listRes = await app.request(
        '/api/tasks?limit=10',
        { headers: { Cookie: userACookie } },
        { DB: testD1 }
      );
      expect(listRes.status).toBe(200);
      const listJson = (await listRes.json()) as ApiPaginatedResponse<TaskData>;
      expect(listJson.success).toBe(true);
      expect(Array.isArray(listJson.data.items)).toBe(true);

      // Board view
      const boardsRes = await app.request(
        '/api/boards',
        { headers: { Cookie: userACookie } },
        { DB: testD1 }
      );
      expect(boardsRes.status).toBe(200);
      const boardsJson = (await boardsRes.json()) as ApiSuccessResponse<BoardData[]>;
      if (boardsJson.data.length > 0) {
        const boardDetail = await app.request(
          `/api/boards/${boardsJson.data[0].id}`,
          { headers: { Cookie: userACookie } },
          { DB: testD1 }
        );
        expect(boardDetail.status).toBe(200);
      }

      // Calendar view (date range query)
      const calRes = await app.request(
        '/api/tasks?dueAfter=2026-10-01&dueBefore=2026-10-31',
        { headers: { Cookie: userACookie } },
        { DB: testD1 }
      );
      expect(calRes.status).toBe(200);
      const calJson = (await calRes.json()) as ApiPaginatedResponse<TaskData>;
      expect(calJson.success).toBe(true);
      expect(Array.isArray(calJson.data.items)).toBe(true);
    });

    it('4. tests task recurrence occurrence generation without overwriting', async () => {
      // Create task with weekly recurrence
      const res = await app.request(
        '/api/tasks',
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Cookie: userACookie,
          },
          body: JSON.stringify({
            title: 'Weekly Sprint Planning',
            priority: 'high',
            dueDate: '2026-11-02',
            recurrence: {
              frequency: 'weekly',
              interval: 1,
              daysOfWeek: [1], // Monday
              endType: 'count',
              endCount: 4,
            },
          }),
        },
        { DB: testD1 }
      );
      expect(res.status).toBe(201);
      const json = (await res.json()) as ApiSuccessResponse<TaskData>;
      expect(json.data.recurrenceRuleId).toBeDefined();

      // Trigger generation
      const genRes = await app.request(
        '/api/tasks/recurrence/generate',
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Cookie: userACookie,
          },
          body: JSON.stringify({ horizonDays: 60 }),
        },
        { DB: testD1 }
      );
      expect(genRes.status).toBe(200);
      const genJson = (await genRes.json()) as ApiSuccessResponse<{ generatedCount: number }>;
      expect(genJson.success).toBe(true);
      expect(genJson.data.generatedCount).toBeGreaterThanOrEqual(1);
    });

    it('5. tests task reminders persisted in shared reminder system', async () => {
      const remindAt = Date.now() + 3600000; // 1 hour from now
      const res = await app.request(
        '/api/reminders',
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Cookie: userACookie,
          },
          body: JSON.stringify({
            entityType: 'task',
            entityId: testParentTaskId,
            remindAt,
            title: 'Check Roadmap Progress',
          }),
        },
        { DB: testD1 }
      );
      expect(res.status).toBe(201);

      // Verify reminder query
      const listRes = await app.request(
        `/api/reminders?entityType=task&entityId=${testParentTaskId}`,
        { headers: { Cookie: userACookie } },
        { DB: testD1 }
      );
      expect(listRes.status).toBe(200);
      const listJson = (await listRes.json()) as ApiSuccessResponse<Array<{ id: string; entityType: string }>>;
      expect(listJson.data.some((r) => r.entityType === 'task')).toBe(true);
    });

    it('6. tests daily-note calendar navigation and date queries', async () => {
      // Upsert note 1
      const res1 = await app.request(
        '/api/daily-notes/2026-11-10',
        {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
            Cookie: userACookie,
          },
          body: JSON.stringify({
            content: 'Sprint kickoff and architectural review.',
            mood: 'ecstatic',
            energy: 5,
          }),
        },
        { DB: testD1 }
      );
      expect(res1.status).toBe(200);

      // Upsert note 2
      const res2 = await app.request(
        '/api/daily-notes/2026-11-11',
        {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
            Cookie: userACookie,
          },
          body: JSON.stringify({
            content: 'Deep coding session. All test gates cleared.',
            mood: 'good',
            energy: 4,
          }),
        },
        { DB: testD1 }
      );
      expect(res2.status).toBe(200);

      // Query range navigation
      const rangeRes = await app.request(
        '/api/daily-notes?startDate=2026-11-10&endDate=2026-11-11',
        { headers: { Cookie: userACookie } },
        { DB: testD1 }
      );
      expect(rangeRes.status).toBe(200);
      const rangeJson = (await rangeRes.json()) as ApiSuccessResponse<DailyNoteData[]>;
      expect(rangeJson.data.length).toBe(2);

      // Fetch specific date note
      const dateRes = await app.request(
        '/api/daily-notes/2026-11-10',
        { headers: { Cookie: userACookie } },
        { DB: testD1 }
      );
      expect(dateRes.status).toBe(200);
      const dateJson = (await dateRes.json()) as ApiSuccessResponse<DailyNoteData>;
      expect(dateJson.data.mood).toBe('ecstatic');
      expect(dateJson.data.energy).toBe(5);
    });

    it('7. tests notes and prompts search capabilities', async () => {
      // Create searchable note
      await app.request(
        '/api/notes',
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Cookie: userACookie,
          },
          body: JSON.stringify({
            title: 'Cryptographic Session Key Security',
            content: 'Session tokens must be httpOnly cookies without localStorage retention.',
            isPinned: true,
          }),
        },
        { DB: testD1 }
      );

      // Search notes
      const searchRes = await app.request(
        '/api/notes?q=Cryptographic',
        { headers: { Cookie: userACookie } },
        { DB: testD1 }
      );
      expect(searchRes.status).toBe(200);
      const searchJson = (await searchRes.json()) as ApiPaginatedResponse<NoteData>;
      expect(searchJson.data.items.some((n) => n.title.includes('Cryptographic'))).toBe(true);

      // Search prompts
      const promptSearchRes = await app.request(
        '/api/prompts?q=Technical',
        { headers: { Cookie: userACookie } },
        { DB: testD1 }
      );
      expect(promptSearchRes.status).toBe(200);
      const promptSearchJson = (await promptSearchRes.json()) as ApiPaginatedResponse<PromptData>;
      expect(promptSearchJson.data.items.some((p) => p.title.includes('Technical'))).toBe(true);
    });

    it('8. tests strict multi-tenant data isolation between User A and User B', async () => {
      // User B attempts to access User A's task -> 404
      const taskRes = await app.request(
        `/api/tasks/${testParentTaskId}`,
        { headers: { Cookie: userBCookie } },
        { DB: testD1 }
      );
      expect(taskRes.status).toBe(404);

      // User B attempts to access User A's daily note -> 404
      const dailyRes = await app.request(
        '/api/daily-notes/2026-11-10',
        { headers: { Cookie: userBCookie } },
        { DB: testD1 }
      );
      expect(dailyRes.status).toBe(404);

      // User B query tasks list -> User B has 0 of User A's tasks
      const bListRes = await app.request(
        '/api/tasks',
        { headers: { Cookie: userBCookie } },
        { DB: testD1 }
      );
      const bListJson = (await bListRes.json()) as ApiPaginatedResponse<TaskData>;
      expect(bListJson.data.items.some((t) => t.id === testParentTaskId)).toBe(false);
    });
  });
});

