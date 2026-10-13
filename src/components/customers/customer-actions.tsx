"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { CalendarPlus, Check, Copy, FileText, FolderPlus, MoreHorizontal, NotebookPen, Pencil, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { Input, Textarea, Field } from "@/components/ui/input";
import { CustomerDialog, type CustomerRecord } from "@/components/forms/customer-form";
import { addCustomerNoteAction, deleteCustomerAction, logContactAction } from "@/server/actions/customers";
import { runClientAction } from "@/lib/client/actions";
import { useApp } from "@/components/app/app-context";
import { addDaysToKey } from "@/lib/dates";
import { copyText } from "@/components/forms/content-form";

export function CustomerActions({ customer }: { customer: CustomerRecord }) {
  const router = useRouter();
  const { openCreate } = useApp();
  const [editOpen, setEditOpen] = React.useState(false);
  const [confirm, setConfirm] = React.useState(false);
  return (
    <>
      <Button variant="outline" size="sm" onClick={() => setEditOpen(true)}>
        <Pencil /> Edit
      </Button>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="outline" size="icon-sm" aria-label="More customer actions">
            <MoreHorizontal />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent className="w-52">
          <DropdownMenuItem asChild>
            <Link href={`/finance/invoices/new?customerId=${customer.id}`}>
              <FileText /> Create invoice
            </Link>
          </DropdownMenuItem>
          <DropdownMenuItem onSelect={() => openCreate("project", { customerId: customer.id })}>
            <FolderPlus /> New project
          </DropdownMenuItem>
          <DropdownMenuItem onSelect={() => openCreate("event", { customerId: customer.id })}>
            <CalendarPlus /> Schedule meeting
          </DropdownMenuItem>
          <DropdownMenuItem onSelect={() => openCreate("note", { customerId: customer.id })}>
            <NotebookPen /> New linked note
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem destructive onSelect={() => setConfirm(true)}>
            <Trash2 /> Delete customer
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
      <CustomerDialog open={editOpen} onOpenChange={setEditOpen} customer={customer} />
      <ConfirmDialog
        open={confirm}
        onOpenChange={setConfirm}
        title={`Delete ${customer.name}?`}
        description="The customer record will be deleted. Linked projects, tasks, events and notes are kept but unlinked. Customers with invoices cannot be deleted."
        onConfirm={async () => {
          const res = await runClientAction(deleteCustomerAction(customer.id));
          if (res) router.push("/customers");
          return !!res;
        }}
      />
    </>
  );
}

export function CopyButton({ value, label }: { value: string; label: string }) {
  const [done, setDone] = React.useState(false);
  return (
    <button
      type="button"
      onClick={async () => {
        await copyText(value, `${label} copied`);
        setDone(true);
        setTimeout(() => setDone(false), 1500);
      }}
      className="rounded p-1 text-muted-foreground hover:bg-accent hover:text-foreground"
      aria-label={`Copy ${label.toLowerCase()}`}
    >
      {done ? <Check className="size-3.5 text-success" /> : <Copy className="size-3.5" />}
    </button>
  );
}

export function FollowUpCard({ customerId, next }: { customerId: string; next: string | null }) {
  const { today } = useApp();
  // A due or overdue follow-up is what's being completed now, so suggest a fresh date rather than re-saving it.
  const suggested = next && next > today ? next : addDaysToKey(today, 7);
  const [date, setDate] = React.useState(suggested);
  const [pending, setPending] = React.useState(false);
  React.useEffect(() => setDate(suggested), [suggested]);
  return (
    <div className="space-y-3">
      <Field label="Next follow-up" htmlFor="fu-date">
        <Input id="fu-date" type="date" value={date} onChange={(e) => setDate(e.target.value)} />
      </Field>
      <div className="flex flex-wrap gap-1.5">
        {[3, 7, 14, 30].map((d) => (
          <button
            key={d}
            type="button"
            onClick={() => setDate(addDaysToKey(today, d))}
            className="rounded-md border px-2 py-0.5 text-xs text-muted-foreground hover:bg-accent hover:text-foreground"
          >
            +{d}d
          </button>
        ))}
      </div>
      <Button
        size="sm"
        className="w-full"
        loading={pending}
        onClick={async () => {
          setPending(true);
          await runClientAction(logContactAction(customerId, date || null), { success: "Contact logged and follow-up scheduled" });
          setPending(false);
        }}
      >
        <Check /> Log contact today
      </Button>
      <p className="text-xs text-muted-foreground">Sets “last contacted” to today and schedules the next follow-up. Reminders appear in notifications.</p>
    </div>
  );
}

export function AddCustomerNote({ customerId }: { customerId: string }) {
  const [text, setText] = React.useState("");
  const [pending, setPending] = React.useState(false);
  return (
    <form
      className="space-y-2"
      onSubmit={async (e) => {
        e.preventDefault();
        setPending(true);
        const res = await runClientAction(addCustomerNoteAction(customerId, text));
        setPending(false);
        if (res) setText("");
      }}
    >
      <Textarea value={text} onChange={(e) => setText(e.target.value)} rows={2} placeholder="Log a call, meeting outcome or detail…" aria-label="New customer note" maxLength={2000} />
      <div className="flex justify-end">
        <Button type="submit" size="sm" variant="outline" loading={pending} disabled={!text.trim()}>
          Add note
        </Button>
      </div>
    </form>
  );
}
