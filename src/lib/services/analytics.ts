import { addMonths, format, parseISO, startOfMonth } from "date-fns";
import { prisma } from "@/lib/db";
import { keyToDate, addDaysToKey } from "@/lib/dates";
import { summarize, type DateRange } from "@/lib/calc/metrics";
import { projectProgress } from "@/lib/calc/progress";
import { effectiveInvoiceStatus, invoiceBalance } from "@/lib/calc/invoice";
import type { Db } from "./shared";

function monthBuckets(range: DateRange) {
  const buckets: { key: string; label: string }[] = [];
  let m = startOfMonth(parseISO(range.from));
  const end = startOfMonth(parseISO(range.to));
  while (m <= end && buckets.length < 60) {
    buckets.push({ key: format(m, "yyyy-MM"), label: format(m, "MMM yy") });
    m = addMonths(m, 1);
  }
  return buckets;
}

const monthOf = (d: Date) => d.toISOString().slice(0, 7);

export async function getAnalytics(workspaceId: string, range: DateRange, today: string, db: Db = prisma) {
  const from = keyToDate(range.from);
  const toExclusive = keyToDate(addDaysToKey(range.to, 1));
  const buckets = monthBuckets(range);

  const [txns, invoices, projects, tasksCreated, tasksCompleted, customersBefore, customersInRange, content] = await Promise.all([
    db.transaction.findMany({ where: { workspaceId, date: { gte: from, lt: toExclusive } }, select: { amount: true, type: true, date: true, category: true } }),
    db.invoice.findMany({
      where: { workspaceId, issueDate: { gte: from, lt: toExclusive } },
      select: { status: true, total: true, amountPaid: true, dueDate: true },
    }),
    db.project.findMany({
      where: { workspaceId, status: { in: ["PLANNING", "ACTIVE", "ON_HOLD"] } },
      select: { id: true, name: true, status: true, progressMode: true, manualProgress: true, dueDate: true, tasks: { select: { status: true } } },
      orderBy: { dueDate: { sort: "asc", nulls: "last" } },
      take: 12,
    }),
    db.task.findMany({ where: { workspaceId, createdAt: { gte: from, lt: toExclusive } }, select: { createdAt: true } }),
    db.task.findMany({ where: { workspaceId, completedAt: { gte: from, lt: toExclusive } }, select: { completedAt: true } }),
    db.customer.count({ where: { workspaceId, createdAt: { lt: from } } }),
    db.customer.findMany({ where: { workspaceId, createdAt: { gte: from, lt: toExclusive } }, select: { createdAt: true, status: true } }),
    db.contentItem.findMany({ where: { workspaceId }, select: { status: true, scheduledAt: true, platform: true } }),
  ]);

  // Finance by month
  const finance = buckets.map((b) => ({ ...b, income: 0, expense: 0, net: 0 }));
  const fIndex = new Map(finance.map((f) => [f.key, f]));
  const expenseByCategory = new Map<string, number>();
  const incomeByCategory = new Map<string, number>();
  for (const t of txns) {
    const f = fIndex.get(monthOf(t.date));
    if (f) {
      if (t.type === "INCOME") f.income += t.amount;
      else f.expense += t.amount;
    }
    const map = t.type === "INCOME" ? incomeByCategory : expenseByCategory;
    map.set(t.category, (map.get(t.category) ?? 0) + t.amount);
  }
  let cumulative = 0;
  const financeSeries = finance.map((f) => {
    f.net = f.income - f.expense;
    cumulative += f.net;
    return { ...f, cumulative };
  });
  const totals = summarize(txns);

  // Tasks
  const taskSeries = buckets.map((b) => ({ ...b, created: 0, completed: 0 }));
  const tIndex = new Map(taskSeries.map((t) => [t.key, t]));
  for (const t of tasksCreated) {
    const b = tIndex.get(monthOf(t.createdAt));
    if (b) b.created++;
  }
  for (const t of tasksCompleted) {
    const b = tIndex.get(monthOf(t.completedAt!));
    if (b) b.completed++;
  }

  // Customers: cumulative count at end of each month
  const custSeries = buckets.map((b) => ({ ...b, added: 0, total: 0 }));
  const cIndex = new Map(custSeries.map((c) => [c.key, c]));
  for (const c of customersInRange) {
    const b = cIndex.get(monthOf(c.createdAt));
    if (b) b.added++;
  }
  let running = customersBefore;
  for (const c of custSeries) {
    running += c.added;
    c.total = running;
  }

  // Invoices
  const invoiceStatus: Record<string, { count: number; amount: number }> = {};
  let invoiced = 0;
  let collected = 0;
  let outstanding = 0;
  for (const inv of invoices) {
    const s = effectiveInvoiceStatus(inv, today);
    invoiceStatus[s] ??= { count: 0, amount: 0 };
    invoiceStatus[s].count++;
    invoiceStatus[s].amount += inv.total;
    if (s !== "DRAFT" && s !== "CANCELLED") {
      invoiced += inv.total;
      collected += inv.amountPaid;
      outstanding += invoiceBalance(inv.total, inv.amountPaid);
    }
  }

  // Content
  const contentStatus: Record<string, number> = {};
  const contentPlatform: Record<string, number> = {};
  for (const c of content) {
    contentStatus[c.status] = (contentStatus[c.status] ?? 0) + 1;
    contentPlatform[c.platform] = (contentPlatform[c.platform] ?? 0) + 1;
  }

  return {
    range,
    financeSeries,
    totals,
    expenseByCategory: [...expenseByCategory].map(([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value),
    incomeByCategory: [...incomeByCategory].map(([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value),
    taskSeries,
    tasksCreatedTotal: tasksCreated.length,
    tasksCompletedTotal: tasksCompleted.length,
    customerSeries: custSeries,
    customersAdded: customersInRange.length,
    projects: projects.map(({ tasks, ...p }) => ({ ...p, progress: projectProgress(p, tasks) })),
    invoices: { count: invoices.length, invoiced, collected, outstanding, byStatus: invoiceStatus, collectionRate: invoiced > 0 ? Math.round((collected / invoiced) * 100) : null },
    content: { total: content.length, byStatus: contentStatus, byPlatform: contentPlatform },
  };
}
export type Analytics = Awaited<ReturnType<typeof getAnalytics>>;
