"use client";

import Link from "next/link";
import { Mail, Phone, Plus, Users } from "lucide-react";
import { CUSTOMER_STATUS, LEAD_SOURCES } from "@/lib/constants";
import { dateToKey, formatDateShort, relativeDue } from "@/lib/dates";
import { useApp, useMoney } from "@/components/app/app-context";
import { Card } from "@/components/ui/card";
import { StatusBadge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Avatar, EmptyState } from "@/components/ui/misc";
import { Table, TableWrap, TBody, TD, TH, THead, TR } from "@/components/ui/table";
import { ClearFilters, SearchFilter, SelectFilter, useUrlParams } from "@/components/shared/url-filters";
import { cn } from "@/lib/utils";

export type CustomerItem = {
  id: string;
  name: string;
  company: string | null;
  email: string | null;
  phone: string | null;
  status: string;
  source: string | null;
  dealValue: number;
  lastContactAt: Date | null;
  nextFollowUpAt: Date | null;
  _count: { projects: number; invoices: number };
};

const KEYS = ["q", "status", "source", "followUp"];

export function FollowUp({ date, today }: { date: Date | null; today: string }) {
  if (!date) return <span className="text-xs text-muted-foreground">—</span>;
  const r = relativeDue(dateToKey(date), today);
  return (
    <span
      className={cn(
        "text-xs",
        r.tone === "overdue" ? "font-medium text-destructive" : r.tone === "today" ? "font-medium text-warning" : "text-muted-foreground",
      )}
    >
      {r.tone === "overdue" ? `Overdue · ${formatDateShort(date)}` : r.label}
    </span>
  );
}

export function CustomersView({ customers }: { customers: CustomerItem[] }) {
  const { today, openCreate } = useApp();
  const money = useMoney();
  const { params } = useUrlParams();
  const filtered = KEYS.some((k) => params.get(k));

  return (
    <>
      <div className="mb-4 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex flex-wrap items-center gap-2">
          <SearchFilter placeholder="Search name, company, email, phone…" className="sm:w-72" />
          <SelectFilter param="status" label="Status" allLabel="All statuses" options={CUSTOMER_STATUS.list.map((s) => ({ value: s.value, label: s.label }))} />
          <SelectFilter param="source" label="Lead source" allLabel="Any source" options={LEAD_SOURCES.map((s) => ({ value: s, label: s }))} />
          <SelectFilter
            param="followUp"
            label="Follow-up"
            allLabel="Any follow-up"
            options={[
              { value: "due", label: "Follow-up due" },
              { value: "upcoming", label: "Follow-up scheduled" },
            ]}
          />
          <ClearFilters keys={KEYS} />
        </div>
        <SelectFilter
          param="sort"
          label="Sort"
          allLabel="Sort: name"
          options={[
            { value: "followup", label: "Sort: next follow-up" },
            { value: "value", label: "Sort: deal value" },
            { value: "updated", label: "Sort: recently updated" },
            { value: "created", label: "Sort: newest" },
          ]}
        />
      </div>

      {customers.length === 0 ? (
        <Card>
          <EmptyState
            icon={Users}
            title={filtered ? "No customers match these filters" : "No customers yet"}
            description={filtered ? "Try a different search or clear the filters." : "Add leads and clients to track deals, follow-ups and billing."}
            action={
              !filtered && (
                <Button onClick={() => openCreate("customer")}>
                  <Plus /> Add customer
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
                  <TH>Customer</TH>
                  <TH>Status</TH>
                  <TH className="hidden lg:table-cell">Contact</TH>
                  <TH className="hidden md:table-cell">Source</TH>
                  <TH className="text-right">Deal value</TH>
                  <TH className="hidden sm:table-cell">Next follow-up</TH>
                  <TH className="hidden xl:table-cell">Last contact</TH>
                </tr>
              </THead>
              <TBody>
                {customers.map((c) => (
                  <TR key={c.id} data-testid="customer-row">
                    <TD className="max-w-[280px]">
                      <Link href={`/customers/${c.id}`} className="flex items-center gap-3">
                        <Avatar name={c.name} />
                        <span className="min-w-0">
                          <span className="block truncate font-medium hover:text-primary">{c.name}</span>
                          <span className="block truncate text-xs text-muted-foreground">{c.company ?? "—"}</span>
                        </span>
                      </Link>
                    </TD>
                    <TD>
                      <StatusBadge options={CUSTOMER_STATUS} value={c.status} />
                    </TD>
                    <TD className="hidden lg:table-cell">
                      <span className="flex items-center gap-1">
                        {c.email && (
                          <a href={`mailto:${c.email}`} className="rounded p-1 text-muted-foreground hover:bg-accent hover:text-foreground" title={c.email} aria-label={`Email ${c.name}`}>
                            <Mail className="size-3.5" />
                          </a>
                        )}
                        {c.phone && (
                          <a href={`tel:${c.phone.replace(/\s/g, "")}`} className="rounded p-1 text-muted-foreground hover:bg-accent hover:text-foreground" title={c.phone} aria-label={`Call ${c.name}`}>
                            <Phone className="size-3.5" />
                          </a>
                        )}
                        <span className="truncate text-xs text-muted-foreground">{c.email ?? c.phone ?? "—"}</span>
                      </span>
                    </TD>
                    <TD className="hidden text-[13px] text-muted-foreground md:table-cell">{c.source ?? "—"}</TD>
                    <TD className="text-right tabular">{c.dealValue ? money.format(c.dealValue) : "—"}</TD>
                    <TD className="hidden sm:table-cell">
                      <FollowUp date={c.nextFollowUpAt} today={today} />
                    </TD>
                    <TD className="hidden text-xs text-muted-foreground xl:table-cell">{c.lastContactAt ? formatDateShort(c.lastContactAt) : "—"}</TD>
                  </TR>
                ))}
              </TBody>
            </Table>
          </TableWrap>
          <div className="border-t px-5 py-2.5 text-xs text-muted-foreground">
            {customers.length} customer{customers.length === 1 ? "" : "s"} · pipeline value {money.format(customers.reduce((s, c) => s + c.dealValue, 0))}
          </div>
        </Card>
      )}
    </>
  );
}
