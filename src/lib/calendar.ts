import { addDays, addMonths, format, parseISO, startOfMonth, startOfWeek } from "date-fns";
import { addDaysToKey, isDateKey } from "@/lib/dates";

export type CalendarView = "month" | "week" | "agenda";

/** Visible day keys for a view anchored on `anchor` (a yyyy-MM-dd key). */
export function visibleRange(view: CalendarView, anchor: string, weekStartsOn: 0 | 1) {
  const a = parseISO(anchor);
  const k = (d: Date) => format(d, "yyyy-MM-dd");
  if (view === "month") {
    const first = startOfWeek(startOfMonth(a), { weekStartsOn });
    return { from: k(first), to: k(addDays(first, 41)), days: 42 };
  }
  if (view === "week") {
    const first = startOfWeek(a, { weekStartsOn });
    return { from: k(first), to: k(addDays(first, 6)), days: 7 };
  }
  return { from: anchor, to: addDaysToKey(anchor, 29), days: 30 };
}

export function shiftAnchor(view: CalendarView, anchor: string, dir: 1 | -1) {
  const a = parseISO(anchor);
  if (view === "month") return format(addMonths(startOfMonth(a), dir), "yyyy-MM-dd");
  if (view === "week") return format(addDays(a, 7 * dir), "yyyy-MM-dd");
  return format(addDays(a, 30 * dir), "yyyy-MM-dd");
}

export function safeAnchor(value: string, today: string) {
  return isDateKey(value) ? value : today;
}
