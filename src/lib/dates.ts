import { addDays, differenceInCalendarDays, parseISO } from "date-fns";
import { formatInTimeZone, fromZonedTime } from "date-fns-tz";

/**
 * Date conventions
 * - "Date-only" fields (due dates, invoice dates, transaction dates, follow-ups) are stored as
 *   UTC midnight and always read/written as "yyyy-MM-dd" keys, so they never shift across time zones.
 * - Date-time fields (calendar events, content schedules) are real instants. They are entered and
 *   displayed in the workspace time zone.
 */

export const DEFAULT_TZ = "Asia/Kolkata";

export function isDateKey(value: string) {
  return /^\d{4}-\d{2}-\d{2}$/.test(value) && !Number.isNaN(Date.parse(`${value}T00:00:00Z`));
}

/** "2026-10-12" -> Date at 2026-10-12T00:00:00Z */
export function keyToDate(key: string): Date {
  return new Date(`${key}T00:00:00.000Z`);
}

/** Date-only value -> "yyyy-MM-dd" */
export function dateToKey(date: Date): string {
  return date.toISOString().slice(0, 10);
}

/** Today's calendar date in the given zone as "yyyy-MM-dd". */
export function todayKey(tz = DEFAULT_TZ, now = new Date()): string {
  return formatInTimeZone(now, tz, "yyyy-MM-dd");
}

/** Calendar day of an instant, in the given zone. */
export function instantToKey(date: Date, tz = DEFAULT_TZ): string {
  return formatInTimeZone(date, tz, "yyyy-MM-dd");
}

export function addDaysToKey(key: string, days: number): string {
  return dateToKey(addDays(keyToDate(key), days));
}

export function daysBetweenKeys(fromKey: string, toKey: string): number {
  return differenceInCalendarDays(parseISO(toKey), parseISO(fromKey));
}

const DATE_FMT = new Intl.DateTimeFormat("en-IN", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" });
const DATE_SHORT_FMT = new Intl.DateTimeFormat("en-IN", { day: "numeric", month: "short", timeZone: "UTC" });

/** Formats a date-only value: "12 Oct 2026". */
export function formatDate(date: Date | string | null | undefined): string {
  if (!date) return "—";
  const d = typeof date === "string" ? (isDateKey(date) ? keyToDate(date) : new Date(date)) : date;
  return DATE_FMT.format(d);
}

export function formatDateShort(date: Date | string | null | undefined): string {
  if (!date) return "—";
  const d = typeof date === "string" ? (isDateKey(date) ? keyToDate(date) : new Date(date)) : date;
  return DATE_SHORT_FMT.format(d);
}

/** Formats an instant in the workspace zone. */
export function formatDateTime(date: Date | string, tz = DEFAULT_TZ, pattern = "d MMM yyyy, h:mm a"): string {
  return formatInTimeZone(typeof date === "string" ? new Date(date) : date, tz, pattern);
}

export function formatTime(date: Date | string, tz = DEFAULT_TZ): string {
  return formatInTimeZone(typeof date === "string" ? new Date(date) : date, tz, "h:mm a");
}

/** "2026-10-12T14:30" interpreted in tz -> UTC Date */
export function zonedInputToDate(value: string, tz = DEFAULT_TZ): Date | null {
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(value)) return null;
  const d = fromZonedTime(value, tz);
  return Number.isNaN(d.getTime()) ? null : d;
}

/** UTC Date -> "2026-10-12T14:30" in tz for <input type="datetime-local"> */
export function dateToZonedInput(date: Date | string, tz = DEFAULT_TZ): string {
  return formatInTimeZone(typeof date === "string" ? new Date(date) : date, tz, "yyyy-MM-dd'T'HH:mm");
}

/** Start of a calendar day in tz as a UTC instant. */
export function zonedDayStart(key: string, tz = DEFAULT_TZ): Date {
  return fromZonedTime(`${key}T00:00:00`, tz);
}

/** Human relative description of a due date relative to today. */
export function relativeDue(dueKey: string, today: string): { label: string; tone: "overdue" | "today" | "soon" | "later" } {
  const diff = daysBetweenKeys(today, dueKey);
  if (diff < 0) return { label: diff === -1 ? "Yesterday" : `${Math.abs(diff)}d overdue`, tone: "overdue" };
  if (diff === 0) return { label: "Today", tone: "today" };
  if (diff === 1) return { label: "Tomorrow", tone: "soon" };
  if (diff <= 7) return { label: `In ${diff} days`, tone: "soon" };
  return { label: formatDateShort(dueKey), tone: "later" };
}

export function monthKey(key: string) {
  return key.slice(0, 7);
}

export const TIMEZONES = [
  "Asia/Kolkata",
  "Asia/Dubai",
  "Asia/Singapore",
  "Asia/Tokyo",
  "Europe/London",
  "Europe/Berlin",
  "America/New_York",
  "America/Chicago",
  "America/Los_Angeles",
  "Australia/Sydney",
  "UTC",
];
