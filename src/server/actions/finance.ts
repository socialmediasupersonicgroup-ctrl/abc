"use server";

import {
  invoiceSchema,
  invoiceStatusSchema,
  paymentSchema,
  transactionSchema,
  type InvoiceFormValues,
  type PaymentFormValues,
  type TransactionFormValues,
} from "@/lib/validation";
import * as txns from "@/lib/services/transactions";
import * as invoices from "@/lib/services/invoices";
import { getContext } from "@/server/workspace";
import { assertId, parseInput, runAction } from "@/server/action-utils";

export async function createTransactionAction(values: TransactionFormValues) {
  return runAction(async () => {
    const { workspaceId } = await getContext();
    const t = await txns.createTransaction(workspaceId, parseInput(transactionSchema, values));
    return { id: t.id };
  }, "Transaction recorded");
}

export async function updateTransactionAction(id: string, values: TransactionFormValues) {
  return runAction(async () => {
    const { workspaceId } = await getContext();
    await txns.updateTransaction(workspaceId, assertId(id), parseInput(transactionSchema, values));
    return { id };
  }, "Transaction updated");
}

export async function deleteTransactionAction(id: string) {
  return runAction(async () => {
    const { workspaceId } = await getContext();
    await txns.deleteTransaction(workspaceId, assertId(id));
  }, "Transaction deleted");
}

export async function createInvoiceAction(values: InvoiceFormValues) {
  return runAction(async () => {
    const { workspaceId, currency } = await getContext();
    const inv = await invoices.createInvoice(workspaceId, currency, parseInput(invoiceSchema, values));
    return { id: inv.id };
  }, "Invoice saved");
}

export async function updateInvoiceAction(id: string, values: InvoiceFormValues) {
  return runAction(async () => {
    const { workspaceId } = await getContext();
    await invoices.updateInvoice(workspaceId, assertId(id), parseInput(invoiceSchema, values));
    return { id };
  }, "Invoice updated");
}

export async function setInvoiceStatusAction(id: string, status: string) {
  return runAction(async () => {
    const { workspaceId } = await getContext();
    await invoices.setInvoiceStatus(workspaceId, assertId(id), parseInput(invoiceStatusSchema, status));
  }, "Invoice status updated");
}

export async function deleteInvoiceAction(id: string) {
  return runAction(async () => {
    const { workspaceId } = await getContext();
    await invoices.deleteInvoice(workspaceId, assertId(id));
  }, "Invoice deleted");
}

export async function recordPaymentAction(invoiceId: string, values: PaymentFormValues) {
  return runAction(async () => {
    const { workspaceId } = await getContext();
    const p = await invoices.recordPayment(workspaceId, assertId(invoiceId), parseInput(paymentSchema, values));
    return { id: p.id };
  }, "Payment recorded");
}

export async function deletePaymentAction(paymentId: string) {
  return runAction(async () => {
    const { workspaceId } = await getContext();
    await invoices.deletePayment(workspaceId, assertId(paymentId));
  }, "Payment removed");
}
