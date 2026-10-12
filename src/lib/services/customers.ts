import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { keyToDate } from "@/lib/dates";
import { projectProgress } from "@/lib/calc/progress";
import type { CustomerInput } from "@/lib/validation";
import { AppError, NotFoundError } from "./errors";
import { containsText, toDate, type Db } from "./shared";
import { taskInclude } from "./tasks";

export type CustomerFilters = {
  q?: string;
  status?: string;
  source?: string;
  followUp?: "due" | "upcoming" | "";
  sort?: "name" | "updated" | "value" | "followup" | "created" | "";
};

export async function listCustomers(workspaceId: string, filters: CustomerFilters = {}, today?: string, db: Db = prisma) {
  const where: Prisma.CustomerWhereInput = { workspaceId };
  const q = containsText(filters.q);
  if (q) where.OR = [{ name: q }, { company: q }, { email: q }, { phone: q }];
  if (filters.status) where.status = filters.status;
  if (filters.source) where.source = filters.source;
  if (filters.followUp && today) {
    where.nextFollowUpAt = filters.followUp === "due" ? { lte: keyToDate(today) } : { gt: keyToDate(today) };
  }
  const orderBy: Prisma.CustomerOrderByWithRelationInput[] =
    filters.sort === "value"
      ? [{ dealValue: "desc" }]
      : filters.sort === "followup"
        ? [{ nextFollowUpAt: { sort: "asc", nulls: "last" } }]
        : filters.sort === "updated"
          ? [{ updatedAt: "desc" }]
          : filters.sort === "created"
            ? [{ createdAt: "desc" }]
            : [{ name: "asc" }];

  return db.customer.findMany({
    where,
    orderBy,
    take: 500,
    include: { _count: { select: { projects: true, invoices: true } } },
  });
}
export type CustomerListItem = Awaited<ReturnType<typeof listCustomers>>[number];

export async function getCustomer(workspaceId: string, id: string, db: Db = prisma) {
  const customer = await db.customer.findFirst({
    where: { id, workspaceId },
    include: {
      projects: { orderBy: { updatedAt: "desc" }, include: { tasks: { select: { status: true } } } },
      invoices: { orderBy: { issueDate: "desc" } },
      tasks: { where: { status: { not: "DONE" } }, include: taskInclude, orderBy: { dueDate: { sort: "asc", nulls: "last" } } },
      transactions: { orderBy: { date: "desc" }, take: 15 },
      events: { orderBy: { startAt: "desc" }, take: 10 },
      linkedNotes: { where: { archived: false }, orderBy: { updatedAt: "desc" }, select: { id: true, title: true, content: true, updatedAt: true } },
    },
  });
  if (!customer) throw new NotFoundError("Customer");
  return {
    ...customer,
    projects: customer.projects.map(({ tasks, ...p }) => ({ ...p, progress: projectProgress(p, tasks) })),
  };
}
export type CustomerDetail = Awaited<ReturnType<typeof getCustomer>>;

function data(input: CustomerInput) {
  return {
    name: input.name,
    company: input.company,
    email: input.email,
    phone: input.phone,
    status: input.status,
    source: input.source,
    dealValue: input.dealValue,
    notes: input.notes,
    lastContactAt: toDate(input.lastContactAt),
    nextFollowUpAt: toDate(input.nextFollowUpAt),
  };
}

export async function createCustomer(workspaceId: string, input: CustomerInput, db: Db = prisma) {
  return db.customer.create({ data: { workspaceId, ...data(input) } });
}

export async function updateCustomer(workspaceId: string, id: string, input: CustomerInput, db: Db = prisma) {
  const exists = await db.customer.count({ where: { id, workspaceId } });
  if (!exists) throw new NotFoundError("Customer");
  return db.customer.update({ where: { id }, data: data(input) });
}

/** Customers with invoices cannot be deleted, so that invoice history is never orphaned. */
export async function deleteCustomer(workspaceId: string, id: string, db: Db = prisma) {
  const customer = await db.customer.findFirst({ where: { id, workspaceId }, include: { _count: { select: { invoices: true } } } });
  if (!customer) throw new NotFoundError("Customer");
  if (customer._count.invoices > 0) {
    throw new AppError(
      `${customer.name} has ${customer._count.invoices} invoice(s). Delete or reassign those invoices before deleting the customer, or mark the customer as Inactive.`,
    );
  }
  await db.customer.delete({ where: { id } });
}

export async function logContact(workspaceId: string, id: string, today: string, nextFollowUp: string | null, db: Db = prisma) {
  const exists = await db.customer.count({ where: { id, workspaceId } });
  if (!exists) throw new NotFoundError("Customer");
  return db.customer.update({
    where: { id },
    data: { lastContactAt: keyToDate(today), nextFollowUpAt: nextFollowUp ? keyToDate(nextFollowUp) : null },
  });
}

/** Appends a dated entry to the customer's running notes. */
export async function appendCustomerNote(workspaceId: string, id: string, text: string, stamp: string, db: Db = prisma) {
  const customer = await db.customer.findFirst({ where: { id, workspaceId }, select: { notes: true } });
  if (!customer) throw new NotFoundError("Customer");
  const entry = `[${stamp}] ${text.trim()}`;
  return db.customer.update({
    where: { id },
    data: { notes: customer.notes ? `${entry}\n\n${customer.notes}` : entry },
  });
}

export async function customerOptions(workspaceId: string, db: Db = prisma) {
  return db.customer.findMany({
    where: { workspaceId },
    select: { id: true, name: true, company: true, email: true },
    orderBy: { name: "asc" },
  });
}
