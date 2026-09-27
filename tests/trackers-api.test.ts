import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import app from '../src/server/index';
import { createTestDatabase } from './test-db';
import type {
  ApiSuccessResponse,
  HabitData,
  HabitLogData,
  TrackerData,
  TrackerEntryData,
  WorkoutData,
  WorkoutExerciseData,
  GoalData,
  GoalMilestoneData,
} from '../src/shared/types';

describe('Trackers, Habits, Fitness & Goals API Suite', () => {
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
          name: 'Tracker User A',
          email: 'trackera@example.com',
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
          email: 'trackerb@example.com',
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
          name: 'Tracker User B',
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

  describe('Habits & Streaks API', () => {
    let habitId: string;
    const testDate = '2026-10-15';

    it('creates a habit with target configuration', async () => {
      const res = await app.request(
        '/api/habits',
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Cookie: userACookie,
          },
          body: JSON.stringify({
            name: 'Morning Meditation',
            description: '15 minutes of mindfulness practice',
            frequencyType: 'daily',
            targetDaysPerWeek: 7,
            color: '#10b981',
            icon: 'sun',
          }),
        },
        { DB: testD1 }
      );

      expect(res.status).toBe(201);
      const json = (await res.json()) as ApiSuccessResponse<HabitData>;
      expect(json.success).toBe(true);
      expect(json.data.name).toBe('Morning Meditation');
      expect(json.data.frequencyType).toBe('daily');
      expect(json.data.currentStreak).toBe(0);

      habitId = json.data.id;
    });

    it('logs habit completion for a specific calendar date', async () => {
      const res = await app.request(
        `/api/habits/${habitId}/logs/${testDate}`,
        {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
            Cookie: userACookie,
          },
          body: JSON.stringify({
            completed: true,
            notes: 'Deep focused session',
          }),
        },
        { DB: testD1 }
      );

      expect(res.status).toBe(200);
      const json = (await res.json()) as ApiSuccessResponse<HabitLogData>;
      expect(json.success).toBe(true);
      expect(json.data.date).toBe(testDate);
      expect(json.data.completed).toBe(true);
      expect(json.data.notes).toBe('Deep focused session');
    });

    it('fetches habit detail with streak stats and heatmap', async () => {
      const res = await app.request(
        `/api/habits/${habitId}`,
        {
          headers: { Cookie: userACookie },
        },
        { DB: testD1 }
      );

      expect(res.status).toBe(200);
      const json = (await res.json()) as ApiSuccessResponse<HabitData & { stats: unknown }>;
      expect(json.success).toBe(true);
      expect(json.data.stats).toBeDefined();
    });

    it('enforces user isolation: User B cannot access User A habit', async () => {
      const res = await app.request(
        `/api/habits/${habitId}`,
        {
          headers: { Cookie: userBCookie },
        },
        { DB: testD1 }
      );

      expect(res.status).toBe(404);
    });
  });

  describe('Flexible Trackers API', () => {
    let trackerId: string;

    it('creates a custom metric tracker', async () => {
      const res = await app.request(
        '/api/trackers',
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Cookie: userACookie,
          },
          body: JSON.stringify({
            name: 'Daily Water Intake',
            type: 'numeric',
            unit: 'ml',
            targetValue: 2500,
            targetPeriod: 'daily',
            color: '#3b82f6',
            icon: 'droplet',
          }),
        },
        { DB: testD1 }
      );

      expect(res.status).toBe(201);
      const json = (await res.json()) as ApiSuccessResponse<TrackerData>;
      expect(json.success).toBe(true);
      expect(json.data.name).toBe('Daily Water Intake');
      expect(json.data.unit).toBe('ml');
      expect(json.data.targetValue).toBe(2500);

      trackerId = json.data.id;
    });

    it('logs tracker data point and calculates rollup stats', async () => {
      const res1 = await app.request(
        `/api/trackers/${trackerId}/entries`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Cookie: userACookie,
          },
          body: JSON.stringify({
            date: '2026-10-15',
            value: 2800,
            notes: 'Exceeded target hydration',
          }),
        },
        { DB: testD1 }
      );

      expect(res1.status).toBe(201);
      const json1 = (await res1.json()) as ApiSuccessResponse<TrackerEntryData>;
      expect(json1.success).toBe(true);
      expect(json1.data.value).toBe(2800);

      // Verify list endpoint reflects latest value
      const listRes = await app.request(
        '/api/trackers',
        {
          headers: { Cookie: userACookie },
        },
        { DB: testD1 }
      );
      expect(listRes.status).toBe(200);
      const listJson = (await listRes.json()) as ApiSuccessResponse<TrackerData[]>;
      const match = listJson.data.find((t) => t.id === trackerId);
      expect(match).toBeDefined();
      expect(match?.latestValue).toBe(2800);
      expect(match?.entryCount).toBe(1);
    });

    it('enforces isolation: User B cannot access User A tracker', async () => {
      const res = await app.request(
        `/api/trackers/${trackerId}`,
        {
          headers: { Cookie: userBCookie },
        },
        { DB: testD1 }
      );

      expect(res.status).toBe(404);
    });
  });

  describe('Fitness & Workouts API', () => {
    let workoutId: string;

    it('creates a workout with exercises and structured sets', async () => {
      const res = await app.request(
        '/api/workouts',
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Cookie: userACookie,
          },
          body: JSON.stringify({
            name: 'Push Day - Hypertrophy',
            type: 'strength',
            date: '2026-10-16',
            durationMinutes: 65,
            caloriesBurned: 420,
            notes: 'Solid chest and shoulder session',
            exercises: [
              {
                exerciseName: 'Barbell Bench Press',
                sortOrder: 0,
                sets: [
                  { setNumber: 1, reps: 10, weightKg: 80, rpe: 7 },
                  { setNumber: 2, reps: 8, weightKg: 90, rpe: 8 },
                  { setNumber: 3, reps: 6, weightKg: 95, rpe: 9 },
                ],
              },
            ],
          }),
        },
        { DB: testD1 }
      );

      expect(res.status).toBe(201);
      const json = (await res.json()) as ApiSuccessResponse<WorkoutData>;
      expect(json.success).toBe(true);
      expect(json.data.name).toBe('Push Day - Hypertrophy');
      expect(json.data.exerciseCount).toBe(1);
      expect(json.data.exercises?.[0].sets).toHaveLength(3);

      workoutId = json.data.id;
    });

    it('adds an extra exercise to the workout', async () => {
      const res = await app.request(
        `/api/workouts/${workoutId}/exercises`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Cookie: userACookie,
          },
          body: JSON.stringify({
            exerciseName: 'Overhead Dumbbell Press',
            sortOrder: 1,
            sets: [
              { setNumber: 1, reps: 12, weightKg: 24, rpe: 8 },
              { setNumber: 2, reps: 10, weightKg: 26, rpe: 9 },
            ],
          }),
        },
        { DB: testD1 }
      );

      expect(res.status).toBe(201);
      const json = (await res.json()) as ApiSuccessResponse<WorkoutExerciseData>;
      expect(json.success).toBe(true);
      expect(json.data.exerciseName).toBe('Overhead Dumbbell Press');
      expect(json.data.sets).toHaveLength(2);
    });

    it('enforces isolation: User B cannot access User A workout', async () => {
      const res = await app.request(
        `/api/workouts/${workoutId}`,
        {
          headers: { Cookie: userBCookie },
        },
        { DB: testD1 }
      );

      expect(res.status).toBe(404);
    });
  });

  describe('Goals & Milestones API', () => {
    let goalId: string;
    let milestone1Id: string;
    let milestone2Id: string;

    it('creates a strategic goal with milestones', async () => {
      const res = await app.request(
        '/api/goals',
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Cookie: userACookie,
          },
          body: JSON.stringify({
            title: 'Achieve Financial Independence Phase 1',
            description: 'Build emergency reserve and deploy passive index portfolio',
            targetDate: '2027-12-31',
            status: 'not_started',
            color: '#8b5cf6',
            milestones: [
              { title: 'Save 6 months living expenses', targetValue: 30000, currentValue: 15000, unit: 'USD', sortOrder: 0 },
              { title: 'Establish core ETF index allocation', targetValue: 50000, currentValue: 0, unit: 'USD', sortOrder: 1 },
            ],
          }),
        },
        { DB: testD1 }
      );

      expect(res.status).toBe(201);
      const json = (await res.json()) as ApiSuccessResponse<GoalData>;
      expect(json.success).toBe(true);
      expect(json.data.title).toBe('Achieve Financial Independence Phase 1');
      expect(json.data.milestoneCount).toBe(2);
      expect(json.data.progressPercentage).toBe(0);

      goalId = json.data.id;
      milestone1Id = json.data.milestones?.[0].id || '';
      milestone2Id = json.data.milestones?.[1].id || '';
    });

    it('updates milestone completion and recalculates goal progress percentage', async () => {
      // Complete milestone 1: 1 of 2 = 50%
      const res1 = await app.request(
        `/api/goals/milestones/${milestone1Id}`,
        {
          method: 'PATCH',
          headers: {
            'Content-Type': 'application/json',
            Cookie: userACookie,
          },
          body: JSON.stringify({
            isCompleted: true,
            currentValue: 30000,
          }),
        },
        { DB: testD1 }
      );

      expect(res1.status).toBe(200);
      const json1 = (await res1.json()) as ApiSuccessResponse<GoalMilestoneData>;
      expect(json1.data.isCompleted).toBe(true);

      // Verify goal progress is now 50% and status is in_progress
      const goalRes1 = await app.request(
        `/api/goals/${goalId}`,
        {
          headers: { Cookie: userACookie },
        },
        { DB: testD1 }
      );
      const goalJson1 = (await goalRes1.json()) as ApiSuccessResponse<GoalData>;
      expect(goalJson1.data.progressPercentage).toBe(50);
      expect(goalJson1.data.status).toBe('in_progress');

      // Complete milestone 2: 2 of 2 = 100% and status completed
      const res2 = await app.request(
        `/api/goals/milestones/${milestone2Id}`,
        {
          method: 'PATCH',
          headers: {
            'Content-Type': 'application/json',
            Cookie: userACookie,
          },
          body: JSON.stringify({
            isCompleted: true,
            currentValue: 50000,
          }),
        },
        { DB: testD1 }
      );
      expect(res2.status).toBe(200);

      const goalRes2 = await app.request(
        `/api/goals/${goalId}`,
        {
          headers: { Cookie: userACookie },
        },
        { DB: testD1 }
      );
      const goalJson2 = (await goalRes2.json()) as ApiSuccessResponse<GoalData>;
      expect(goalJson2.data.progressPercentage).toBe(100);
      expect(goalJson2.data.status).toBe('completed');
    });

    it('enforces isolation: User B cannot access User A goal', async () => {
      const res = await app.request(
        `/api/goals/${goalId}`,
        {
          headers: { Cookie: userBCookie },
        },
        { DB: testD1 }
      );

      expect(res.status).toBe(404);
    });
  });
});
