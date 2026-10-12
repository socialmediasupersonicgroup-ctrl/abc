import { prisma } from "@/lib/db";
import { formatMoney } from "@/lib/money";
import { formatDate } from "@/lib/dates";
import { TASK_STATUS, PROJECT_STATUS, CUSTOMER_STATUS, INVOICE_STATUS } from "@/lib/constants";
import type { Db } from "./shared";

export type SearchHit = { id: string; type: SearchType; title: string; subtitle: string; href: string };
export type SearchType = "task" | "project" | "customer" | "invoice" | "transaction" | "event" | "note" | "content";

export async function globalSearch(workspaceId: string, rawQuery: string, currency: string, limit = 5, db: Db = prisma) {
  const q = rawQuery.trim().slice(0, 100);
  if (q.length < 1) return [] as SearchHit[];
  const c = { contains: q };
  const [tasks, projects, customers, invoices, transactions, events, notes, content] = await Promise.all([
    db.task.findMany({ where: { workspaceId, OR: [{ title: c }, { description: c }] }, take: limit, orderBy: { updatedAt: "desc" } }),
    db.project.findMany({ where: { workspaceId, OR: [{ name: c }, { description: c }] }, take: limit, orderBy: { updatedAt: "desc" } }),
    db.customer.findMany({
      where: { workspaceId, OR: [{ name: c }, { company: c }, { email: c }, { phone: c }] },
      take: limit,
      orderBy: { updatedAt: "desc" },
    }),
    db.invoice.findMany({
      where: { workspaceId, OR: [{ number: c }, { customer: { name: c } }] },
      include: { customer: { select: { name: true } } },
      take: limit,
      orderBy: { issueDate: "desc" },
    }),
    db.transaction.findMany({
      where: { workspaceId, OR: [{ description: c }, { reference: c }, { category: c }] },
      take: limit,
      orderBy: { date: "desc" },
    }),
    db.event.findMany({ where: { workspaceId, OR: [{ title: c }, { description: c }, { location: c }] }, take: limit, orderBy: { startAt: "desc" } }),
    db.note.findMany({ where: { workspaceId, OR: [{ title: c }, { content: c }] }, take: limit, orderBy: { updatedAt: "desc" } }),
    db.contentItem.findMany({ where: { workspaceId, OR: [{ title: c }, { caption: c }, { campaign: c }] }, take: limit, orderBy: { updatedAt: "desc" } }),
  ]);

  const hits: SearchHit[] = [
    ...tasks.map((t) => ({ id: t.id, type: "task" as const, title: t.title, subtitle: TASK_STATUS.label(t.status), href: `/tasks?task=${t.id}` })),
    ...projects.map((p) => ({ id: p.id, type: "project" as const, title: p.name, subtitle: PROJECT_STATUS.label(p.status), href: `/projects/${p.id}` })),
    ...customers.map((cu) => ({
      id: cu.id,
      type: "customer" as const,
      title: cu.name,
      subtitle: [cu.company, CUSTOMER_STATUS.label(cu.status)].filter(Boolean).join(" · "),
      href: `/customers/${cu.id}`,
    })),
    ...invoices.map((i) => ({
      id: i.id,
      type: "invoice" as const,
      title: `${i.number} · ${i.customer.name}`,
      subtitle: `${formatMoney(i.total, i.currency)} · ${INVOICE_STATUS.label(i.status)}`,
      href: `/finance/invoices/${i.id}`,
    })),
    ...transactions.map((t) => ({
      id: t.id,
      type: "transaction" as const,
      title: t.description,
      subtitle: `${t.type === "INCOME" ? "+" : "−"}${formatMoney(t.amount, currency)} · ${formatDate(t.date)}`,
      href: `/finance?q=${encodeURIComponent(t.description)}`,
    })),
    ...events.map((e) => ({ id: e.id, type: "event" as const, title: e.title, subtitle: formatDate(e.startAt), href: `/calendar?event=${e.id}` })),
    ...notes.map((n) => ({
      id: n.id,
      type: "note" as const,
      title: n.title,
      subtitle: n.archived ? "Archived note" : "Note",
      href: `/notes?note=${n.id}${n.archived ? "&view=archived" : ""}`,
    })),
    ...content.map((ci) => ({ id: ci.id, type: "content" as const, title: ci.title, subtitle: ci.platform, href: `/content?item=${ci.id}` })),
  ];
  return hits;
}
