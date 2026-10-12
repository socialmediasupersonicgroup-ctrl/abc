import { addMonths, format, parseISO, startOfMonth, startOfQuarter, startOfYear, subDays } from "date-fns";
import { addDaysToKey, daysBetweenKeys } from "@/lib/dates";

export type Txn = { amount: number; type: string; date: Date };

export type Period = "month" | "quarter" | "year" | "30d" | "all";

export const PERIODS: { value: Period; label: string }[] = [
  { value: "month", label: "This month" },
  { value: "30d", label: "Last 30 days" },
  { value: "quarter", label: "This quarter" },
  { value: "year", label: "This year" },
  { value: "all", label: "All time" },
];

export type DateRange = { from: string; to: string }; // inclusive keys

/** Range for a period ending today plus the immediately preceding range of equal span (for comparisons). */
export function periodRange(period: Period, today: string): { current: DateRange | null; previous: DateRange | null } {
  const t = parseISO(today);
  const k = (d: Date) => format(d, "yyyy-MM-dd");
  if (period === "all") return { current: null, previous: null };
  if (period === "30d") {
    const from = k(subDays(t, 29));
    return { current: { from, to: today }, previous: { from: addDaysToKey(from, -30), to: addDaysToKey(from, -1) } };
  }
  const start = period === "month" ? startOfMonth(t) : period === "quarter" ? startOfQuarter(t) : startOfYear(t);
  const months = period === "month" ? 1 : period === "quarter" ? 3 : 12;
  const from = k(start);
  const prevStart = addMonths(start, -months);
  // Compare against the same number of elapsed days in the previous period (month-to-date vs prior month-to-date).
  const elapsed = daysBetweenKeys(from, today);
  const prevFrom = k(prevStart);
  const prevEndCap = addDaysToKey(from, -1);
  const prevTo = addDaysToKey(prevFrom, elapsed) < prevEndCap ? addDaysToKey(prevFrom, elapsed) : prevEndCap;
  return { current: { from, to: today }, previous: { from: prevFrom, to: prevTo } };
}

export function inRange(date: Date, range: DateRange | null) {
  if (!range) return true;
  const key = date.toISOString().slice(0, 10);
  return key >= range.from && key <= range.to;
}

export function summarize(txns: Txn[], range: DateRange | null = null) {
  let income = 0;
  let expense = 0;
  let count = 0;
  for (const t of txns) {
    if (!inRange(t.date, range)) continue;
    count++;
    if (t.type === "INCOME") income += t.amount;
    else if (t.type === "EXPENSE") expense += t.amount;
  }
  return { income, expense, net: income - expense, count };
}

/**
 * Percentage change, or null when there is no valid comparison base
 * (we never present growth figures against an empty prior period).
 */
export function percentChange(current: number, previous: number | null | undefined): number | null {
  if (previous == null || previous === 0) return null;
  return Math.round(((current - previous) / Math.abs(previous)) * 1000) / 10;
}

export type MonthPoint = { month: string; label: string; income: number; expense: number; net: number };

/** Monthly income / expense series covering `months` calendar months ending with the month of `today`. */
export function monthlySeries(txns: Txn[], today: string, months: number): MonthPoint[] {
  const end = startOfMonth(parseISO(today));
  const points: MonthPoint[] = [];
  const index = new Map<string, MonthPoint>();
  for (let i = months - 1; i >= 0; i--) {
    const m = addMonths(end, -i);
    const key = format(m, "yyyy-MM");
    const point = { month: key, label: format(m, "MMM yy"), income: 0, expense: 0, net: 0 };
    points.push(point);
    index.set(key, point);
  }
  for (const t of txns) {
    const p = index.get(t.date.toISOString().slice(0, 7));
    if (!p) continue;
    if (t.type === "INCOME") p.income += t.amount;
    else p.expense += t.amount;
  }
  for (const p of points) p.net = p.income - p.expense;
  return points;
}

/** Monthly series spanning the data's own range, used by analytics with an explicit range. */
export function monthsInRange(range: DateRange): number {
  const from = parseISO(range.from);
  const to = parseISO(range.to);
  return (to.getFullYear() - from.getFullYear()) * 12 + (to.getMonth() - from.getMonth()) + 1;
}
