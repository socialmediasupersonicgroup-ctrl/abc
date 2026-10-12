import type { Prisma, PrismaClient } from "@prisma/client";
import { prisma } from "@/lib/db";
import { INVOICE_PAYMENT_CATEGORY, type InvoiceStatus } from "@/lib/constants";
import { keyToDate } from "@/lib/dates";
import { formatMoney } from "@/lib/money";
import { calculateInvoiceTotals, effectiveInvoiceStatus, invoiceBalance, statusAfterPayment } from "@/lib/calc/invoice";
import type { InvoiceInput, PaymentInput } from "@/lib/validation";
import { AppError, NotFoundError } from "./errors";
import { assertLinks, containsText, type Db } from "./shared";

export type InvoiceFilters = { q?: string; status?: string; customerId?: string; sort?: string };

/**
 * Status filters use the *effective* status (PAID/OVERDUE are derived from payments and due dates),
 * so we translate them into equivalent database conditions.
 */
function statusWhere(status: string, today: string): Prisma.InvoiceWhereInput {
  const todayDate = keyToDate(today);
  switch (status as InvoiceStatus | "OUTSTANDING") {
    case "DRAFT":
    case "CANCELLED":
      return { status };
    case "PAID":
      // Stored status is kept in sync with payments (see statusAfterPayment).
      return { status: "PAID" };
    case "OVERDUE":
      return { OR: [{ status: "OVERDUE" }, { status: "SENT", dueDate: { lt: todayDate } }] };
    case "SENT":
      return { status: "SENT", dueDate: { gte: todayDate } };
    case "OUTSTANDING":
      return { status: { in: ["SENT", "OVERDUE"] } };
    default:
      return {};
  }
}

export async function listInvoices(workspaceId: string, filters: InvoiceFilters, today: string, db: Db = prisma) {
  const and: Prisma.InvoiceWhereInput[] = [];
  if (filters.status) and.push(statusWhere(filters.status, today));
  const q = containsText(filters.q);
  if (q) and.push({ OR: [{ number: q }, { customer: { name: q } }, { customer: { company: q } }, { notes: q }] });
  const where: Prisma.InvoiceWhereInput = { workspaceId, AND: and };
  if (filters.customerId) where.customerId = filters.customerId;
  const orderBy: Prisma.InvoiceOrderByWithRelationInput[] =
    filters.sort === "due"
      ? [{ dueDate: "asc" }]
      : filters.sort === "amount"
        ? [{ total: "desc" }]
        : [{ issueDate: "desc" }, { number: "desc" }];
  const invoices = await db.invoice.findMany({
    where,
    orderBy,
    take: 300,
    include: { customer: { select: { id: true, name: true, company: true } }, project: { select: { id: true, name: true } } },
  });
  return invoices.map((inv) => ({
    ...inv,
    effectiveStatus: effectiveInvoiceStatus(inv, today),
    balance: invoiceBalance(inv.total, inv.amountPaid),
  }));
}
export type InvoiceListItem = Awaited<ReturnType<typeof listInvoices>>[number];

export async function getInvoice(workspaceId: string, id: string, today: string, db: Db = prisma) {
  const invoice = await db.invoice.findFirst({
    where: { id, workspaceId },
    include: {
      customer: true,
      project: { select: { id: true, name: true } },
      items: { orderBy: { sortOrder: "asc" } },
      payments: { orderBy: { date: "asc" } },
      workspace: { select: { name: true, ownerName: true, ownerEmail: true, currency: true } },
    },
  });
  if (!invoice) throw new NotFoundError("Invoice");
  return {
    ...invoice,
    effectiveStatus: effectiveInvoiceStatus(invoice, today),
    balance: invoiceBalance(invoice.total, invoice.amountPaid),
  };
}
export type InvoiceDetail = Awaited<ReturnType<typeof getInvoice>>;

export async function nextInvoiceNumber(workspaceId: string, prefix: string, db: Db = prisma) {
  const invoices = await db.invoice.findMany({ where: { workspaceId }, select: { number: true } });
  let max = 0;
  for (const { number } of invoices) {
    const m = /(\d+)\s*$/.exec(number);
    if (m) max = Math.max(max, Number(m[1]));
  }
  return `${prefix}${String(max + 1).padStart(4, "0")}`;
}

function computed(input: InvoiceInput) {
  const totals = calculateInvoiceTotals({
    items: input.items,
    discountType: input.discountType,
    discountValue: input.discountValue,
    taxRateBps: input.taxRateBps,
  });
  return {
    totals,
    items: input.items.map((item, i) => ({
      description: item.description,
      quantity: item.quantity,
      unitPrice: item.unitPrice,
      lineTotal: totals.lineTotals[i],
      sortOrder: i,
    })),
  };
}

async function assertNumberFree(workspaceId: string, number: string, excludeId: string | null, db: Db) {
  const clash = await db.invoice.findFirst({ where: { workspaceId, number, ...(excludeId ? { NOT: { id: excludeId } } : {}) } });
  if (clash) throw new AppError(`Invoice number ${number} is already in use.`, { number: "This number is already in use" });
}

export async function createInvoice(workspaceId: string, currency: string, input: InvoiceInput, db: PrismaClient = prisma) {
  await assertLinks(workspaceId, { customerId: input.customerId, projectId: input.projectId }, db);
  await assertNumberFree(workspaceId, input.number, null, db);
  const { totals, items } = computed(input);
  return db.invoice.create({
    data: {
      workspaceId,
      number: input.number,
      customerId: input.customerId,
      projectId: input.projectId,
      status: input.status,
      issueDate: keyToDate(input.issueDate),
      dueDate: keyToDate(input.dueDate),
      currency,
      discountType: input.discountType,
      discountValue: input.discountType === "NONE" ? 0 : input.discountValue,
      taxRateBps: input.taxRateBps,
      taxLabel: input.taxLabel || "Tax",
      subtotal: totals.subtotal,
      discountAmount: totals.discountAmount,
      taxAmount: totals.taxAmount,
      total: totals.total,
      notes: input.notes,
      terms: input.terms,
      items: { create: items },
    },
  });
}

export async function updateInvoice(workspaceId: string, id: string, input: InvoiceInput, db: PrismaClient = prisma) {
  const existing = await db.invoice.findFirst({ where: { id, workspaceId }, select: { amountPaid: true, currency: true } });
  if (!existing) throw new NotFoundError("Invoice");
  await assertLinks(workspaceId, { customerId: input.customerId, projectId: input.projectId }, db);
  await assertNumberFree(workspaceId, input.number, id, db);
  const { totals, items } = computed(input);
  if (existing.amountPaid > totals.total) {
    throw new AppError(
      `The new total (${formatMoney(totals.total, existing.currency)}) is less than the ${formatMoney(existing.amountPaid, existing.currency)} already paid. Remove a payment first.`,
    );
  }
  if (input.status === "CANCELLED" && existing.amountPaid > 0) {
    throw new AppError("This invoice has recorded payments. Remove the payments before cancelling it.");
  }
  if (input.status === "DRAFT" && existing.amountPaid > 0) {
    throw new AppError("An invoice with recorded payments cannot be moved back to Draft.");
  }
  const status = statusAfterPayment(input.status, totals.total, existing.amountPaid);
  return db.$transaction(async (tx) => {
    await tx.invoiceItem.deleteMany({ where: { invoiceId: id } });
    return tx.invoice.update({
      where: { id },
      data: {
        number: input.number,
        customerId: input.customerId,
        projectId: input.projectId,
        status,
        issueDate: keyToDate(input.issueDate),
        dueDate: keyToDate(input.dueDate),
        discountType: input.discountType,
        discountValue: input.discountType === "NONE" ? 0 : input.discountValue,
        taxRateBps: input.taxRateBps,
        taxLabel: input.taxLabel || "Tax",
        subtotal: totals.subtotal,
        discountAmount: totals.discountAmount,
        taxAmount: totals.taxAmount,
        total: totals.total,
        notes: input.notes,
        terms: input.terms,
        items: { create: items },
      },
    });
  });
}

export async function setInvoiceStatus(workspaceId: string, id: string, status: InvoiceStatus, db: Db = prisma) {
  const inv = await db.invoice.findFirst({ where: { id, workspaceId }, select: { amountPaid: true, total: true } });
  if (!inv) throw new NotFoundError("Invoice");
  if (status === "PAID" && inv.amountPaid < inv.total) {
    throw new AppError("Record a payment to mark this invoice as paid. Paid status is set automatically once payments cover the total.");
  }
  if ((status === "CANCELLED" || status === "DRAFT") && inv.amountPaid > 0) {
    throw new AppError("This invoice has recorded payments. Remove them first.");
  }
  if (status === "SENT" && inv.amountPaid >= inv.total && inv.total > 0) {
    throw new AppError("This invoice is fully paid.");
  }
  return db.invoice.update({ where: { id }, data: { status } });
}

export async function deleteInvoice(workspaceId: string, id: string, db: Db = prisma) {
  const inv = await db.invoice.findFirst({ where: { id, workspaceId }, include: { _count: { select: { payments: true } } } });
  if (!inv) throw new NotFoundError("Invoice");
  if (inv._count.payments > 0) {
    throw new AppError("This invoice has recorded payments. Remove the payments first so your income records stay consistent.");
  }
  await db.invoice.delete({ where: { id } });
}

/**
 * Records a payment against an invoice. In one database transaction this:
 *  1. creates the Payment,
 *  2. creates the matching INCOME transaction (linked by paymentId, so revenue is counted exactly once),
 *  3. updates the invoice's paid amount and status.
 */
export async function recordPayment(workspaceId: string, invoiceId: string, input: PaymentInput, db: PrismaClient = prisma) {
  return db.$transaction(async (tx) => {
    const inv = await tx.invoice.findFirst({ where: { id: invoiceId, workspaceId } });
    if (!inv) throw new NotFoundError("Invoice");
    if (inv.status === "DRAFT") throw new AppError("Mark the invoice as Sent before recording a payment.");
    if (inv.status === "CANCELLED") throw new AppError("Payments cannot be recorded on a cancelled invoice.");
    const balance = invoiceBalance(inv.total, inv.amountPaid);
    if (balance <= 0) throw new AppError("This invoice is already fully paid.");
    if (input.amount > balance) {
      throw new AppError(`Payment exceeds the outstanding balance of ${formatMoney(balance, inv.currency)}.`, {
        amount: "Cannot exceed the outstanding balance",
      });
    }
    const payment = await tx.payment.create({
      data: {
        invoiceId,
        amount: input.amount,
        date: keyToDate(input.date),
        method: input.method,
        reference: input.reference,
        notes: input.notes,
      },
    });
    await tx.transaction.create({
      data: {
        workspaceId,
        description: `Payment for ${inv.number}`,
        amount: input.amount,
        type: "INCOME",
        category: INVOICE_PAYMENT_CATEGORY,
        date: keyToDate(input.date),
        paymentMethod: input.method,
        reference: input.reference,
        customerId: inv.customerId,
        projectId: inv.projectId,
        paymentId: payment.id,
      },
    });
    const amountPaid = inv.amountPaid + input.amount;
    await tx.invoice.update({
      where: { id: invoiceId },
      data: { amountPaid, status: statusAfterPayment(inv.status, inv.total, amountPaid) },
    });
    return payment;
  });
}

/** Removes a payment and its linked income transaction, then recalculates the invoice. */
export async function deletePayment(workspaceId: string, paymentId: string, db: PrismaClient = prisma) {
  return db.$transaction(async (tx) => {
    const payment = await tx.payment.findFirst({ where: { id: paymentId, invoice: { workspaceId } }, include: { invoice: true } });
    if (!payment) throw new NotFoundError("Payment");
    await tx.transaction.deleteMany({ where: { paymentId } });
    await tx.payment.delete({ where: { id: paymentId } });
    const agg = await tx.payment.aggregate({ where: { invoiceId: payment.invoiceId }, _sum: { amount: true } });
    const amountPaid = agg._sum.amount ?? 0;
    await tx.invoice.update({
      where: { id: payment.invoiceId },
      data: { amountPaid, status: statusAfterPayment(payment.invoice.status, payment.invoice.total, amountPaid) },
    });
    return payment.invoiceId;
  });
}
