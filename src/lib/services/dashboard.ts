import { prisma } from "@/lib/db";
import { PRIORITY_RANK, type Priority } from "@/lib/constants";
import { addDaysToKey, DEFAULT_TZ, keyToDate, zonedDayStart } from "@/lib/dates";
import { monthlySeries, percentChange, periodRange, summarize, type Period } from "@/lib/calc/metrics";
import { projectProgress } from "@/lib/calc/progress";
import { invoiceBalance } from "@/lib/calc/invoice";
import { taskInclude } from "./tasks";
import { eventInclude } from "./events";
import type { Db } from "./shared";

export type RecentRecord = { id: string; type: "task" | "project" | "customer" | "invoice" | "note"; title: string; href: string; updatedAt: Date };

export async function getOverview(workspaceId: string, period: Period, today: string, now: Date, tz = DEFAULT_TZ, db: Db = prisma) {
  const todayDate = keyToDate(today);
  const weekAhead = keyToDate(addDaysToKey(today, 7));
  const range = periodRange(period, today);

  const [
    txns,
    receivables,
    projects,
    taskCounts,
    overdueTaskCount,
    upcomingTasks,
    upcomingProjects,
    customerCount,
    newCustomers,
    previousCustomers,
    recentTransactions,
    events,
    priorityTasks,
    recentTasks,
    recentProjects,
    recentCustomers,
    recentInvoices,
    recentNotes,
    completedThisWeek,
    totalRecords,
  ] = await Promise.all([
    db.transaction.findMany({ where: { workspaceId }, select: { amount: true, type: true, date: true } }),
    db.invoice.findMany({ where: { workspaceId, status: { in: ["SENT", "OVERDUE"] } }, select: { total: true, amountPaid: true, dueDate: true, status: true } }),
    db.project.findMany({ where: { workspaceId }, select: { id: true, status: true, progressMode: true, manualProgress: true, tasks: { select: { status: true } } } }),
    db.task.groupBy({ by: ["status"], where: { workspaceId }, _count: { _all: true } }),
    db.task.count({ where: { workspaceId, status: { not: "DONE" }, dueDate: { lt: todayDate } } }),
    db.task.findMany({
      where: { workspaceId, status: { not: "DONE" }, dueDate: { gte: todayDate, lte: weekAhead } },
      include: taskInclude,
      orderBy: { dueDate: "asc" },
      take: 20,
    }),
    db.project.findMany({
      where: { workspaceId, status: { in: ["PLANNING", "ACTIVE", "ON_HOLD"] }, dueDate: { gte: todayDate, lte: weekAhead } },
      select: { id: true, name: true, dueDate: true },
      orderBy: { dueDate: "asc" },
    }),
    db.customer.count({ where: { workspaceId } }),
    // createdAt is an instant, so the period starts at midnight in the workspace zone.
    range.current ? db.customer.count({ where: { workspaceId, createdAt: { gte: zonedDayStart(range.current.from, tz) } } }) : Promise.resolve(null),
    range.current ? db.customer.count({ where: { workspaceId, createdAt: { lt: zonedDayStart(range.current.from, tz) } } }) : Promise.resolve(null),
    db.transaction.findMany({
      where: { workspaceId },
      orderBy: [{ date: "desc" }, { createdAt: "desc" }],
      take: 6,
      include: { customer: { select: { name: true } } },
    }),
    db.event.findMany({ where: { workspaceId, endAt: { gte: now } }, include: eventInclude, orderBy: { startAt: "asc" }, take: 5 }),
    // Rank every candidate (lightweight rows), then load full details for the top six only.
    db.task.findMany({
      where: {
        workspaceId,
        status: { not: "DONE" },
        OR: [{ priority: { in: ["URGENT", "HIGH"] } }, { dueDate: { lte: weekAhead } }],
      },
      select: { id: true, priority: true, dueDate: true },
    }),
    db.task.findMany({ where: { workspaceId }, orderBy: { updatedAt: "desc" }, take: 5, select: { id: true, title: true, updatedAt: true } }),
    db.project.findMany({ where: { workspaceId }, orderBy: { updatedAt: "desc" }, take: 5, select: { id: true, name: true, updatedAt: true } }),
    db.customer.findMany({ where: { workspaceId }, orderBy: { updatedAt: "desc" }, take: 5, select: { id: true, name: true, updatedAt: true } }),
    db.invoice.findMany({ where: { workspaceId }, orderBy: { updatedAt: "desc" }, take: 5, select: { id: true, number: true, updatedAt: true } }),
    db.note.findMany({ where: { workspaceId, archived: false }, orderBy: { updatedAt: "desc" }, take: 5, select: { id: true, title: true, updatedAt: true } }),
    db.task.count({ where: { workspaceId, status: "DONE", completedAt: { gte: new Date(now.getTime() - 7 * 86400000) } } }),
    Promise.all([
      db.task.count({ where: { workspaceId } }),
      db.project.count({ where: { workspaceId } }),
      db.customer.count({ where: { workspaceId } }),
      db.transaction.count({ where: { workspaceId } }),
      db.invoice.count({ where: { workspaceId } }),
      db.note.count({ where: { workspaceId } }),
      db.event.count({ where: { workspaceId } }),
    ]).then((counts) => counts.reduce((a, b) => a + b, 0)),
  ]);

  // ---- Finance
  const current = summarize(txns, range.current);
  const previous = range.previous ? summarize(txns, range.previous) : null;
  const hasPrevious = !!previous && previous.count > 0;
  const finance = {
    revenue: current.income,
    expenses: current.expense,
    net: current.net,
    revenueChange: hasPrevious ? percentChange(current.income, previous!.income) : null,
    expenseChange: hasPrevious ? percentChange(current.expense, previous!.expense) : null,
    netChange: hasPrevious ? percentChange(current.net, previous!.net) : null,
    hasTransactions: txns.length > 0,
  };

  let outstanding = 0;
  let overdueAmount = 0;
  let overdueInvoices = 0;
  for (const inv of receivables) {
    const bal = invoiceBalance(inv.total, inv.amountPaid);
    outstanding += bal;
    if (bal > 0 && (inv.status === "OVERDUE" || inv.dueDate < todayDate)) {
      overdueAmount += bal;
      overdueInvoices++;
    }
  }

  // ---- Projects
  const statusDistribution: Record<string, number> = {};
  let activeProjects = 0;
  let progressSum = 0;
  let progressCount = 0;
  for (const p of projects) {
    statusDistribution[p.status] = (statusDistribution[p.status] ?? 0) + 1;
    if (p.status === "ACTIVE") {
      activeProjects++;
      const pr = projectProgress(p, p.tasks);
      if (pr.source !== "none") {
        progressSum += pr.value;
        progressCount++;
      }
    }
  }

  // ---- Tasks
  const byStatus: Record<string, number> = { TODO: 0, IN_PROGRESS: 0, IN_REVIEW: 0, DONE: 0 };
  for (const row of taskCounts) byStatus[row.status] = row._count._all;
  const totalTasks = Object.values(byStatus).reduce((a, b) => a + b, 0);
  const openTasks = totalTasks - byStatus.DONE;

  const topIds = priorityTasks
    .map((t) => ({ t, overdue: !!t.dueDate && t.dueDate < todayDate }))
    .sort(
      (a, b) =>
        Number(b.overdue) - Number(a.overdue) ||
        PRIORITY_RANK[a.t.priority as Priority] - PRIORITY_RANK[b.t.priority as Priority] ||
        (a.t.dueDate?.getTime() ?? Infinity) - (b.t.dueDate?.getTime() ?? Infinity),
    )
    .slice(0, 6)
    .map((x) => x.t.id);
  const topTasks = topIds.length ? await db.task.findMany({ where: { id: { in: topIds } }, include: taskInclude }) : [];
  const sortedPriority = topIds.map((id) => topTasks.find((t) => t.id === id)!).filter(Boolean);

  const recent: RecentRecord[] = [
    ...recentTasks.map((r) => ({ id: r.id, type: "task" as const, title: r.title, href: `/tasks?task=${r.id}`, updatedAt: r.updatedAt })),
    ...recentProjects.map((r) => ({ id: r.id, type: "project" as const, title: r.name, href: `/projects/${r.id}`, updatedAt: r.updatedAt })),
    ...recentCustomers.map((r) => ({ id: r.id, type: "customer" as const, title: r.name, href: `/customers/${r.id}`, updatedAt: r.updatedAt })),
    ...recentInvoices.map((r) => ({ id: r.id, type: "invoice" as const, title: r.number, href: `/finance/invoices/${r.id}`, updatedAt: r.updatedAt })),
    ...recentNotes.map((r) => ({ id: r.id, type: "note" as const, title: r.title, href: `/notes?note=${r.id}`, updatedAt: r.updatedAt })),
  ]
    .sort((a, b) => b.updatedAt.getTime() - a.updatedAt.getTime())
    .slice(0, 7);

  const deadlines = [
    ...upcomingTasks.map((t) => ({ id: t.id, kind: "task" as const, title: t.title, date: t.dueDate!, href: `/tasks?task=${t.id}`, priority: t.priority })),
    ...upcomingProjects.map((p) => ({ id: p.id, kind: "project" as const, title: p.name, date: p.dueDate!, href: `/projects/${p.id}`, priority: null })),
  ].sort((a, b) => a.date.getTime() - b.date.getTime());

  return {
    isEmpty: totalRecords === 0,
    period,
    range,
    finance,
    receivables: { outstanding, overdueAmount, overdueInvoices, openInvoices: receivables.length },
    projects: { total: projects.length, active: activeProjects, avgProgress: progressCount ? Math.round(progressSum / progressCount) : null, statusDistribution },
    tasks: { byStatus, total: totalTasks, open: openTasks, overdue: overdueTaskCount, completedThisWeek },
    customers: { total: customerCount, newInPeriod: newCustomers, previousTotal: previousCustomers },
    deadlines,
    series: monthlySeries(txns, today, 6),
    recentTransactions,
    events,
    priorityTasks: sortedPriority,
    recent,
  };
}
export type Overview = Awaited<ReturnType<typeof getOverview>>;
