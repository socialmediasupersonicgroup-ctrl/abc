import { prisma } from "@/lib/db";
import { keyToDate } from "@/lib/dates";
import { formatMoney } from "@/lib/money";
import type { Db } from "./shared";

export type Alert = { id: string; kind: "task" | "invoice" | "followup" | "event"; title: string; detail: string; href: string; tone: "danger" | "warning" | "info" };

/** Alerts derived from live data — nothing here is stored or faked. */
export async function getAlerts(workspaceId: string, today: string, now: Date, currency: string, db: Db = prisma): Promise<Alert[]> {
  const todayDate = keyToDate(today);
  const in24h = new Date(now.getTime() + 24 * 3600 * 1000);
  const [overdueTasks, dueToday, overdueInvoices, followUps, events] = await Promise.all([
    db.task.findMany({ where: { workspaceId, status: { not: "DONE" }, dueDate: { lt: todayDate } }, orderBy: { dueDate: "asc" }, take: 5 }),
    db.task.findMany({ where: { workspaceId, status: { not: "DONE" }, dueDate: todayDate }, take: 5 }),
    db.invoice.findMany({
      where: { workspaceId, OR: [{ status: "OVERDUE" }, { status: "SENT", dueDate: { lt: todayDate } }] },
      include: { customer: { select: { name: true } } },
      orderBy: { dueDate: "asc" },
      take: 5,
    }),
    db.customer.findMany({ where: { workspaceId, nextFollowUpAt: { lte: todayDate } }, orderBy: { nextFollowUpAt: "asc" }, take: 5 }),
    db.event.findMany({ where: { workspaceId, startAt: { gte: now, lte: in24h } }, orderBy: { startAt: "asc" }, take: 5 }),
  ]);
  return [
    ...overdueInvoices.map((i) => ({
      id: `inv-${i.id}`,
      kind: "invoice" as const,
      title: `${i.number} is overdue`,
      detail: `${i.customer.name} · ${formatMoney(i.total - i.amountPaid, currency)} outstanding`,
      href: `/finance/invoices/${i.id}`,
      tone: "danger" as const,
    })),
    ...overdueTasks.map((t) => ({
      id: `task-${t.id}`,
      kind: "task" as const,
      title: t.title,
      detail: "Task overdue",
      href: `/tasks?task=${t.id}`,
      tone: "danger" as const,
    })),
    ...dueToday.map((t) => ({ id: `today-${t.id}`, kind: "task" as const, title: t.title, detail: "Due today", href: `/tasks?task=${t.id}`, tone: "warning" as const })),
    ...followUps.map((c) => ({
      id: `fu-${c.id}`,
      kind: "followup" as const,
      title: `Follow up with ${c.name}`,
      detail: c.nextFollowUpAt && c.nextFollowUpAt < todayDate ? "Follow-up overdue" : "Follow-up due today",
      href: `/customers/${c.id}`,
      tone: "warning" as const,
    })),
    ...events.map((e) => ({ id: `ev-${e.id}`, kind: "event" as const, title: e.title, detail: "Starting within 24 hours", href: `/calendar?event=${e.id}`, tone: "info" as const })),
  ];
}
