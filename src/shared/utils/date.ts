/**
 * Date and Timezone Helpers
 *
 * Rules:
 * 1. All point-in-time timestamps stored as 64-bit integer UTC epoch milliseconds.
 * 2. Calendar-day entities (habits, daily logs, transaction dates) stored as ISO 'YYYY-MM-DD' strings.
 * 3. Timezone formatting uses native Intl.DateTimeFormat (edge-compatible, zero extra dependencies).
 */

export const ISO_DATE_REGEX = /^\d{4}-\d{2}-\d{2}$/;

/**
 * Validates whether a string is a strict YYYY-MM-DD calendar date.
 */
export function isValidCalendarDate(dateStr: string): boolean {
  if (!ISO_DATE_REGEX.test(dateStr)) return false;
  const [year, month, day] = dateStr.split('-').map(Number);
  if (month < 1 || month > 12) return false;
  if (day < 1 || day > 31) return false;
  // Verify with Date object
  const date = new Date(Date.UTC(year, month - 1, day));
  return (
    date.getUTCFullYear() === year &&
    date.getUTCMonth() === month - 1 &&
    date.getUTCDate() === day
  );
}

/**
 * Returns current date formatted as 'YYYY-MM-DD' in the given IANA timezone.
 */
export function getTodayCalendarDate(timeZone: string = 'UTC'): string {
  const now = new Date();
  const formatter = new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });
  return formatter.format(now);
}

/**
 * Converts a UTC timestamp (ms) to a calendar date string 'YYYY-MM-DD' in a specified timezone.
 */
export function timestampToCalendarDate(timestampMs: number, timeZone: string = 'UTC'): string {
  const date = new Date(timestampMs);
  const formatter = new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });
  return formatter.format(date);
}

/**
 * Formats a UTC timestamp into a human-readable date/time string in the specified timezone.
 */
export function formatDateTime(
  timestampMs: number,
  timeZone: string = 'UTC',
  locale: string = 'en-US'
): string {
  return new Intl.DateTimeFormat(locale, {
    timeZone,
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  }).format(new Date(timestampMs));
}

/**
 * Formats a calendar date 'YYYY-MM-DD' into a localized readable date.
 */
export function formatCalendarDate(
  calendarDate: string,
  locale: string = 'en-US'
): string {
  if (!isValidCalendarDate(calendarDate)) {
    return calendarDate;
  }
  const [year, month, day] = calendarDate.split('-').map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  return new Intl.DateTimeFormat(locale, {
    timeZone: 'UTC',
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  }).format(date);
}

/**
 * Adds or subtracts days to an ISO YYYY-MM-DD calendar date.
 */
export function shiftCalendarDate(calendarDate: string, days: number): string {
  if (!isValidCalendarDate(calendarDate)) {
    throw new Error(`Invalid calendar date: "${calendarDate}"`);
  }
  const [year, month, day] = calendarDate.split('-').map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  date.setUTCDate(date.getUTCDate() + days);
  const y = date.getUTCFullYear();
  const m = String(date.getUTCMonth() + 1).padStart(2, '0');
  const d = String(date.getUTCDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}
