import { describe, it, expect } from 'vitest';
import { isTargetDayForHabit, calculateHabitStats } from '../src/server/services/habitStreakService';

describe('Habit Streaks & Analytics Unit Tests', () => {
  describe('isTargetDayForHabit', () => {
    it('treats every day as a target day for daily habits', () => {
      const habit = {
        id: 'hab_1',
        frequencyType: 'daily',
        targetDaysPerWeek: 7,
      };

      expect(isTargetDayForHabit('2026-10-01', habit)).toBe(true);
      expect(isTargetDayForHabit('2026-10-02', habit)).toBe(true);
      expect(isTargetDayForHabit('2026-10-03', habit)).toBe(true);
      expect(isTargetDayForHabit('2026-10-04', habit)).toBe(true);
    });

    it('identifies target days correctly for custom weekday habits', () => {
      // 2026-10-05 is Monday (day 1), 2026-10-10 is Saturday (day 6), 2026-10-11 is Sunday (day 0)
      const weekdayHabit = {
        id: 'hab_2',
        frequencyType: 'custom_days',
        targetDaysPerWeek: 5,
        targetDaysOfWeek: [1, 2, 3, 4, 5], // Mon to Fri
      };

      expect(isTargetDayForHabit('2026-10-05', weekdayHabit)).toBe(true); // Monday
      expect(isTargetDayForHabit('2026-10-09', weekdayHabit)).toBe(true); // Friday
      expect(isTargetDayForHabit('2026-10-10', weekdayHabit)).toBe(false); // Saturday
      expect(isTargetDayForHabit('2026-10-11', weekdayHabit)).toBe(false); // Sunday
    });
  });

  describe('calculateHabitStats', () => {
    const dailyHabit = {
      id: 'hab_daily',
      frequencyType: 'daily',
      targetDaysPerWeek: 7,
    };

    it('calculates current streak when today is completed', () => {
      const today = '2026-10-05';
      const logs = [
        { date: '2026-10-05', completed: 1 },
        { date: '2026-10-04', completed: 1 },
        { date: '2026-10-03', completed: 1 },
        { date: '2026-10-01', completed: 1 }, // Gap on 2026-10-02
      ];

      const stats = calculateHabitStats(dailyHabit, logs, today);
      expect(stats.currentStreak).toBe(3);
      expect(stats.longestStreak).toBe(3);
      expect(stats.totalCompletions).toBe(4);
    });

    it('keeps streak alive if today is not yet completed but yesterday was completed', () => {
      const today = '2026-10-05';
      const logs = [
        // Today (2026-10-05) not logged yet
        { date: '2026-10-04', completed: 1 },
        { date: '2026-10-03', completed: 1 },
        { date: '2026-10-02', completed: 1 },
      ];

      const stats = calculateHabitStats(dailyHabit, logs, today);
      expect(stats.currentStreak).toBe(3);
    });

    it('resets current streak to 0 if both today and yesterday were missed', () => {
      const today = '2026-10-05';
      const logs = [
        { date: '2026-10-03', completed: 1 },
        { date: '2026-10-02', completed: 1 },
      ];

      const stats = calculateHabitStats(dailyHabit, logs, today);
      expect(stats.currentStreak).toBe(0);
      expect(stats.longestStreak).toBe(2);
    });

    it('does not break weekday habit streak over the weekend', () => {
      const weekdayHabit = {
        id: 'hab_wd',
        frequencyType: 'custom_days',
        targetDaysPerWeek: 5,
        targetDaysOfWeek: [1, 2, 3, 4, 5], // Mon-Fri
      };

      // 2026-10-09 is Friday, 10-10 is Sat, 10-11 is Sun, 10-12 is Monday
      const today = '2026-10-12';
      const logs = [
        { date: '2026-10-12', completed: 1 }, // Monday
        { date: '2026-10-09', completed: 1 }, // Friday
        { date: '2026-10-08', completed: 1 }, // Thursday
      ];

      const stats = calculateHabitStats(weekdayHabit, logs, today);
      expect(stats.currentStreak).toBe(3);
    });

    it('generates heatmap array matching requested days', () => {
      const today = '2026-10-10';
      const logs = [{ date: '2026-10-10', completed: 1 }];

      const stats = calculateHabitStats(dailyHabit, logs, today, 30);
      expect(stats.heatmap).toHaveLength(30);
      expect(stats.heatmap[29].date).toBe('2026-10-10');
      expect(stats.heatmap[29].completed).toBe(true);
      expect(stats.heatmap[28].completed).toBe(false);
    });
  });
});
