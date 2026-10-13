import { divRound } from "@/lib/money";
import type { DiscountType, InvoiceStatus } from "@/lib/constants";

export type LineInput = { quantity: number; unitPrice: number };

export type InvoiceTotalsInput = {
  items: LineInput[];
  discountType: DiscountType;
  /** basis points when PERCENT, minor units when FIXED */
  discountValue: number;
  taxRateBps: number;
};

export type InvoiceTotals = {
  lineTotals: number[];
  subtotal: number;
  discountAmount: number;
  taxableAmount: number;
  taxAmount: number;
  total: number;
};

/** Quantities are limited to two decimals; we scale to hundredths so the multiplication is integer-exact. */
export function quantityToHundredths(quantity: number): number {
  return Math.round(quantity * 100);
}

export function lineTotal(quantity: number, unitPrice: number): number {
  return divRound(quantityToHundredths(quantity) * unitPrice, 100);
}

/**
 * Invoice arithmetic, applied in this order:
 *   subtotal = Σ round(qty × unit price)
 *   discount = percent of subtotal (rounded) or a fixed amount, never more than the subtotal
 *   tax      = rate × (subtotal − discount), rounded half away from zero
 *   total    = subtotal − discount + tax
 */
export function calculateInvoiceTotals(input: InvoiceTotalsInput): InvoiceTotals {
  const lineTotals = input.items.map((i) => lineTotal(i.quantity, i.unitPrice));
  const subtotal = lineTotals.reduce((sum, v) => sum + v, 0);

  let discountAmount = 0;
  if (input.discountType === "PERCENT") discountAmount = divRound(subtotal * Math.min(input.discountValue, 10000), 10000);
  else if (input.discountType === "FIXED") discountAmount = input.discountValue;
  discountAmount = Math.max(0, Math.min(discountAmount, subtotal));

  const taxableAmount = subtotal - discountAmount;
  const taxAmount = divRound(taxableAmount * input.taxRateBps, 10000);
  return { lineTotals, subtotal, discountAmount, taxableAmount, taxAmount, total: taxableAmount + taxAmount };
}

export function invoiceBalance(total: number, amountPaid: number): number {
  return Math.max(0, total - amountPaid);
}

/** Statuses whose balance counts as money owed to the business. */
export function isReceivable(status: string): boolean {
  return status === "SENT" || status === "OVERDUE" || status === "PAID";
}

/**
 * Status shown to the user. Stored status is the user's intent; we derive
 * PAID from payments and OVERDUE from the due date so they cannot drift out of sync.
 */
export function effectiveInvoiceStatus(
  inv: { status: string; total: number; amountPaid: number; dueDate: Date | string },
  today: string,
): InvoiceStatus {
  const status = inv.status as InvoiceStatus;
  if (status === "DRAFT" || status === "CANCELLED") return status;
  // Issued invoices with nothing left to pay (including zero-total ones) are paid, never overdue.
  if (inv.amountPaid >= inv.total) return "PAID";
  const dueKey = (typeof inv.dueDate === "string" ? inv.dueDate : inv.dueDate.toISOString()).slice(0, 10);
  if (dueKey < today) return "OVERDUE";
  return status === "PAID" ? "SENT" : status;
}

/**
 * Stored status for an invoice given its intended status and paid amount.
 * Only DRAFT, SENT, PAID and CANCELLED are ever stored; OVERDUE is always derived from the due date.
 */
export function statusAfterPayment(current: string, total: number, amountPaid: number): InvoiceStatus {
  if (current === "CANCELLED") return "CANCELLED";
  if (current === "DRAFT" && amountPaid === 0) return "DRAFT";
  if (amountPaid >= total) return "PAID";
  return "SENT";
}
