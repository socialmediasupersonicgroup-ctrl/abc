import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { keyToDate } from "@/lib/dates";
import { summarize } from "@/lib/calc/metrics";
import type { TransactionInput } from "@/lib/validation";
import { AppError, NotFoundError } from "./errors";
import { assertLinks, containsText, type Db } from "./shared";

export type TransactionFilters = {
  q?: string;
  type?: string;
  category?: string;
  from?: string;
  to?: string;
  customerId?: string;
  projectId?: string;
  sort?: "date" | "amount" | "";
};

export function transactionWhere(workspaceId: string, f: TransactionFilters): Prisma.TransactionWhereInput {
  const where: Prisma.TransactionWhereInput = { workspaceId };
  const q = containsText(f.q);
  if (q) where.OR = [{ description: q }, { reference: q }, { category: q }, { notes: q }, { customer: { name: q } }];
  if (f.type) where.type = f.type;
  if (f.category) where.category = f.category;
  if (f.customerId) where.customerId = f.customerId;
  if (f.projectId) where.projectId = f.projectId;
  if (f.from || f.to) {
    where.date = {};
    if (f.from) where.date.gte = keyToDate(f.from);
    if (f.to) where.date.lte = keyToDate(f.to);
  }
  return where;
}

export async function listTransactions(workspaceId: string, filters: TransactionFilters = {}, page = 1, pageSize = 50, db: Db = prisma) {
  const where = transactionWhere(workspaceId, filters);
  const orderBy: Prisma.TransactionOrderByWithRelationInput[] =
    filters.sort === "amount" ? [{ amount: "desc" }] : [{ date: "desc" }, { createdAt: "desc" }];
  const [rows, total, all] = await Promise.all([
    db.transaction.findMany({
      where,
      orderBy,
      skip: (page - 1) * pageSize,
      take: pageSize,
      include: {
        customer: { select: { id: true, name: true } },
        project: { select: { id: true, name: true } },
        payment: { select: { id: true, invoice: { select: { id: true, number: true } } } },
      },
    }),
    db.transaction.count({ where }),
    db.transaction.findMany({ where, select: { amount: true, type: true, date: true } }),
  ]);
  return { rows, total, page, pageSize, summary: summarize(all) };
}
export type TransactionRow = Awaited<ReturnType<typeof listTransactions>>["rows"][number];

function data(input: TransactionInput) {
  return {
    description: input.description,
    amount: input.amount,
    type: input.type,
    category: input.category,
    date: keyToDate(input.date),
    paymentMethod: input.paymentMethod,
    reference: input.reference,
    customerId: input.customerId,
    projectId: input.projectId,
    notes: input.notes,
  };
}

export async function createTransaction(workspaceId: string, input: TransactionInput, db: Db = prisma) {
  await assertLinks(workspaceId, input, db);
  return db.transaction.create({ data: { workspaceId, ...data(input) } });
}

async function assertEditable(workspaceId: string, id: string, db: Db) {
  const txn = await db.transaction.findFirst({ where: { id, workspaceId }, select: { paymentId: true } });
  if (!txn) throw new NotFoundError("Transaction");
  if (txn.paymentId) {
    throw new AppError("This transaction was created by an invoice payment. Edit or remove the payment from the invoice instead.");
  }
}

export async function updateTransaction(workspaceId: string, id: string, input: TransactionInput, db: Db = prisma) {
  await assertEditable(workspaceId, id, db);
  await assertLinks(workspaceId, input, db);
  return db.transaction.update({ where: { id }, data: data(input) });
}

export async function deleteTransaction(workspaceId: string, id: string, db: Db = prisma) {
  await assertEditable(workspaceId, id, db);
  await db.transaction.delete({ where: { id } });
}

export async function transactionCategories(workspaceId: string, db: Db = prisma) {
  const rows = await db.transaction.findMany({ where: { workspaceId }, distinct: ["category"], select: { category: true } });
  return rows.map((r) => r.category).sort();
}
