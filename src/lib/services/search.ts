import { prisma } from "@/lib/db";
import { formatMoney } from "@/lib/money";
import { DEFAULT_TZ, formatDate, formatDateTime, todayKey } from "@/lib/dates";
import { TASK_STATUS, PROJECT_STATUS, CUSTOMER_STATUS, INVOICE_STATUS } from "@/lib/constants";
import { effectiveInvoiceStatus } from "@/lib/calc/invoice";
import type { Prisma } from "@prisma/client";
import { textWhere, type Db, type TextSpec } from "./shared";
import { TASK_TEXT } from "./tasks";
import { PROJECT_TEXT } from "./projects";
import { CUSTOMER_TEXT } from "./customers";
import { INVOICE_TEXT } from "./invoices";
import { TRANSACTION_TEXT } from "./transactions";
import { NOTE_TEXT } from "./notes";
import { CONTENT_TEXT } from "./content";

export type SearchHit = { id: string; type: SearchType; title: string; subtitle: string; href: string };
export type SearchType = "task" | "project" | "customer" | "invoice" | "transaction" | "event" | "note" | "content";

export const EVENT_TEXT: TextSpec = { table: "Event", columns: ["title", "description", "location"] };

export async function globalSearch(workspaceId: string, rawQuery: string, currency: string, limit = 5, tz = DEFAULT_TZ, db: Db = prisma) {
  const q = rawQuery.trim().slice(0, 100);
  if (q.length < 1) return [] as SearchHit[];
  const today = todayKey(tz);
  const where = async <T,>(spec: TextSpec) => ({ workspaceId, ...((await textWhere(db, workspaceId, q, spec)) as T) });
  const [tasks, projects, customers, invoices, transactions, events, notes, content] = await Promise.all([
    db.task.findMany({ where: await where<Prisma.TaskWhereInput>(TASK_TEXT), take: limit, orderBy: { updatedAt: "desc" } }),
    db.project.findMany({ where: await where<Prisma.ProjectWhereInput>(PROJECT_TEXT), take: limit, orderBy: { updatedAt: "desc" } }),
    db.customer.findMany({ where: await where<Prisma.CustomerWhereInput>(CUSTOMER_TEXT), take: limit, orderBy: { updatedAt: "desc" } }),
    db.invoice.findMany({
      where: await where<Prisma.InvoiceWhereInput>(INVOICE_TEXT),
      include: { customer: { select: { name: true } } },
      take: limit,
      orderBy: { issueDate: "desc" },
    }),
    db.transaction.findMany({ where: await where<Prisma.TransactionWhereInput>(TRANSACTION_TEXT), take: limit, orderBy: { date: "desc" } }),
    db.event.findMany({ where: await where<Prisma.EventWhereInput>(EVENT_TEXT), take: limit, orderBy: { startAt: "desc" } }),
    db.note.findMany({ where: await where<Prisma.NoteWhereInput>(NOTE_TEXT), take: limit, orderBy: { updatedAt: "desc" } }),
    db.contentItem.findMany({ where: await where<Prisma.ContentItemWhereInput>(CONTENT_TEXT), take: limit, orderBy: { updatedAt: "desc" } }),
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
      subtitle: `${formatMoney(i.total, i.currency)} · ${INVOICE_STATUS.label(effectiveInvoiceStatus(i, today))}`,
      href: `/finance/invoices/${i.id}`,
    })),
    ...transactions.map((t) => ({
      id: t.id,
      type: "transaction" as const,
      title: t.description,
      subtitle: `${t.type === "INCOME" ? "+" : "−"}${formatMoney(t.amount, currency)} · ${formatDate(t.date)}`,
      href: `/finance?q=${encodeURIComponent(t.description)}`,
    })),
    // Events are instants: show their date in the workspace zone (all-day events start at local midnight).
    ...events.map((e) => ({ id: e.id, type: "event" as const, title: e.title, subtitle: formatDateTime(e.startAt, tz, "d MMM yyyy"), href: `/calendar?event=${e.id}` })),
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
