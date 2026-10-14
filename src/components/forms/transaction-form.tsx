"use client";

import * as React from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { transactionSchema, type TransactionFormValues, type TransactionInput } from "@/lib/validation";
import { EXPENSE_CATEGORIES, INCOME_CATEGORIES, PAYMENT_METHODS } from "@/lib/constants";
import { dateToKey, todayKey } from "@/lib/dates";
import { currencySymbol, minorToInput } from "@/lib/money";
import { createTransactionAction, updateTransactionAction } from "@/server/actions/finance";
import { runClientAction } from "@/lib/client/actions";
import { Dialog, DialogBody, DialogContent, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Field, Input, Select, Textarea } from "@/components/ui/input";
import { useApp, type CreateDefaults } from "@/components/app/app-context";
import { cn } from "@/lib/utils";

export type TransactionRecord = {
  id: string;
  description: string;
  amount: number;
  type: string;
  category: string;
  date: Date;
  paymentMethod: string | null;
  reference: string | null;
  customerId: string | null;
  projectId: string | null;
  notes: string | null;
};

function toValues(t: TransactionRecord | null | undefined, today: string, defaults?: CreateDefaults): TransactionFormValues {
  const type = (t?.type ?? (defaults?.type as string) ?? "EXPENSE") as "INCOME" | "EXPENSE";
  return {
    description: t?.description ?? "",
    amount: t ? minorToInput(t.amount) : "",
    type,
    category: t?.category ?? (type === "INCOME" ? INCOME_CATEGORIES[0] : EXPENSE_CATEGORIES[0]),
    date: t ? dateToKey(t.date) : today,
    paymentMethod: t?.paymentMethod ?? "",
    reference: t?.reference ?? "",
    customerId: t?.customerId ?? (defaults?.customerId as string) ?? "",
    projectId: t?.projectId ?? (defaults?.projectId as string) ?? "",
    notes: t?.notes ?? "",
  };
}

export function TransactionDialog({
  open,
  onOpenChange,
  transaction,
  defaults,
  categories = [],
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  transaction?: TransactionRecord | null;
  defaults?: CreateDefaults;
  categories?: string[];
}) {
  const { options, workspace } = useApp();
  // Computed when the dialog opens, so a tab left open overnight still defaults to the real today.
  const today = React.useMemo(() => (open ? todayKey(workspace.timezone) : ""), [open, workspace.timezone]);
  const form = useForm<TransactionFormValues, unknown, TransactionInput>({
    resolver: zodResolver(transactionSchema),
    defaultValues: toValues(transaction, today, defaults),
  });
  const { register, handleSubmit, formState, reset, setError, getValues, watch, setValue } = form;
  const errors = formState.errors;
  const type = watch("type");

  React.useEffect(() => {
    if (open) reset(toValues(transaction, today, defaults));
    // Reset when the dialog opens or switches record, not when a refresh hands over a new object for the same one.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, transaction?.id, today, defaults, reset]);

  const base = type === "INCOME" ? INCOME_CATEGORIES.filter((c) => c !== "Invoice payment") : EXPENSE_CATEGORIES;
  const categoryList = [...new Set([...base, ...categories.filter((c) => c !== "Invoice payment" && !(type === "INCOME" ? EXPENSE_CATEGORIES : INCOME_CATEGORIES).includes(c))])];

  const onSubmit = handleSubmit(async () => {
    const values = getValues();
    const res = transaction
      ? await runClientAction(updateTransactionAction(transaction.id, values), { setError })
      : await runClientAction(createTransactionAction(values), { setError });
    if (res) onOpenChange(false);
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        size="lg"
        title={transaction ? "Edit transaction" : "Record transaction"}
        description="For invoice payments, use “Record payment” on the invoice so revenue is counted once."
      >
        <form onSubmit={onSubmit} noValidate>
          <DialogBody>
            <div className="grid grid-cols-2 gap-1 rounded-lg bg-muted p-1" role="radiogroup" aria-label="Transaction type">
              {(["INCOME", "EXPENSE"] as const).map((t) => (
                <button
                  key={t}
                  type="button"
                  role="radio"
                  aria-checked={type === t}
                  onClick={() => {
                    setValue("type", t);
                    setValue("category", t === "INCOME" ? INCOME_CATEGORIES[0] : EXPENSE_CATEGORIES[0]);
                  }}
                  className={cn(
                    "h-8 rounded-md text-[13px] font-medium transition-colors",
                    type === t ? "bg-surface shadow-sm" : "text-muted-foreground hover:text-foreground",
                    type === t && (t === "INCOME" ? "text-success" : "text-destructive"),
                  )}
                >
                  {t === "INCOME" ? "Income" : "Expense"}
                </button>
              ))}
            </div>
            <div className="grid gap-4 sm:grid-cols-[1fr_180px]">
              <Field label="Description" htmlFor="t-desc" error={errors.description?.message} required>
                <Input id="t-desc" {...register("description")} aria-invalid={!!errors.description} placeholder="e.g. Figma subscription" autoFocus={!transaction} />
              </Field>
              <Field label={`Amount (${currencySymbol(workspace.currency)})`} htmlFor="t-amount" error={errors.amount?.message} required>
                <Input id="t-amount" inputMode="decimal" {...register("amount")} aria-invalid={!!errors.amount} placeholder="0.00" className="tabular" />
              </Field>
            </div>
            <div className="grid gap-4 sm:grid-cols-3">
              <Field label="Category" htmlFor="t-cat" error={errors.category?.message}>
                <Select id="t-cat" {...register("category")}>
                  {categoryList.map((c) => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
                </Select>
              </Field>
              <Field label="Date" htmlFor="t-date" error={errors.date?.message} required>
                <Input id="t-date" type="date" {...register("date")} aria-invalid={!!errors.date} />
              </Field>
              <Field label="Payment method" htmlFor="t-method">
                <Select id="t-method" {...register("paymentMethod")}>
                  <option value="">—</option>
                  {PAYMENT_METHODS.map((m) => (
                    <option key={m} value={m}>
                      {m}
                    </option>
                  ))}
                </Select>
              </Field>
            </div>
            <div className="grid gap-4 sm:grid-cols-3">
              <Field label="Reference" htmlFor="t-ref">
                <Input id="t-ref" {...register("reference")} placeholder="Receipt / UTR no." />
              </Field>
              <Field label="Customer" htmlFor="t-customer">
                <Select id="t-customer" {...register("customerId")}>
                  <option value="">None</option>
                  {options.customers.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </Select>
              </Field>
              <Field label="Project" htmlFor="t-project">
                <Select id="t-project" {...register("projectId")}>
                  <option value="">None</option>
                  {options.projects.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name}
                    </option>
                  ))}
                </Select>
              </Field>
            </div>
            <Field label="Notes" htmlFor="t-notes">
              <Textarea id="t-notes" rows={2} {...register("notes")} />
            </Field>
          </DialogBody>
          <DialogFooter>
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" loading={formState.isSubmitting}>
              {transaction ? "Save changes" : "Record transaction"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
