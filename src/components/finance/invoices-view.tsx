"use client";

import Link from "next/link";
import { FileText, Plus } from "lucide-react";
import { INVOICE_STATUS } from "@/lib/constants";
import { formatDate } from "@/lib/dates";
import { useApp, useMoney } from "@/components/app/app-context";
import { Card } from "@/components/ui/card";
import { StatusBadge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/misc";
import { Table, TableWrap, TBody, TD, TH, THead, TR } from "@/components/ui/table";
import { ClearFilters, SearchFilter, SelectFilter, useUrlParams } from "@/components/shared/url-filters";
import { cn } from "@/lib/utils";

export type InvoiceRow = {
  id: string;
  number: string;
  issueDate: Date;
  dueDate: Date;
  total: number;
  amountPaid: number;
  balance: number;
  effectiveStatus: string;
  customer: { id: string; name: string; company: string | null };
  project: { id: string; name: string } | null;
};

const KEYS = ["q", "status", "customerId"];

export function InvoicesView({ invoices }: { invoices: InvoiceRow[] }) {
  const money = useMoney();
  const { options } = useApp();
  const { params } = useUrlParams();
  const filtered = KEYS.some((k) => params.get(k));
  return (
    <>
      <div className="mb-4 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex flex-wrap items-center gap-2">
          <SearchFilter placeholder="Search number or customer…" />
          <SelectFilter
            param="status"
            label="Status"
            allLabel="All statuses"
            options={[{ value: "OUTSTANDING", label: "Awaiting payment" }, ...INVOICE_STATUS.list.map((s) => ({ value: s.value, label: s.label }))]}
          />
          <SelectFilter param="customerId" label="Customer" allLabel="All customers" options={options.customers.map((c) => ({ value: c.id, label: c.name }))} />
          <ClearFilters keys={KEYS} />
        </div>
        <SelectFilter
          param="sort"
          label="Sort"
          allLabel="Sort: newest"
          options={[
            { value: "due", label: "Sort: due date" },
            { value: "amount", label: "Sort: amount" },
          ]}
        />
      </div>
      {invoices.length === 0 ? (
        <Card>
          <EmptyState
            icon={FileText}
            title={filtered ? "No invoices match these filters" : "No invoices yet"}
            description={filtered ? "Try a different search or status." : "Create an invoice for a customer, then record payments as they arrive."}
            action={
              !filtered && (
                <Button asChild>
                  <Link href="/finance/invoices/new">
                    <Plus /> New invoice
                  </Link>
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
                  <TH>Invoice</TH>
                  <TH>Customer</TH>
                  <TH className="hidden md:table-cell">Issued</TH>
                  <TH className="hidden sm:table-cell">Due</TH>
                  <TH>Status</TH>
                  <TH className="text-right">Total</TH>
                  <TH className="hidden text-right lg:table-cell">Balance</TH>
                </tr>
              </THead>
              <TBody>
                {invoices.map((inv) => (
                  <TR key={inv.id} data-testid="invoice-row">
                    <TD>
                      <Link href={`/finance/invoices/${inv.id}`} className="font-medium hover:text-primary">
                        {inv.number}
                      </Link>
                      {inv.project && <span className="block max-w-[180px] truncate text-xs text-muted-foreground">{inv.project.name}</span>}
                    </TD>
                    <TD className="max-w-[220px]">
                      <Link href={`/customers/${inv.customer.id}`} className="block truncate text-[13px] hover:underline">
                        {inv.customer.name}
                      </Link>
                      <span className="block truncate text-xs text-muted-foreground">{inv.customer.company ?? ""}</span>
                    </TD>
                    <TD className="hidden text-[13px] text-muted-foreground md:table-cell">{formatDate(inv.issueDate)}</TD>
                    <TD className={cn("hidden text-[13px] sm:table-cell", inv.effectiveStatus === "OVERDUE" ? "font-medium text-destructive" : "text-muted-foreground")}>
                      {formatDate(inv.dueDate)}
                    </TD>
                    <TD>
                      <StatusBadge options={INVOICE_STATUS} value={inv.effectiveStatus} />
                    </TD>
                    <TD className="text-right font-medium tabular">{money.format(inv.total)}</TD>
                    <TD className="hidden text-right tabular text-muted-foreground lg:table-cell">
                      {inv.effectiveStatus === "DRAFT" || inv.effectiveStatus === "CANCELLED" ? "—" : money.format(inv.balance)}
                    </TD>
                  </TR>
                ))}
              </TBody>
            </Table>
          </TableWrap>
        </Card>
      )}
    </>
  );
}
