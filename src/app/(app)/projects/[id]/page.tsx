import Link from "next/link";
import { ArrowLeft, CalendarDays, FileText, NotebookPen, Wallet } from "lucide-react";
import { getContext } from "@/server/workspace";
import { getProject } from "@/lib/services/projects";
import { orNotFound } from "@/server/load";
import { INVOICE_STATUS, PROJECT_STATUS } from "@/lib/constants";
import { formatDate, formatDateShort, formatDateTime } from "@/lib/dates";
import { formatMoney } from "@/lib/money";
import { effectiveInvoiceStatus } from "@/lib/calc/invoice";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { StatusBadge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/misc";
import { PriorityIcon } from "@/components/shared/bits";
import { TaskListCompact } from "@/components/tasks/task-list-compact";
import { ProjectActions } from "@/components/projects/project-actions";
import { DeadlineChip } from "@/components/projects/project-bits";
import { cn } from "@/lib/utils";

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { workspaceId } = await getContext();
  const p = await getProject(workspaceId, id).catch(() => null);
  return { title: p?.name ?? "Project" };
}

export default async function ProjectPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { workspaceId, today, tz, currency } = await getContext();
  const p = await orNotFound(getProject(workspaceId, id));
  const money = (v: number) => formatMoney(v, currency);

  const billable = p.invoices.filter((i) => i.status !== "DRAFT" && i.status !== "CANCELLED");
  const invoiced = billable.reduce((s, i) => s + i.total, 0);
  const collected = billable.reduce((s, i) => s + i.amountPaid, 0);
  const spent = p.spent;
  const budgetUsed = p.budget > 0 ? Math.round((spent / p.budget) * 100) : null;
  const sortedTasks = [...p.tasks].sort((a, b) => Number(a.status === "DONE") - Number(b.status === "DONE"));

  return (
    <div className="space-y-6">
      <div>
        <Link href="/projects" className="mb-3 inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground">
          <ArrowLeft className="size-3.5" /> Projects
        </Link>
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-xl font-semibold tracking-tight sm:text-[22px]">{p.name}</h1>
              <StatusBadge options={PROJECT_STATUS} value={p.status} />
            </div>
            <div className="mt-1.5 flex flex-wrap items-center gap-x-4 gap-y-1 text-[13px] text-muted-foreground">
              {p.customer ? (
                <Link href={`/customers/${p.customer.id}`} className="hover:text-foreground hover:underline">
                  {p.customer.name}
                  {p.customer.company ? ` · ${p.customer.company}` : ""}
                </Link>
              ) : (
                <span>Internal project</span>
              )}
              <PriorityIcon priority={p.priority} withLabel />
              <span>
                {p.startDate ? formatDate(p.startDate) : "No start date"} → {p.dueDate ? formatDate(p.dueDate) : "no deadline"}
              </span>
              <DeadlineChip status={p.status} dueDate={p.dueDate} today={today} />
            </div>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <ProjectActions project={p} taskCount={p.tasks.length} />
          </div>
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Card className="p-4">
          <p className="text-[13px] font-medium text-muted-foreground">Progress</p>
          <p className="mt-2 text-[22px] font-semibold tabular">{p.progress.source === "none" ? "—" : `${p.progress.value}%`}</p>
          <Progress value={p.progress.value} className="mt-2" tone={p.progress.value === 100 ? "success" : "primary"} />
          <p className="mt-2 text-xs text-muted-foreground">
            {p.progress.source === "tasks"
              ? `Calculated: ${p.progress.done} of ${p.progress.total} tasks completed`
              : p.progress.source === "manual"
                ? `Entered manually (${p.progress.done}/${p.progress.total} tasks done)`
                : "Add tasks to calculate progress"}
          </p>
        </Card>
        <Card className="p-4">
          <p className="text-[13px] font-medium text-muted-foreground">Budget</p>
          <p className="mt-2 text-[22px] font-semibold tabular">{p.budget ? money(p.budget) : "—"}</p>
          {budgetUsed != null && <Progress value={budgetUsed} className="mt-2" tone={budgetUsed > 100 ? "danger" : budgetUsed > 80 ? "warning" : "primary"} />}
          <p className="mt-2 text-xs text-muted-foreground">
            {money(spent)} in linked expenses{budgetUsed != null ? ` · ${budgetUsed}% of budget` : ""}
          </p>
        </Card>
        <Card className="p-4">
          <p className="text-[13px] font-medium text-muted-foreground">Invoiced</p>
          <p className="mt-2 text-[22px] font-semibold tabular">{money(invoiced)}</p>
          <p className="mt-2 text-xs text-muted-foreground">
            {money(collected)} collected · {money(invoiced - collected)} outstanding
          </p>
        </Card>
        <Card className="p-4">
          <p className="text-[13px] font-medium text-muted-foreground">Tasks</p>
          <p className="mt-2 text-[22px] font-semibold tabular">{p.tasks.filter((t) => t.status !== "DONE").length} open</p>
          <p className="mt-2 text-xs text-muted-foreground">{p.tasks.filter((t) => t.status === "DONE").length} completed</p>
        </Card>
      </div>

      <div className="grid gap-4 xl:grid-cols-3">
        <div className="space-y-4 xl:col-span-2">
          <Card>
            <CardHeader>
              <div>
                <CardTitle>Tasks</CardTitle>
                <CardDescription>Completing tasks updates the project&apos;s calculated progress</CardDescription>
              </div>
            </CardHeader>
            <TaskListCompact tasks={sortedTasks} projectId={p.id} customerId={p.customerId} emptyText="No tasks yet — add the first one above." />
          </Card>

          <Card>
            <CardHeader>
              <div>
                <CardTitle>Invoices</CardTitle>
                <CardDescription>Billing for this project</CardDescription>
              </div>
              <Link href={`/finance/invoices/new?projectId=${p.id}${p.customerId ? `&customerId=${p.customerId}` : ""}`} className="text-xs font-medium text-primary hover:underline">
                New invoice
              </Link>
            </CardHeader>
            <CardContent className="px-0 pb-2">
              {p.invoices.length ? (
                <ul className="divide-y border-t">
                  {p.invoices.map((inv) => (
                    <li key={inv.id}>
                      <Link href={`/finance/invoices/${inv.id}`} className="flex items-center gap-3 px-5 py-2.5 hover:bg-accent/50">
                        <FileText className="size-4 text-muted-foreground" />
                        <span className="flex-1 text-[13px] font-medium">{inv.number}</span>
                        <span className="hidden text-xs text-muted-foreground sm:block">Due {formatDateShort(inv.dueDate)}</span>
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
        </div>

        <div className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>About</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-[13px]">
              <p className={cn("whitespace-pre-wrap leading-relaxed", !p.description && "text-muted-foreground")}>{p.description || "No description."}</p>
              {p.notes && (
                <div className="rounded-md bg-surface-2 p-3">
                  <p className="mb-1 text-[11px] font-medium uppercase tracking-wider text-muted-foreground">Notes</p>
                  <p className="whitespace-pre-wrap leading-relaxed">{p.notes}</p>
                </div>
              )}
              <p className="text-xs text-muted-foreground">Updated {formatDateTime(p.updatedAt, tz)}</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle>Events</CardTitle>
            </CardHeader>
            <CardContent>
              {p.events.length ? (
                <ul className="space-y-2">
                  {p.events.map((e) => (
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
                <p className="text-[13px] text-muted-foreground">No events linked.</p>
              )}
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle>Notes</CardTitle>
            </CardHeader>
            <CardContent>
              {p.linkedNotes.length ? (
                <ul className="space-y-2">
                  {p.linkedNotes.map((n) => (
                    <li key={n.id}>
                      <Link href={`/notes?note=${n.id}`} className="flex items-center gap-2 text-[13px] hover:text-primary">
                        <NotebookPen className="size-3.5 text-muted-foreground" />
                        <span className="flex-1 truncate">{n.title}</span>
                      </Link>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-[13px] text-muted-foreground">No notes linked.</p>
              )}
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle>Transactions</CardTitle>
            </CardHeader>
            <CardContent>
              {p.transactions.length ? (
                <ul className="space-y-2">
                  {p.transactions.map((t) => (
                    <li key={t.id} className="flex items-center gap-2 text-[13px]">
                      <Wallet className="size-3.5 text-muted-foreground" />
                      <span className="flex-1 truncate">{t.description}</span>
                      <span className={cn("tabular", t.type === "INCOME" ? "text-success" : "")}>
                        {t.type === "INCOME" ? "+" : "−"}
                        {money(t.amount)}
                      </span>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-[13px] text-muted-foreground">No transactions linked.</p>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
