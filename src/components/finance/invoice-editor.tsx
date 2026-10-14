"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useFieldArray, useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Plus, Trash2 } from "lucide-react";
import { invoiceSchema, type InvoiceFormValues, type InvoiceInput } from "@/lib/validation";
import { calculateInvoiceTotals } from "@/lib/calc/invoice";
import { currencySymbol, formatBps, parseMoney, parsePercentToBps } from "@/lib/money";
import { createInvoiceAction, updateInvoiceAction } from "@/server/actions/finance";
import { runClientAction } from "@/lib/client/actions";
import { useApp, useMoney } from "@/components/app/app-context";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Field, Input, Select, Textarea } from "@/components/ui/input";
import { cn } from "@/lib/utils";

export function InvoiceEditor({ invoiceId, initial, amountPaid = 0 }: { invoiceId?: string; initial: InvoiceFormValues; amountPaid?: number }) {
  const router = useRouter();
  const { options, workspace } = useApp();
  const money = useMoney();
  const form = useForm<InvoiceFormValues, unknown, InvoiceInput>({ resolver: zodResolver(invoiceSchema), defaultValues: initial });
  const { register, control, handleSubmit, formState, watch, setError, getValues, setValue } = form;
  const { fields, append, remove } = useFieldArray({ control, name: "items" });
  const errors = formState.errors;
  const sym = currencySymbol(workspace.currency);

  // useWatch returns a fresh copy on every change; watch("items") returns the same mutated array, which would freeze the memo.
  const items = useWatch({ control, name: "items" });
  const discountType = useWatch({ control, name: "discountType" });
  const discountValue = useWatch({ control, name: "discountValue" });
  const taxRate = useWatch({ control, name: "taxRate" });
  const customerId = useWatch({ control, name: "customerId" });

  // Live preview of totals using the same calculation the server uses.
  const preview = React.useMemo(() => {
    const parsed = (items ?? []).map((i) => {
      const q = /^\d{1,7}(\.\d{1,2})?$/.test(String(i.quantity).trim()) ? Number(i.quantity) : 0;
      return { quantity: q, unitPrice: parseMoney(String(i.unitPrice)) ?? 0 };
    });
    const dv =
      discountType === "PERCENT" ? (parsePercentToBps(String(discountValue ?? "")) ?? 0) : discountType === "FIXED" ? (parseMoney(String(discountValue ?? "")) ?? 0) : 0;
    return calculateInvoiceTotals({ items: parsed, discountType, discountValue: dv, taxRateBps: parsePercentToBps(String(taxRate ?? "")) ?? 0 });
  }, [items, discountType, discountValue, taxRate]);

  const projectId = useWatch({ control, name: "projectId" });
  // Projects for the chosen customer, plus the one already selected (so an existing link is never hidden).
  const projects = options.projects.filter((p) => !customerId || !p.customerId || p.customerId === customerId || p.id === projectId);

  const onSubmit = handleSubmit(async () => {
    const values = getValues();
    const res = invoiceId
      ? await runClientAction(updateInvoiceAction(invoiceId, values), { setError })
      : await runClientAction(createInvoiceAction(values), { setError });
    if (res?.data) router.push(`/finance/invoices/${res.data.id}`);
  });

  const itemErrors = errors.items as unknown as ({ description?: { message?: string }; quantity?: { message?: string }; unitPrice?: { message?: string } } | undefined)[] & { message?: string; root?: { message?: string } };

  return (
    <form onSubmit={onSubmit} noValidate className="grid gap-4 xl:grid-cols-[1fr_340px]">
      <div className="space-y-4">
        <Card>
          <CardHeader>
            <CardTitle>Details</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Customer" htmlFor="inv-customer" error={errors.customerId?.message} required>
                <Select
                  id="inv-customer"
                  {...register("customerId", {
                    onChange: (e) => {
                      // Drop a project that belongs to a different customer, so a hidden stale value is never saved.
                      const project = options.projects.find((p) => p.id === getValues("projectId"));
                      if (project?.customerId && project.customerId !== e.target.value) setValue("projectId", "");
                    },
                  })}
                  aria-invalid={!!errors.customerId}
                >
                  <option value="">Select a customer…</option>
                  {options.customers.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                      {c.company ? ` — ${c.company}` : ""}
                    </option>
                  ))}
                </Select>
              </Field>
              <Field label="Project (optional)" htmlFor="inv-project" error={errors.projectId?.message}>
                <Select id="inv-project" {...register("projectId")}>
                  <option value="">No project</option>
                  {projects.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name}
                    </option>
                  ))}
                </Select>
              </Field>
            </div>
            {options.customers.length === 0 && (
              <p className="rounded-md bg-warning-soft px-3 py-2 text-[13px] text-warning">
                You need a customer before creating an invoice. <Link href="/customers" className="font-medium underline">Add one in Customers</Link>.
              </p>
            )}
            <div className="grid gap-4 sm:grid-cols-4">
              <Field label="Invoice number" htmlFor="inv-number" error={errors.number?.message} required>
                <Input id="inv-number" {...register("number")} aria-invalid={!!errors.number} />
              </Field>
              <Field label="Issue date" htmlFor="inv-issue" error={errors.issueDate?.message} required>
                <Input id="inv-issue" type="date" {...register("issueDate")} />
              </Field>
              <Field label="Due date" htmlFor="inv-due" error={errors.dueDate?.message} required>
                <Input id="inv-due" type="date" {...register("dueDate")} aria-invalid={!!errors.dueDate} />
              </Field>
              <Field label="Status" htmlFor="inv-status" hint={amountPaid > 0 ? "Paid status is set from payments" : undefined}>
                <Select id="inv-status" {...register("status")}>
                  <option value="DRAFT" disabled={amountPaid > 0}>
                    Draft
                  </option>
                  <option value="SENT">Sent</option>
                  <option value="CANCELLED" disabled={amountPaid > 0}>
                    Cancelled
                  </option>
                </Select>
              </Field>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Line items</CardTitle>
          </CardHeader>
          <CardContent className="px-0">
            <div className="hidden grid-cols-[1fr_90px_130px_120px_36px] gap-2 border-y bg-surface-2/60 px-5 py-2 text-xs font-medium text-muted-foreground md:grid">
              <span>Description</span>
              <span>Qty</span>
              <span>Unit price ({sym})</span>
              <span className="text-right">Amount</span>
              <span />
            </div>
            <ul className="divide-y md:divide-y-0">
              {fields.map((f, i) => (
                <li key={f.id} className="grid grid-cols-[1fr_1fr] gap-2 px-5 py-3 md:grid-cols-[1fr_90px_130px_120px_36px] md:items-start md:py-2" data-testid="invoice-line">
                  <div className="col-span-2 md:col-span-1">
                    <Input
                      placeholder="Description of work or item"
                      {...register(`items.${i}.description`)}
                      aria-label={`Line ${i + 1} description`}
                      aria-invalid={!!itemErrors?.[i]?.description}
                    />
                    {itemErrors?.[i]?.description && <p className="mt-1 text-xs text-destructive">{itemErrors[i]?.description?.message}</p>}
                  </div>
                  <div>
                    <Input inputMode="decimal" {...register(`items.${i}.quantity`)} aria-label={`Line ${i + 1} quantity`} aria-invalid={!!itemErrors?.[i]?.quantity} className="tabular" />
                    {itemErrors?.[i]?.quantity && <p className="mt-1 text-xs text-destructive">{itemErrors[i]?.quantity?.message}</p>}
                  </div>
                  <div>
                    <Input
                      inputMode="decimal"
                      placeholder="0.00"
                      {...register(`items.${i}.unitPrice`)}
                      aria-label={`Line ${i + 1} unit price`}
                      aria-invalid={!!itemErrors?.[i]?.unitPrice}
                      className="tabular"
                    />
                    {itemErrors?.[i]?.unitPrice && <p className="mt-1 text-xs text-destructive">{itemErrors[i]?.unitPrice?.message}</p>}
                  </div>
                  <p className="flex h-9 items-center text-[13px] font-medium tabular md:justify-end">{money.format(preview.lineTotals[i] ?? 0)}</p>
                  <div className="flex h-9 items-center justify-end">
                    <Button variant="ghost" size="icon-sm" onClick={() => remove(i)} disabled={fields.length === 1} aria-label={`Remove line ${i + 1}`}>
                      <Trash2 />
                    </Button>
                  </div>
                </li>
              ))}
            </ul>
            {(itemErrors?.message || itemErrors?.root?.message) && <p className="px-5 text-xs text-destructive">{itemErrors.message ?? itemErrors.root?.message}</p>}
            <div className="px-5 pt-2">
              <Button variant="outline" size="sm" onClick={() => append({ description: "", quantity: "1", unitPrice: "" })} disabled={fields.length >= 100}>
                <Plus /> Add line
              </Button>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Notes & terms</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-4 sm:grid-cols-2">
            <Field label="Notes to customer" htmlFor="inv-notes">
              <Textarea id="inv-notes" rows={3} {...register("notes")} placeholder="Thank you for your business." />
            </Field>
            <Field label="Payment terms" htmlFor="inv-terms">
              <Textarea id="inv-terms" rows={3} {...register("terms")} placeholder="Bank details, payment window, late fees…" />
            </Field>
          </CardContent>
        </Card>
      </div>

      <div className="space-y-4 xl:sticky xl:top-20 xl:self-start">
        <Card>
          <CardHeader>
            <CardTitle>Tax & discount</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-4">
            <div className="grid grid-cols-2 gap-3">
              <Field label="Discount" htmlFor="inv-dtype">
                <Select
                  id="inv-dtype"
                  {...register("discountType", {
                    onChange: () => setValue("discountValue", ""),
                  })}
                >
                  <option value="NONE">None</option>
                  <option value="PERCENT">Percent (%)</option>
                  <option value="FIXED">Fixed ({sym})</option>
                </Select>
              </Field>
              <Field label={discountType === "PERCENT" ? "Discount %" : `Amount (${sym})`} htmlFor="inv-dval" error={(errors.discountValue as { message?: string } | undefined)?.message}>
                <Input id="inv-dval" inputMode="decimal" disabled={discountType === "NONE"} {...register("discountValue")} placeholder="0" />
              </Field>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Tax label" htmlFor="inv-taxlabel">
                <Input id="inv-taxlabel" {...register("taxLabel")} placeholder="GST" />
              </Field>
              <Field label="Tax rate %" htmlFor="inv-tax" error={errors.taxRate?.message}>
                <Input id="inv-tax" inputMode="decimal" {...register("taxRate")} placeholder="18" />
              </Field>
            </div>
            <p className="text-xs text-muted-foreground">Tax is applied to the subtotal after discount. Amounts round to the nearest paisa (half away from zero).</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Summary</CardTitle>
          </CardHeader>
          <CardContent>
            <dl className="space-y-2 text-[13px]">
              <div className="flex justify-between">
                <dt className="text-muted-foreground">Subtotal</dt>
                <dd className="tabular">{money.format(preview.subtotal)}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-muted-foreground">
                  Discount{discountType === "PERCENT" && parsePercentToBps(String(discountValue ?? "")) ? ` (${formatBps(parsePercentToBps(String(discountValue))!)})` : ""}
                </dt>
                <dd className="tabular">−{money.format(preview.discountAmount)}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-muted-foreground">
                  {watch("taxLabel") || "Tax"} ({formatBps(parsePercentToBps(String(taxRate ?? "")) ?? 0)})
                </dt>
                <dd className="tabular">{money.format(preview.taxAmount)}</dd>
              </div>
              <div className="flex justify-between border-t pt-2 text-[15px] font-semibold">
                <dt>Total</dt>
                <dd className="tabular" data-testid="invoice-total-preview">
                  {money.format(preview.total)}
                </dd>
              </div>
              {amountPaid > 0 && (
                <div className={cn("flex justify-between text-xs", preview.total < amountPaid ? "text-destructive" : "text-muted-foreground")}>
                  <dt>Already paid</dt>
                  <dd className="tabular">{money.format(amountPaid)}</dd>
                </div>
              )}
            </dl>
            <div className="mt-5 flex flex-col gap-2">
              <Button type="submit" loading={formState.isSubmitting} disabled={options.customers.length === 0}>
                {invoiceId ? "Save invoice" : "Create invoice"}
              </Button>
              <Button variant="outline" onClick={() => router.push(invoiceId ? `/finance/invoices/${invoiceId}` : "/finance/invoices")}>
                Cancel
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </form>
  );
}
