import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { getContext } from "@/server/workspace";
import { getInvoice } from "@/lib/services/invoices";
import { orNotFound } from "@/server/load";
import { INVOICE_STATUS } from "@/lib/constants";
import { formatDate } from "@/lib/dates";
import { formatBps, formatMoney } from "@/lib/money";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { StatusBadge } from "@/components/ui/badge";
import { LogoMark } from "@/components/app/logo";
import { DeletePaymentButton, InvoiceActions } from "@/components/finance/invoice-actions";

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { workspaceId, today } = await getContext();
  const inv = await getInvoice(workspaceId, id, today).catch(() => null);
  return { title: inv?.number ?? "Invoice" };
}

export default async function InvoicePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { workspaceId, today } = await getContext();
  const inv = await orNotFound(getInvoice(workspaceId, id, today));
  const m = (v: number) => formatMoney(v, inv.currency);

  return (
    <div className="space-y-6">
      <div className="no-print flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <Link href="/finance/invoices" className="mb-3 inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground">
            <ArrowLeft className="size-3.5" /> Invoices
          </Link>
          <div className="flex items-center gap-2">
            <h1 className="text-xl font-semibold tracking-tight sm:text-[22px]">{inv.number}</h1>
            <StatusBadge options={INVOICE_STATUS} value={inv.effectiveStatus} />
          </div>
          <p className="mt-1 text-[13px] text-muted-foreground">
            <Link href={`/customers/${inv.customer.id}`} className="hover:underline">
              {inv.customer.name}
            </Link>
            {inv.project && (
              <>
                {" · "}
                <Link href={`/projects/${inv.project.id}`} className="hover:underline">
                  {inv.project.name}
                </Link>
              </>
            )}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <InvoiceActions
            id={inv.id}
            status={inv.effectiveStatus}
            storedStatus={inv.status}
            balance={inv.balance}
            hasPayments={inv.payments.length > 0}
            pdf={{
              number: inv.number,
              status: inv.effectiveStatus,
              issueDate: inv.issueDate,
              dueDate: inv.dueDate,
              currency: inv.currency,
              subtotal: inv.subtotal,
              discountAmount: inv.discountAmount,
              discountType: inv.discountType,
              discountValue: inv.discountValue,
              taxAmount: inv.taxAmount,
              taxRateBps: inv.taxRateBps,
              taxLabel: inv.taxLabel,
              total: inv.total,
              amountPaid: inv.amountPaid,
              notes: inv.notes,
              terms: inv.terms,
              from: { name: inv.workspace.name, owner: inv.workspace.ownerName, email: inv.workspace.ownerEmail },
              to: { name: inv.customer.name, company: inv.customer.company, email: inv.customer.email, phone: inv.customer.phone },
              items: inv.items,
            }}
          />
        </div>
      </div>

      <div className="grid gap-4 xl:grid-cols-[1fr_320px]">
        <Card className="print-area mx-auto w-full max-w-[860px] p-6 sm:p-10" data-testid="invoice-document">
          <div className="flex flex-col justify-between gap-6 sm:flex-row">
            <div className="flex items-center gap-3">
              <LogoMark className="size-9" />
              <div>
                <p className="font-semibold">{inv.workspace.name}</p>
                <p className="text-xs text-muted-foreground">{[inv.workspace.ownerName, inv.workspace.ownerEmail].filter(Boolean).join(" · ")}</p>
              </div>
            </div>
            <div className="sm:text-right">
              <p className="text-2xl font-semibold tracking-tight">Invoice</p>
              <p className="text-sm text-muted-foreground">{inv.number}</p>
            </div>
          </div>

          <div className="mt-10 grid gap-6 sm:grid-cols-3">
            <div>
              <p className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">Bill to</p>
              <p className="mt-1.5 text-sm font-medium">{inv.customer.company ?? inv.customer.name}</p>
              {inv.customer.company && <p className="text-[13px] text-muted-foreground">{inv.customer.name}</p>}
              {inv.customer.email && <p className="text-[13px] text-muted-foreground">{inv.customer.email}</p>}
              {inv.customer.phone && <p className="text-[13px] text-muted-foreground">{inv.customer.phone}</p>}
            </div>
            <div>
              <p className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">Issue date</p>
              <p className="mt-1.5 text-sm">{formatDate(inv.issueDate)}</p>
              <p className="mt-3 text-[11px] font-medium uppercase tracking-wider text-muted-foreground">Due date</p>
              <p className="mt-1.5 text-sm">{formatDate(inv.dueDate)}</p>
            </div>
            <div className="sm:text-right">
              <p className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">Balance due</p>
              <p className="mt-1.5 text-2xl font-semibold tabular" data-testid="invoice-balance">
                {inv.status === "CANCELLED" || inv.status === "DRAFT" ? m(inv.total) : m(inv.balance)}
              </p>
            </div>
          </div>

          <div className="relative mt-10 overflow-x-auto">
            <table className="w-full min-w-[480px] text-sm">
              <thead>
                <tr className="border-b text-left text-xs text-muted-foreground">
                  <th className="pb-2 font-medium">Description</th>
                  <th className="pb-2 text-right font-medium">Qty</th>
                  <th className="pb-2 text-right font-medium">Unit price</th>
                  <th className="pb-2 text-right font-medium">Amount</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {inv.items.map((item) => (
                  <tr key={item.id}>
                    <td className="py-3 pr-4">{item.description}</td>
                    <td className="py-3 text-right tabular">{item.quantity}</td>
                    <td className="py-3 text-right tabular">{m(item.unitPrice)}</td>
                    <td className="py-3 text-right font-medium tabular">{m(item.lineTotal)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="mt-6 flex justify-end">
            <dl className="w-full max-w-xs space-y-2 text-sm">
              <div className="flex justify-between">
                <dt className="text-muted-foreground">Subtotal</dt>
                <dd className="tabular">{m(inv.subtotal)}</dd>
              </div>
              {inv.discountAmount > 0 && (
                <div className="flex justify-between">
                  <dt className="text-muted-foreground">Discount{inv.discountType === "PERCENT" ? ` (${formatBps(inv.discountValue)})` : ""}</dt>
                  <dd className="tabular">−{m(inv.discountAmount)}</dd>
                </div>
              )}
              <div className="flex justify-between">
                <dt className="text-muted-foreground">
                  {inv.taxLabel || "Tax"} ({formatBps(inv.taxRateBps)})
                </dt>
                <dd className="tabular">{m(inv.taxAmount)}</dd>
              </div>
              <div className="flex justify-between border-t pt-2 text-base font-semibold">
                <dt>Total</dt>
                <dd className="tabular" data-testid="invoice-total">
                  {m(inv.total)}
                </dd>
              </div>
              {inv.amountPaid > 0 && (
                <>
                  <div className="flex justify-between text-success">
                    <dt>Paid</dt>
                    <dd className="tabular">−{m(inv.amountPaid)}</dd>
                  </div>
                  <div className="flex justify-between font-semibold">
                    <dt>Balance due</dt>
                    <dd className="tabular">{m(inv.balance)}</dd>
                  </div>
                </>
              )}
            </dl>
          </div>

          {(inv.notes || inv.terms) && (
            <div className="mt-10 grid gap-6 border-t pt-6 text-[13px] sm:grid-cols-2">
              {inv.notes && (
                <div>
                  <p className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">Notes</p>
                  <p className="mt-1.5 whitespace-pre-wrap leading-relaxed">{inv.notes}</p>
                </div>
              )}
              {inv.terms && (
                <div>
                  <p className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">Terms</p>
                  <p className="mt-1.5 whitespace-pre-wrap leading-relaxed">{inv.terms}</p>
                </div>
              )}
            </div>
          )}
        </Card>

        <div className="no-print space-y-4">
          <Card>
            <CardHeader>
              <div>
                <CardTitle>Payments</CardTitle>
                <CardDescription>
                  {m(inv.amountPaid)} of {m(inv.total)} received
                </CardDescription>
              </div>
            </CardHeader>
            <CardContent>
              {inv.payments.length ? (
                <ul className="space-y-2">
                  {inv.payments.map((p) => (
                    <li key={p.id} className="flex items-center gap-2 rounded-md border px-3 py-2 text-[13px]" data-testid="payment-row">
                      <span className="flex-1">
                        <span className="block font-medium tabular">{m(p.amount)}</span>
                        <span className="block text-xs text-muted-foreground">
                          {formatDate(p.date)}
                          {p.method ? ` · ${p.method}` : ""}
                          {p.reference ? ` · ${p.reference}` : ""}
                        </span>
                      </span>
                      <DeletePaymentButton paymentId={p.id} label={m(p.amount)} />
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-[13px] text-muted-foreground">
                  {inv.status === "DRAFT" ? "Mark the invoice as sent to start recording payments." : inv.status === "CANCELLED" ? "This invoice is cancelled." : "No payments recorded yet."}
                </p>
              )}
            </CardContent>
          </Card>
          <Card>
            <CardContent className="space-y-1.5 pt-4 text-xs text-muted-foreground">
              <p>Recording a payment also creates a linked income transaction in Finance, so revenue is counted once.</p>
              <p>“Paid” and “Overdue” are derived automatically from payments and the due date.</p>
              <p>NEXUS does not email invoices. Download the PDF and send it yourself.</p>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
