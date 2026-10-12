import { describe, expect, it } from "vitest";
import { monthlySeries, percentChange, periodRange, summarize } from "@/lib/calc/metrics";
import { isTaskOverdue, projectProgress, taskCompletion } from "@/lib/calc/progress";

const d = (s: string) => new Date(`${s}T00:00:00Z`);

describe("financial summaries", () => {
  const txns = [
    { amount: 100000, type: "INCOME", date: d("2026-10-05") },
    { amount: 30000, type: "EXPENSE", date: d("2026-10-06") },
    { amount: 50000, type: "INCOME", date: d("2026-09-05") },
    { amount: 10000, type: "EXPENSE", date: d("2026-09-20") },
  ];
  it("sums income, expenses and net", () => {
    expect(summarize(txns)).toEqual({ income: 150000, expense: 40000, net: 110000, count: 4 });
  });
  it("respects inclusive date ranges", () => {
    expect(summarize(txns, { from: "2026-10-01", to: "2026-10-05" })).toEqual({ income: 100000, expense: 0, net: 100000, count: 1 });
  });
  it("builds a monthly series ending with the current month", () => {
    const s = monthlySeries(txns, "2026-10-12", 3);
    expect(s.map((p) => p.month)).toEqual(["2026-08", "2026-09", "2026-10"]);
    expect(s[1]).toMatchObject({ income: 50000, expense: 10000, net: 40000 });
    expect(s[0]).toMatchObject({ income: 0, expense: 0 });
  });
});

describe("percentChange", () => {
  it("returns null without a valid comparison base", () => {
    expect(percentChange(100, 0)).toBeNull();
    expect(percentChange(100, null)).toBeNull();
  });
  it("computes rounded change", () => {
    expect(percentChange(150, 100)).toBe(50);
    expect(percentChange(50, 100)).toBe(-50);
    expect(percentChange(1, 3)).toBe(-66.7);
  });
});

describe("periodRange", () => {
  it("compares month-to-date with the same days of the previous month", () => {
    const r = periodRange("month", "2026-10-12");
    expect(r.current).toEqual({ from: "2026-10-01", to: "2026-10-12" });
    expect(r.previous).toEqual({ from: "2026-09-01", to: "2026-09-12" });
  });
  it("caps the previous range at the end of a shorter month", () => {
    const r = periodRange("month", "2026-03-31");
    expect(r.previous).toEqual({ from: "2026-02-01", to: "2026-02-28" });
  });
  it("has no comparison for all time", () => {
    expect(periodRange("all", "2026-10-12")).toEqual({ current: null, previous: null });
  });
  it("uses rolling 30 days", () => {
    const r = periodRange("30d", "2026-10-30");
    expect(r.current).toEqual({ from: "2026-10-01", to: "2026-10-30" });
    expect(r.previous).toEqual({ from: "2026-09-01", to: "2026-09-30" });
  });
});

describe("project progress", () => {
  const tasks = [{ status: "DONE" }, { status: "DONE" }, { status: "TODO" }, { status: "IN_PROGRESS" }];
  it("calculates from task completion in AUTO mode", () => {
    expect(projectProgress({ progressMode: "AUTO", manualProgress: 90 }, tasks)).toEqual({ value: 50, source: "tasks", done: 2, total: 4 });
  });
  it("uses manual value in MANUAL mode", () => {
    expect(projectProgress({ progressMode: "MANUAL", manualProgress: 35 }, tasks).value).toBe(35);
    expect(projectProgress({ progressMode: "MANUAL", manualProgress: 35 }, tasks).source).toBe("manual");
  });
  it("reports 'none' when there are no tasks", () => {
    expect(projectProgress({ progressMode: "AUTO", manualProgress: 0, status: "ACTIVE" }, []).source).toBe("none");
  });
  it("counts completion", () => {
    expect(taskCompletion(tasks)).toEqual({ total: 4, done: 2, percent: 50 });
  });
  it("flags overdue tasks only when not done", () => {
    expect(isTaskOverdue({ status: "TODO", dueDate: d("2026-10-01") }, "2026-10-12")).toBe(true);
    expect(isTaskOverdue({ status: "DONE", dueDate: d("2026-10-01") }, "2026-10-12")).toBe(false);
    expect(isTaskOverdue({ status: "TODO", dueDate: d("2026-10-12") }, "2026-10-12")).toBe(false);
  });
});
