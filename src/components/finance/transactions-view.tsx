"use client";

import * as React from "react";
import Link from "next/link";
import { Link2, MoreHorizontal, Pencil, Plus, Receipt, Trash2 } from "lucide-react";
import { endOfMonth, format, parseISO, startOfMonth, startOfYear, subMonths } from "date-fns";
import { TRANSACTION_TYPE } from "@/lib/constants";
import { formatDate } from "@/lib/dates";
import { deleteTransactionAction } from "@/server/actions/finance";
import { runClientAction } from "@/lib/client/actions";
import { useApp, useMoney } from "@/components/app/app-context";
import { TransactionDialog, type TransactionRecord } from "@/components/forms/transaction-form";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/misc";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Table, TableWrap, TBody, TD, TH, THead, TR } from "@/components/ui/table";
import { ClearFilters, SearchFilter, SelectFilter, UrlDateInput, useUrlParams } from "@/components/shared/url-filters";
import { cn } from "@/lib/utils";

export type TransactionItem = TransactionRecord & {
  customer: { id: string; name: string } | null;
  project: { id: string; name: string } | null;
  payment: { id: string; invoice: { id: string; number: string } } | null;
  paymentId: string | null;
};

const KEYS = ["q", "type", "category", "from", "to", "customerId", "projectId"];

function DateRangeFilter() {
  const { params, set } = useUrlParams();
  const { today } = useApp();
  const t = parseISO(today);
  const k = (d: Date) => format(d, "yyyy-MM-dd");
  const presets = [
    { label: "This month", from: k(startOfMonth(t)), to: today },
    { label: "Last month", from: k(startOfMonth(subMonths(t, 1))), to: k(endOfMonth(subMonths(t, 1))) },
    { label: "This year", from: k(startOfYear(t)), to: today },
  ];
  return (
    <div className="flex flex-wrap items-center gap-2">
      <UrlDateInput param="from" label="From date" max={params.get("to") ?? undefined} />
      <span className="text-xs text-muted-foreground">to</span>
      <UrlDateInput param="to" label="To date" min={params.get("from") ?? undefined} />
      {presets.map((p) => {
        const active = params.get("from") === p.from && params.get("to") === p.to;
        return (
          <button
            key={p.label}
            onClick={() => set({ from: p.from, to: p.to })}
            className={cn(
              "h-8 rounded-md border px-2.5 text-xs font-medium transition-colors",
              active ? "border-primary/40 bg-primary-soft text-primary" : "text-muted-foreground hover:bg-accent hover:text-foreground",
            )}
          >
            {p.label}
          </button>
        );
      })}
    </div>
  );
}

export function TransactionsView({
  rows,
  total,
  page,
  pageSize,
  summary,
  categories,
}: {
  rows: TransactionItem[];
  total: number;
  page: number;
  pageSize: number;
  summary: { income: number; expense: number; net: number; count: number };
  categories: string[];
}) {
  const money = useMoney();
  const { openCreate } = useApp();
  const { params, set } = useUrlParams();
  const [editing, setEditing] = React.useState<TransactionItem | null>(null);
  const [deleting, setDeleting] = React.useState<TransactionItem | null>(null);
  const filtered = KEYS.some((k) => params.get(k));
  const pages = Math.max(1, Math.ceil(total / pageSize));

  return (
    <>
      <div className="mb-4 grid gap-3 sm:grid-cols-3">
        <Card className="p-4">
          <p className="text-[13px] font-medium text-muted-foreground">Income{filtered ? " (filtered)" : ""}</p>
          <p className="mt-1.5 text-xl font-semibold tabular text-success" data-testid="sum-income">
            {money.format(summary.income)}
          </p>
          <p className="mt-1 text-xs text-muted-foreground">Includes recorded invoice payments</p>
        </Card>
        <Card className="p-4">
          <p className="text-[13px] font-medium text-muted-foreground">Expenses{filtered ? " (filtered)" : ""}</p>
          <p className="mt-1.5 text-xl font-semibold tabular" data-testid="sum-expense">
            {money.format(summary.expense)}
          </p>
          <p className="mt-1 text-xs text-muted-foreground">{summary.count} transaction{summary.count === 1 ? "" : "s"} in view</p>
        </Card>
        <Card className="p-4">
          <p className="text-[13px] font-medium text-muted-foreground">Net</p>
          <p className={cn("mt-1.5 text-xl font-semibold tabular", summary.net < 0 && "text-destructive")} data-testid="sum-net">
            {money.format(summary.net)}
          </p>
          <p className="mt-1 text-xs text-muted-foreground">Income minus expenses</p>
        </Card>
      </div>

      <div className="mb-4 flex flex-col gap-2">
        <div className="flex flex-wrap items-center gap-2">
          <SearchFilter placeholder="Search description, reference…" />
          <SelectFilter param="type" label="Type" allLabel="Income & expenses" options={TRANSACTION_TYPE.list.map((t) => ({ value: t.value, label: t.label }))} />
          <SelectFilter param="category" label="Category" allLabel="All categories" options={categories.map((c) => ({ value: c, label: c }))} />
          <SelectFilter
            param="sort"
            label="Sort"
            allLabel="Sort: newest"
            options={[{ value: "amount", label: "Sort: largest amount" }]}
          />
          <ClearFilters keys={KEYS} />
        </div>
        <DateRangeFilter />
      </div>

      {rows.length === 0 ? (
        <Card>
          <EmptyState
            icon={Receipt}
            title={filtered ? "No transactions match these filters" : "No transactions yet"}
            description={filtered ? "Adjust the date range or filters." : "Record income and expenses to see your financial summaries."}
            action={
              !filtered && (
                <Button onClick={() => openCreate("transaction")}>
                  <Plus /> Record transaction
                </Button>
              )
            }
          />
        </Card>
      ) : (
        <Card className="overflow-hidden">
          <TableWrap>
            <Table>
              <THead>
                <tr>
                  <TH>Date</TH>
                  <TH>Description</TH>
                  <TH className="hidden md:table-cell">Category</TH>
                  <TH className="hidden lg:table-cell">Linked to</TH>
                  <TH className="hidden xl:table-cell">Method</TH>
                  <TH className="text-right">Amount</TH>
                  <TH className="w-10">
                    <span className="sr-only">Actions</span>
                  </TH>
                </tr>
              </THead>
              <TBody>
                {rows.map((t) => (
                  <TR key={t.id} data-testid="transaction-row">
                    <TD className="whitespace-nowrap text-[13px] text-muted-foreground">{formatDate(t.date)}</TD>
                    <TD className="max-w-[280px]">
                      <span className="block truncate font-medium">{t.description}</span>
                      {t.reference && <span className="block truncate text-xs text-muted-foreground">Ref {t.reference}</span>}
                    </TD>
                    <TD className="hidden text-[13px] text-muted-foreground md:table-cell">{t.category}</TD>
                    <TD className="hidden max-w-[200px] text-[13px] lg:table-cell">
                      {t.payment ? (
                        <Link href={`/finance/invoices/${t.payment.invoice.id}`} className="inline-flex items-center gap-1 text-primary hover:underline">
                          <Link2 className="size-3.5" /> {t.payment.invoice.number}
                        </Link>
                      ) : (
                        <span className="block truncate text-muted-foreground">{t.project?.name ?? t.customer?.name ?? "—"}</span>
                      )}
                    </TD>
                    <TD className="hidden text-[13px] text-muted-foreground xl:table-cell">{t.paymentMethod ?? "—"}</TD>
                    <TD className={cn("whitespace-nowrap text-right font-medium tabular", t.type === "INCOME" ? "text-success" : "")}>
                      {t.type === "INCOME" ? "+" : "−"}
                      {money.format(t.amount)}
                    </TD>
                    <TD className="w-10">
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon-xs" aria-label={`Actions for ${t.description}`}>
                            <MoreHorizontal />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent className="w-56">
                          {t.paymentId ? (
                            <DropdownMenuItem asChild>
                              <Link href={`/finance/invoices/${t.payment?.invoice.id}`}>
                                <Link2 /> Managed by invoice payment
                              </Link>
                            </DropdownMenuItem>
                          ) : (
                            <>
                              <DropdownMenuItem onSelect={() => setEditing(t)}>
                                <Pencil /> Edit
                              </DropdownMenuItem>
                              <DropdownMenuItem destructive onSelect={() => setDeleting(t)}>
                                <Trash2 /> Delete
                              </DropdownMenuItem>
                            </>
                          )}
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TD>
                  </TR>
                ))}
              </TBody>
            </Table>
          </TableWrap>
          <div className="flex items-center justify-between border-t px-5 py-2.5 text-xs text-muted-foreground">
            <span>
              {(page - 1) * pageSize + 1}–{Math.min(page * pageSize, total)} of {total}
            </span>
            {pages > 1 && (
              <span className="flex items-center gap-2">
                <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => set({ page: String(page - 1) })}>
                  Previous
                </Button>
                <span>
                  Page {page} of {pages}
                </span>
                <Button variant="outline" size="sm" disabled={page >= pages} onClick={() => set({ page: String(page + 1) })}>
                  Next
                </Button>
              </span>
            )}
          </div>
        </Card>
      )}

      <TransactionDialog open={!!editing} onOpenChange={(o) => !o && setEditing(null)} transaction={editing} categories={categories} />
      <ConfirmDialog
        open={!!deleting}
        onOpenChange={(o) => !o && setDeleting(null)}
        title="Delete this transaction?"
        description={deleting ? `“${deleting.description}” (${money.format(deleting.amount)}) will be removed from your financial records.` : ""}
        onConfirm={async () => !!(deleting && (await runClientAction(deleteTransactionAction(deleting.id))))}
      />
    </>
  );
}
