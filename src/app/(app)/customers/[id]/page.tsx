import Link from "next/link";
import { ArrowLeft, Building2, CalendarDays, FileText, Mail, NotebookPen, Phone } from "lucide-react";
import { getContext } from "@/server/workspace";
import { getCustomer } from "@/lib/services/customers";
import { orNotFound } from "@/server/load";
import { CUSTOMER_STATUS, INVOICE_STATUS, PROJECT_STATUS } from "@/lib/constants";
import { dateToKey, formatDate, formatDateShort, formatDateTime } from "@/lib/dates";
import { formatMoney } from "@/lib/money";
import { effectiveInvoiceStatus, invoiceBalance } from "@/lib/calc/invoice";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { StatusBadge } from "@/components/ui/badge";
import { Avatar } from "@/components/ui/misc";
import { TaskListCompact } from "@/components/tasks/task-list-compact";
import { AddCustomerNote, CopyButton, CustomerActions, FollowUpCard } from "@/components/customers/customer-actions";
import { FollowUp } from "@/components/customers/customers-view";
import { ProgressBlock } from "@/components/projects/project-bits";
import { cn } from "@/lib/utils";

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { workspaceId } = await getContext();
  const c = await getCustomer(workspaceId, id).catch(() => null);
  return { title: c?.name ?? "Customer" };
}

export default async function CustomerPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { workspaceId, today, tz, currency } = await getContext();
  const c = await orNotFound(getCustomer(workspaceId, id));
  const money = (v: number) => formatMoney(v, currency);
  const billable = c.invoices.filter((i) => i.status !== "DRAFT" && i.status !== "CANCELLED");
  const invoiced = billable.reduce((s, i) => s + i.total, 0);
  const paid = billable.reduce((s, i) => s + i.amountPaid, 0);

  return (
    <div className="space-y-6">
      <div>
        <Link href="/customers" className="mb-3 inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground">
          <ArrowLeft className="size-3.5" /> Customers
        </Link>
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex min-w-0 items-center gap-4">
            <Avatar name={c.name} className="size-12 text-base" />
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="truncate text-xl font-semibold tracking-tight sm:text-[22px]">{c.name}</h1>
                <StatusBadge options={CUSTOMER_STATUS} value={c.status} />
              </div>
              <p className="mt-0.5 text-[13px] text-muted-foreground">
                {c.company ?? "No company"} · {c.source ? `via ${c.source}` : "source unknown"} · customer since {formatDateTime(c.createdAt, tz, "d MMM yyyy")}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <CustomerActions customer={c} />
          </div>
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Card className="p-4">
          <p className="text-[13px] font-medium text-muted-foreground">Potential deal value</p>
          <p className="mt-2 text-[22px] font-semibold tabular">{money(c.dealValue)}</p>
        </Card>
        <Card className="p-4">
          <p className="text-[13px] font-medium text-muted-foreground">Invoiced</p>
          <p className="mt-2 text-[22px] font-semibold tabular">{money(invoiced)}</p>
          <p className="mt-1 text-xs text-muted-foreground">{billable.length} invoice{billable.length === 1 ? "" : "s"} issued</p>
        </Card>
        <Card className="p-4">
          <p className="text-[13px] font-medium text-muted-foreground">Paid</p>
          <p className="mt-2 text-[22px] font-semibold tabular text-success">{money(paid)}</p>
        </Card>
        <Card className="p-4">
          <p className="text-[13px] font-medium text-muted-foreground">Outstanding</p>
          <p className={cn("mt-2 text-[22px] font-semibold tabular", invoiced - paid > 0 && "text-warning")}>{money(invoiced - paid)}</p>
        </Card>
      </div>

      <div className="grid gap-4 xl:grid-cols-3">
        <div className="space-y-4 xl:col-span-2">
          <Card>
            <CardHeader>
              <div>
                <CardTitle>Projects</CardTitle>
                <CardDescription>{c.projects.length} associated</CardDescription>
              </div>
            </CardHeader>
            <CardContent className="px-0 pb-2">
              {c.projects.length ? (
                <ul className="divide-y border-t">
                  {c.projects.map((p) => (
                    <li key={p.id}>
                      <Link href={`/projects/${p.id}`} className="grid grid-cols-[1fr_auto] items-center gap-4 px-5 py-3 hover:bg-accent/50 sm:grid-cols-[1fr_160px_auto]">
                        <span className="truncate text-[13px] font-medium">{p.name}</span>
                        <span className="hidden sm:block">
                          <ProgressBlock progress={p.progress} compact />
                        </span>
                        <StatusBadge options={PROJECT_STATUS} value={p.status} />
                      </Link>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="px-5 pb-3 text-[13px] text-muted-foreground">No projects yet.</p>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <div>
                <CardTitle>Invoices</CardTitle>
                <CardDescription>Billing history</CardDescription>
              </div>
              <Link href={`/finance/invoices/new?customerId=${c.id}`} className="text-xs font-medium text-primary hover:underline">
                New invoice
              </Link>
            </CardHeader>
            <CardContent className="px-0 pb-2">
              {c.invoices.length ? (
                <ul className="divide-y border-t">
                  {c.invoices.map((inv) => (
                    <li key={inv.id}>
                      <Link href={`/finance/invoices/${inv.id}`} className="flex items-center gap-3 px-5 py-2.5 hover:bg-accent/50">
                        <FileText className="size-4 text-muted-foreground" />
                        <span className="flex-1 text-[13px] font-medium">{inv.number}</span>
                        <span className="hidden text-xs text-muted-foreground sm:block">
                          {formatDateShort(inv.issueDate)} · balance {money(invoiceBalance(inv.total, inv.amountPaid))}
                        </span>
                        <StatusBadge options={INVOICE_STATUS} value={effectiveInvoiceStatus(inv, today)} />
                        <span className="w-28 text-right text-[13px] tabular">{money(inv.total)}</span>
                      </Link>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="px-5 pb-3 text-[13px] text-muted-foreground">No invoices yet.</p>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <div>
                <CardTitle>Open tasks</CardTitle>
                <CardDescription>Work related to this customer</CardDescription>
              </div>
            </CardHeader>
            <TaskListCompact tasks={c.tasks} customerId={c.id} emptyText="No open tasks for this customer." />
          </Card>

          <Card>
            <CardHeader>
              <div>
                <CardTitle>Notes & activity</CardTitle>
                <CardDescription>A running log for this customer</CardDescription>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <AddCustomerNote customerId={c.id} />
              {c.notes ? (
                <p className="whitespace-pre-wrap rounded-md bg-surface-2 p-3 text-[13px] leading-relaxed">{c.notes}</p>
              ) : (
                <p className="text-[13px] text-muted-foreground">No notes yet.</p>
              )}
              {c.linkedNotes.length > 0 && (
                <div>
                  <p className="mb-2 text-[11px] font-medium uppercase tracking-wider text-muted-foreground">Linked notes</p>
                  <ul className="space-y-1.5">
                    {c.linkedNotes.map((n) => (
                      <li key={n.id}>
                        <Link href={`/notes?note=${n.id}`} className="flex items-center gap-2 text-[13px] hover:text-primary">
                          <NotebookPen className="size-3.5 text-muted-foreground" />
                          <span className="flex-1 truncate">{n.title}</span>
                          <span className="text-xs text-muted-foreground">{formatDateTime(n.updatedAt, tz, "d MMM")}</span>
                        </Link>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        <div className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Contact</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2.5 text-[13px]">
              <div className="flex items-center gap-2">
                <Mail className="size-4 shrink-0 text-muted-foreground" />
                {c.email ? (
                  <>
                    <a href={`mailto:${c.email}`} className="min-w-0 flex-1 truncate text-primary hover:underline">
                      {c.email}
                    </a>
                    <CopyButton value={c.email} label="Email" />
                  </>
                ) : (
                  <span className="text-muted-foreground">No email</span>
                )}
              </div>
              <div className="flex items-center gap-2">
                <Phone className="size-4 shrink-0 text-muted-foreground" />
                {c.phone ? (
                  <>
                    <a href={`tel:${c.phone.replace(/\s/g, "")}`} className="min-w-0 flex-1 truncate text-primary hover:underline">
                      {c.phone}
                    </a>
                    <CopyButton value={c.phone} label="Phone" />
                  </>
                ) : (
                  <span className="text-muted-foreground">No phone</span>
                )}
              </div>
              <div className="flex items-center gap-2">
                <Building2 className="size-4 shrink-0 text-muted-foreground" />
                <span className={cn(!c.company && "text-muted-foreground")}>{c.company ?? "No company"}</span>
              </div>
              <p className="pt-1 text-xs text-muted-foreground">Links open your own email or phone app. NEXUS does not send messages.</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <div>
                <CardTitle>Follow-up</CardTitle>
                <CardDescription>
                  Last contacted {c.lastContactAt ? formatDate(c.lastContactAt) : "never"} · next <FollowUp date={c.nextFollowUpAt} today={today} />
                </CardDescription>
              </div>
            </CardHeader>
            <CardContent>
              <FollowUpCard customerId={c.id} next={c.nextFollowUpAt ? dateToKey(c.nextFollowUpAt) : null} />
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle>Events</CardTitle>
            </CardHeader>
            <CardContent>
              {c.events.length ? (
                <ul className="space-y-2">
                  {c.events.map((e) => (
                    <li key={e.id}>
                      <Link href={`/calendar?event=${e.id}`} className="flex items-center gap-2 text-[13px] hover:text-primary">
                        <CalendarDays className="size-3.5 text-muted-foreground" />
                        <span className="flex-1 truncate">{e.title}</span>
                        <span className="text-xs text-muted-foreground">{formatDateTime(e.startAt, tz, "d MMM")}</span>
                      </Link>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-[13px] text-muted-foreground">No events.</p>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
