"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Ban, Download, MoreHorizontal, Pencil, Printer, Send, Trash2, Wallet } from "lucide-react";
import { paymentSchema, type PaymentFormValues, type PaymentInput } from "@/lib/validation";
import { PAYMENT_METHODS } from "@/lib/constants";
import { currencySymbol, minorToInput } from "@/lib/money";
import { deleteInvoiceAction, deletePaymentAction, recordPaymentAction, setInvoiceStatusAction } from "@/server/actions/finance";
import { runClientAction } from "@/lib/client/actions";
import { useApp, useMoney } from "@/components/app/app-context";
import { Button } from "@/components/ui/button";
import { Dialog, DialogBody, DialogContent, DialogFooter } from "@/components/ui/dialog";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { Field, Input, Select, Textarea } from "@/components/ui/input";
import { downloadInvoicePdf, type PdfInvoice } from "./invoice-pdf";

export function InvoiceActions({ id, status, storedStatus, balance, hasPayments, pdf }: { id: string; status: string; storedStatus: string; balance: number; hasPayments: boolean; pdf: PdfInvoice }) {
  const router = useRouter();
  const [payOpen, setPayOpen] = React.useState(false);
  const [confirm, setConfirm] = React.useState<"delete" | "cancel" | null>(null);
  const [pdfLoading, setPdfLoading] = React.useState(false);
  const canPay = (storedStatus === "SENT" || storedStatus === "OVERDUE") && balance > 0;

  return (
    <>
      {storedStatus === "DRAFT" && (
        <Button size="sm" onClick={() => runClientAction(setInvoiceStatusAction(id, "SENT"), { success: "Marked as sent" })}>
          <Send /> Mark as sent
        </Button>
      )}
      {canPay && (
        <Button size="sm" onClick={() => setPayOpen(true)} data-testid="record-payment">
          <Wallet /> Record payment
        </Button>
      )}
      <Button
        variant="outline"
        size="sm"
        loading={pdfLoading}
        onClick={async () => {
          setPdfLoading(true);
          try {
            await downloadInvoicePdf(pdf);
          } finally {
            setPdfLoading(false);
          }
        }}
      >
        <Download /> PDF
      </Button>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="outline" size="icon-sm" aria-label="More invoice actions">
            <MoreHorizontal />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent className="w-52">
          <DropdownMenuItem asChild>
            <Link href={`/finance/invoices/${id}/edit`}>
              <Pencil /> Edit invoice
            </Link>
          </DropdownMenuItem>
          <DropdownMenuItem onSelect={() => window.print()}>
            <Printer /> Print
          </DropdownMenuItem>
          {status !== "CANCELLED" && !hasPayments && (
            <DropdownMenuItem onSelect={() => setConfirm("cancel")}>
              <Ban /> Cancel invoice
            </DropdownMenuItem>
          )}
          <DropdownMenuSeparator />
          <DropdownMenuItem destructive disabled={hasPayments} onSelect={() => setConfirm("delete")}>
            <Trash2 /> {hasPayments ? "Delete (remove payments first)" : "Delete invoice"}
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <PaymentDialog open={payOpen} onOpenChange={setPayOpen} invoiceId={id} balance={balance} />
      <ConfirmDialog
        open={confirm === "delete"}
        onOpenChange={(o) => !o && setConfirm(null)}
        title={`Delete ${pdf.number}?`}
        description="The invoice and its line items will be permanently deleted."
        onConfirm={async () => {
          const res = await runClientAction(deleteInvoiceAction(id));
          if (res) router.push("/finance/invoices");
          return !!res;
        }}
      />
      <ConfirmDialog
        open={confirm === "cancel"}
        onOpenChange={(o) => !o && setConfirm(null)}
        title={`Cancel ${pdf.number}?`}
        description="Cancelled invoices are kept for your records but excluded from outstanding balances."
        confirmLabel="Cancel invoice"
        onConfirm={async () => !!(await runClientAction(setInvoiceStatusAction(id, "CANCELLED")))}
      />
    </>
  );
}

export function PaymentDialog({ open, onOpenChange, invoiceId, balance }: { open: boolean; onOpenChange: (o: boolean) => void; invoiceId: string; balance: number }) {
  const { today, workspace } = useApp();
  const money = useMoney();
  const defaults = React.useMemo<PaymentFormValues>(() => ({ amount: minorToInput(balance), date: today, method: "Bank transfer", reference: "", notes: "" }), [balance, today]);
  const form = useForm<PaymentFormValues, unknown, PaymentInput>({ resolver: zodResolver(paymentSchema), defaultValues: defaults });
  const { register, handleSubmit, formState, reset, setError, getValues } = form;
  React.useEffect(() => {
    if (open) reset(defaults);
  }, [open, defaults, reset]);
  const onSubmit = handleSubmit(async () => {
    const res = await runClientAction(recordPaymentAction(invoiceId, getValues()), { setError });
    if (res) onOpenChange(false);
  });
  const e = formState.errors;
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent size="sm" title="Record payment" description={`Outstanding balance: ${money.format(balance)}. An income transaction is created automatically.`}>
        <form onSubmit={onSubmit} noValidate>
          <DialogBody>
            <div className="grid grid-cols-2 gap-3">
              <Field label={`Amount (${currencySymbol(workspace.currency)})`} htmlFor="pay-amount" error={e.amount?.message} required>
                <Input id="pay-amount" inputMode="decimal" {...register("amount")} aria-invalid={!!e.amount} className="tabular" />
              </Field>
              <Field label="Date" htmlFor="pay-date" error={e.date?.message} required>
                <Input id="pay-date" type="date" {...register("date")} />
              </Field>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Method" htmlFor="pay-method">
                <Select id="pay-method" {...register("method")}>
                  {PAYMENT_METHODS.map((m) => (
                    <option key={m}>{m}</option>
                  ))}
                </Select>
              </Field>
              <Field label="Reference" htmlFor="pay-ref">
                <Input id="pay-ref" {...register("reference")} placeholder="UTR / cheque no." />
              </Field>
            </div>
            <Field label="Notes" htmlFor="pay-notes">
              <Textarea id="pay-notes" rows={2} {...register("notes")} />
            </Field>
          </DialogBody>
          <DialogFooter>
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" loading={formState.isSubmitting}>
              Record payment
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export function DeletePaymentButton({ paymentId, label }: { paymentId: string; label: string }) {
  const [open, setOpen] = React.useState(false);
  return (
    <>
      <Button variant="ghost" size="icon-xs" aria-label={`Remove payment ${label}`} onClick={() => setOpen(true)}>
        <Trash2 />
      </Button>
      <ConfirmDialog
        open={open}
        onOpenChange={setOpen}
        title="Remove this payment?"
        description={`The payment of ${label} and its linked income transaction will be deleted, and the invoice balance recalculated.`}
        confirmLabel="Remove payment"
        onConfirm={async () => !!(await runClientAction(deletePaymentAction(paymentId)))}
      />
    </>
  );
}
