import { describe, it, expect } from 'vitest';
import {
  isValidCalendarDate,
  timestampToCalendarDate,
  formatCalendarDate,
  shiftCalendarDate,
} from '../src/shared/utils/date';

describe('Date & Timezone Utilities', () => {
  describe('isValidCalendarDate', () => {
    it('validates correct YYYY-MM-DD calendar dates', () => {
      expect(isValidCalendarDate('2026-01-01')).toBe(true);
      expect(isValidCalendarDate('2026-12-31')).toBe(true);
      expect(isValidCalendarDate('2024-02-29')).toBe(true); // Leap year
    });

    it('rejects invalid calendar dates', () => {
      expect(isValidCalendarDate('2026-02-29')).toBe(false); // Non-leap year
      expect(isValidCalendarDate('2026-13-01')).toBe(false);
      expect(isValidCalendarDate('2026-00-10')).toBe(false);
      expect(isValidCalendarDate('2026-04-31')).toBe(false); // April has 30 days
      expect(isValidCalendarDate('invalid-date')).toBe(false);
      expect(isValidCalendarDate('01-01-2026')).toBe(false);
    });
  });

  describe('timestampToCalendarDate', () => {
    it('converts UTC epoch milliseconds to YYYY-MM-DD in UTC', () => {
      // 2026-09-26T12:00:00Z
      const timestamp = Date.UTC(2026, 8, 26, 12, 0, 0);
      expect(timestampToCalendarDate(timestamp, 'UTC')).toBe('2026-09-26');
    });

    it('respects timezone offsets correctly', () => {
      // 2026-09-26 01:00:00 UTC is still 2026-09-25 in America/New_York (UTC-4)
      const timestamp = Date.UTC(2026, 8, 26, 1, 0, 0);
      expect(timestampToCalendarDate(timestamp, 'America/New_York')).toBe('2026-09-25');
      // But in Asia/Tokyo (UTC+9), it is 2026-09-26 10:00
      expect(timestampToCalendarDate(timestamp, 'Asia/Tokyo')).toBe('2026-09-26');
    });
  });

  describe('formatCalendarDate', () => {
    it('formats YYYY-MM-DD safely without timezone shifts', () => {
      const formatted = formatCalendarDate('2026-09-26', 'en-US');
      expect(formatted).toContain('Sep');
      expect(formatted).toContain('26');
      expect(formatted).toContain('2026');
    });
  });

  describe('shiftCalendarDate', () => {
    it('adds and subtracts days across month and year boundaries', () => {
      expect(shiftCalendarDate('2026-01-01', 5)).toBe('2026-01-06');
      expect(shiftCalendarDate('2026-01-01', -1)).toBe('2025-12-31');
      expect(shiftCalendarDate('2024-02-28', 1)).toBe('2024-02-29'); // Leap day
      expect(shiftCalendarDate('2024-02-28', 2)).toBe('2024-03-01');
    });

    it('throws error for invalid date input', () => {
      expect(() => shiftCalendarDate('invalid', 1)).toThrow();
    });
  });
});
