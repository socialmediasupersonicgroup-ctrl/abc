"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { customerSchema, type CustomerFormValues, type CustomerInput } from "@/lib/validation";
import { CUSTOMER_STATUS, LEAD_SOURCES } from "@/lib/constants";
import { dateToKey } from "@/lib/dates";
import { currencySymbol, minorToInput } from "@/lib/money";
import { createCustomerAction, updateCustomerAction } from "@/server/actions/customers";
import { runClientAction } from "@/lib/client/actions";
import { Dialog, DialogBody, DialogContent, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Field, Input, Select, Textarea } from "@/components/ui/input";
import { useApp } from "@/components/app/app-context";

export type CustomerRecord = {
  id: string;
  name: string;
  company: string | null;
  email: string | null;
  phone: string | null;
  status: string;
  source: string | null;
  dealValue: number;
  notes: string | null;
  lastContactAt: Date | null;
  nextFollowUpAt: Date | null;
};

function toValues(c?: CustomerRecord | null): CustomerFormValues {
  return {
    name: c?.name ?? "",
    company: c?.company ?? "",
    email: c?.email ?? "",
    phone: c?.phone ?? "",
    status: (c?.status ?? "LEAD") as CustomerFormValues["status"],
    source: c?.source ?? "",
    dealValue: c ? minorToInput(c.dealValue) : "",
    notes: c?.notes ?? "",
    lastContactAt: c?.lastContactAt ? dateToKey(c.lastContactAt) : "",
    nextFollowUpAt: c?.nextFollowUpAt ? dateToKey(c.nextFollowUpAt) : "",
  };
}

export function CustomerDialog({ open, onOpenChange, customer }: { open: boolean; onOpenChange: (open: boolean) => void; customer?: CustomerRecord | null }) {
  const { workspace } = useApp();
  const router = useRouter();
  const form = useForm<CustomerFormValues, unknown, CustomerInput>({ resolver: zodResolver(customerSchema), defaultValues: toValues(customer) });
  const { register, handleSubmit, formState, reset, setError, getValues } = form;
  const errors = formState.errors;

  React.useEffect(() => {
    if (open) reset(toValues(customer));
  }, [open, customer, reset]);

  const onSubmit = handleSubmit(async () => {
    const values = getValues();
    if (customer) {
      const res = await runClientAction(updateCustomerAction(customer.id, values), { setError });
      if (res) onOpenChange(false);
    } else {
      const res = await runClientAction(createCustomerAction(values), { setError });
      if (res?.data) {
        onOpenChange(false);
        router.push(`/customers/${res.data.id}`);
      }
    }
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent size="lg" title={customer ? "Edit customer" : "New customer"}>
        <form onSubmit={onSubmit} noValidate>
          <DialogBody>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Full name" htmlFor="c-name" error={errors.name?.message} required>
                <Input id="c-name" {...register("name")} aria-invalid={!!errors.name} autoFocus={!customer} placeholder="e.g. Ananya Rao" />
              </Field>
              <Field label="Company" htmlFor="c-company">
                <Input id="c-company" {...register("company")} placeholder="Company name" />
              </Field>
              <Field label="Email" htmlFor="c-email" error={errors.email?.message}>
                <Input id="c-email" type="email" {...register("email")} aria-invalid={!!errors.email} placeholder="name@company.com" />
              </Field>
              <Field label="Phone" htmlFor="c-phone" error={errors.phone?.message}>
                <Input id="c-phone" type="tel" {...register("phone")} aria-invalid={!!errors.phone} placeholder="+91 98xxx xxxxx" />
              </Field>
            </div>
            <div className="grid gap-4 sm:grid-cols-3">
              <Field label="Status" htmlFor="c-status">
                <Select id="c-status" {...register("status")}>
                  {CUSTOMER_STATUS.list.map((s) => (
                    <option key={s.value} value={s.value}>
                      {s.label}
                    </option>
                  ))}
                </Select>
              </Field>
              <Field label="Lead source" htmlFor="c-source">
                <Select id="c-source" {...register("source")}>
                  <option value="">Unknown</option>
                  {LEAD_SOURCES.map((s) => (
                    <option key={s} value={s}>
                      {s}
                    </option>
                  ))}
                </Select>
              </Field>
              <Field label={`Potential deal value (${currencySymbol(workspace.currency)})`} htmlFor="c-deal" error={errors.dealValue?.message}>
                <Input id="c-deal" inputMode="decimal" {...register("dealValue")} aria-invalid={!!errors.dealValue} placeholder="0.00" />
              </Field>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Last contacted" htmlFor="c-last" error={errors.lastContactAt?.message}>
                <Input id="c-last" type="date" {...register("lastContactAt")} />
              </Field>
              <Field label="Next follow-up" htmlFor="c-next" error={errors.nextFollowUpAt?.message} hint="Shows up in notifications when due.">
                <Input id="c-next" type="date" {...register("nextFollowUpAt")} />
              </Field>
            </div>
            <Field label="Notes" htmlFor="c-notes">
              <Textarea id="c-notes" rows={4} {...register("notes")} placeholder="Context, preferences, history…" />
            </Field>
          </DialogBody>
          <DialogFooter>
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" loading={formState.isSubmitting}>
              {customer ? "Save changes" : "Add customer"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
