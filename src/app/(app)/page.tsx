import Link from "next/link";
import { formatInTimeZone } from "date-fns-tz";
import {
  AlertTriangle,
  ArrowRight,
  CalendarClock,
  CheckSquare,
  Clock,
  FileText,
  FolderKanban,
  NotebookPen,
  Receipt,
  TrendingDown,
  TrendingUp,
  Users,
  Wallet,
} from "lucide-react";
import { getContext } from "@/server/workspace";
import { getOverview } from "@/lib/services/dashboard";
import { PERIODS, type Period } from "@/lib/calc/metrics";
import { formatMoney } from "@/lib/money";
import { formatDateShort, formatDateTime, formatTime, instantToKey } from "@/lib/dates";
import { PROJECT_STATUS, TASK_STATUS } from "@/lib/constants";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

import { EmptyState, PageHeader } from "@/components/ui/misc";
import { StatCard, ChangeIndicator } from "@/components/shared/stat-card";
import { DueLabel, PriorityIcon } from "@/components/shared/bits";
import { BreakdownBar } from "@/components/charts/charts";
import { CashflowChart, Onboarding, PeriodSelect, QuickActions } from "@/components/overview/overview-client";
import { str, type SearchParams } from "@/server/load";
import { cn } from "@/lib/utils";

export const metadata = { title: "Overview" };

const RECENT_ICONS = { task: CheckSquare, project: FolderKanban, customer: Users, invoice: FileText, note: NotebookPen };
const STATUS_COLORS: Record<string, string> = {
  TODO: "hsl(var(--muted-foreground) / 0.45)",
  IN_PROGRESS: "hsl(var(--chart-4))",
  IN_REVIEW: "hsl(var(--chart-1))",
  DONE: "hsl(var(--chart-2))",
  PLANNING: "hsl(var(--muted-foreground) / 0.45)",
  ACTIVE: "hsl(var(--chart-4))",
  ON_HOLD: "hsl(var(--chart-3))",
  COMPLETED: "hsl(var(--chart-2))",
  CANCELLED: "hsl(var(--chart-5))",
};

function greeting(hour: number) {
  if (hour < 12) return "Good morning";
  if (hour < 17) return "Good afternoon";
  return "Good evening";
}

export default async function OverviewPage({ searchParams }: { searchParams: SearchParams }) {
  const sp = await searchParams;
  const { ws, today, tz, currency } = await getContext();
  const periodParam = str(sp.period) as Period;
  const period: Period = PERIODS.some((p) => p.value === periodParam) ? periodParam : "month";
  const now = new Date();
  const o = await getOverview(ws.id, period, today, now);
  const money = (v: number) => formatMoney(v, currency);
  const periodLabel = PERIODS.find((p) => p.value === period)!.label.toLowerCase();
  const compareLabel = period === "month" ? "vs last month (same days)" : period === "quarter" ? "vs last quarter" : period === "year" ? "vs last year" : "vs prior 30 days";
  const hour = Number(formatInTimeZone(now, tz, "H"));
  const firstName = ws.ownerName.split(" ")[0];

  return (
    <div className="space-y-6">
      <PageHeader
        title={`${greeting(hour)}${firstName ? `, ${firstName}` : ""}`}
        description={`${formatInTimeZone(now, tz, "EEEE, d MMMM yyyy")} · Here's what's happening in ${ws.name}.`}
        actions={!o.isEmpty && <PeriodSelect value={period} />}
      />

      {o.isEmpty ? (
        <Onboarding />
      ) : (
        <>
          {o.receivables.overdueInvoices > 0 && (
            <Link
              href="/finance/invoices?status=OVERDUE"
              className="flex items-center gap-3 rounded-lg border border-destructive/20 bg-destructive-soft px-4 py-3 text-[13px] text-destructive"
            >
              <AlertTriangle className="size-4 shrink-0" />
              <span className="flex-1">
                {o.receivables.overdueInvoices} overdue invoice{o.receivables.overdueInvoices === 1 ? "" : "s"} totalling{" "}
                <strong>{money(o.receivables.overdueAmount)}</strong>. Follow up to get paid.
              </span>
              <ArrowRight className="size-4" />
            </Link>
          )}
          <section aria-label="Key metrics" className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <StatCard
              label="Revenue"
              icon={TrendingUp}
              value={money(o.finance.revenue)}
              href="/finance?type=INCOME"
              testId="metric-revenue"
              footer={
                o.finance.revenueChange != null ? (
                  <ChangeIndicator value={o.finance.revenueChange} label={compareLabel} />
                ) : (
                  <span>Income recorded {periodLabel}</span>
                )
              }
            />
            <StatCard
              label="Expenses"
              icon={TrendingDown}
              value={money(o.finance.expenses)}
              href="/finance?type=EXPENSE"
              testId="metric-expenses"
              footer={
                o.finance.expenseChange != null ? (
                  <ChangeIndicator value={o.finance.expenseChange} goodWhenUp={false} label={compareLabel} />
                ) : (
                  <span>Spent {periodLabel}</span>
                )
              }
            />
            <StatCard
              label="Net profit"
              icon={Wallet}
              value={money(o.finance.net)}
              tone={o.finance.net < 0 ? "danger" : undefined}
              testId="metric-net"
              footer={
                o.finance.netChange != null && o.finance.net > 0 ? (
                  <ChangeIndicator value={o.finance.netChange} label={compareLabel} />
                ) : (
                  <span>Revenue minus expenses</span>
                )
              }
            />
            <StatCard
              label="Outstanding invoices"
              icon={FileText}
              value={money(o.receivables.outstanding)}
              href="/finance/invoices?status=OUTSTANDING"
              testId="metric-outstanding"
              footer={
                o.receivables.overdueInvoices > 0 ? (
                  <span className="font-medium text-destructive">
                    {money(o.receivables.overdueAmount)} overdue · {o.receivables.overdueInvoices} invoice{o.receivables.overdueInvoices === 1 ? "" : "s"}
                  </span>
                ) : (
                  <span>{o.receivables.openInvoices ? `${o.receivables.openInvoices} open, none overdue` : "Nothing awaiting payment"}</span>
                )
              }
            />
            <StatCard
              label="Active projects"
              icon={FolderKanban}
              value={o.projects.active}
              href="/projects?status=ACTIVE"
              footer={o.projects.avgProgress != null ? `Average progress ${o.projects.avgProgress}%` : `${o.projects.total} project${o.projects.total === 1 ? "" : "s"} in total`}
            />
            <StatCard
              label="Open tasks"
              icon={CheckSquare}
              value={o.tasks.open}
              href={o.tasks.overdue > 0 ? "/tasks?due=overdue" : "/tasks"}
              testId="metric-open-tasks"
              footer={
                o.tasks.overdue > 0 ? (
                  <span className="font-medium text-destructive">{o.tasks.overdue} overdue</span>
                ) : (
                  `${o.tasks.completedThisWeek} completed in the last 7 days`
                )
              }
            />
            <StatCard
              label="Upcoming deadlines"
              icon={Clock}
              value={o.deadlines.length}
              href="/tasks?due=week"
              footer="Tasks & projects due in the next 7 days"
            />
            <StatCard
              label="Customers"
              icon={Users}
              value={o.customers.total}
              href="/customers"
              footer={o.customers.newInPeriod != null ? `${o.customers.newInPeriod} new ${periodLabel}` : "All time"}
            />
          </section>

          <div className="grid gap-4 xl:grid-cols-3">
            <Card className="xl:col-span-2">
              <CardHeader>
                <div>
                  <CardTitle>Cash flow</CardTitle>
                  <CardDescription>Income and expenses for the last 6 months, from recorded transactions</CardDescription>
                </div>
                <Link href="/analytics" className="text-xs font-medium text-primary hover:underline">
                  Analytics
                </Link>
              </CardHeader>
              <CardContent>
                {o.finance.hasTransactions ? (
                  <CashflowChart data={o.series} />
                ) : (
                  <EmptyState compact icon={Receipt} title="No transactions yet" description="Record income and expenses to see your cash flow trend." />
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <div>
                  <CardTitle>Priority tasks</CardTitle>
                  <CardDescription>Overdue, urgent and due this week</CardDescription>
                </div>
                <Link href="/tasks?sort=priority" className="text-xs font-medium text-primary hover:underline">
                  All tasks
                </Link>
              </CardHeader>
              <CardContent className="px-2 pb-3">
                {o.priorityTasks.length ? (
                  <ul>
                    {o.priorityTasks.map((t) => (
                      <li key={t.id}>
                        <Link href={`/tasks?task=${t.id}`} className="flex items-center gap-3 rounded-md px-3 py-2 transition-colors hover:bg-accent">
                          <PriorityIcon priority={t.priority} />
                          <span className="min-w-0 flex-1">
                            <span className="block truncate text-[13px] font-medium">{t.title}</span>
                            <span className="block truncate text-xs text-muted-foreground">{t.project?.name ?? t.customer?.name ?? TASK_STATUS.label(t.status)}</span>
                          </span>
                          <DueLabel date={t.dueDate} today={today} />
                        </Link>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <EmptyState compact icon={CheckSquare} title="Nothing urgent" description="No overdue or high-priority open tasks." />
                )}
              </CardContent>
            </Card>
          </div>

          <div className="grid gap-4 lg:grid-cols-2 xl:grid-cols-3">
            <Card className="xl:col-span-2">
              <CardHeader>
                <div>
                  <CardTitle>Recent transactions</CardTitle>
                  <CardDescription>Latest money in and out</CardDescription>
                </div>
                <Link href="/finance" className="text-xs font-medium text-primary hover:underline">
                  View all
                </Link>
              </CardHeader>
              <CardContent className="px-0 pb-2">
                {o.recentTransactions.length ? (
                  <ul className="divide-y">
                    {o.recentTransactions.map((t) => (
                      <li key={t.id} className="flex items-center gap-3 px-5 py-2.5">
                        <span
                          className={cn(
                            "flex size-8 shrink-0 items-center justify-center rounded-md",
                            t.type === "INCOME" ? "bg-success-soft text-success" : "bg-destructive-soft text-destructive",
                          )}
                        >
                          {t.type === "INCOME" ? <TrendingUp className="size-4" /> : <TrendingDown className="size-4" />}
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-[13px] font-medium">{t.description}</span>
                          <span className="block truncate text-xs text-muted-foreground">
                            {t.category}
                            {t.customer ? ` · ${t.customer.name}` : ""} · {formatDateShort(t.date)}
                          </span>
                        </span>
                        <span className={cn("text-[13px] font-medium tabular", t.type === "INCOME" ? "text-success" : "text-foreground")}>
                          {t.type === "INCOME" ? "+" : "−"}
                          {money(t.amount)}
                        </span>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <EmptyState compact icon={Receipt} title="No transactions yet" />
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <div>
                  <CardTitle>Coming up</CardTitle>
                  <CardDescription>Events and deadlines</CardDescription>
                </div>
                <Link href="/calendar" className="text-xs font-medium text-primary hover:underline">
                  Calendar
                </Link>
              </CardHeader>
              <CardContent className="space-y-4">
                {o.events.length === 0 && o.deadlines.length === 0 ? (
                  <EmptyState compact icon={CalendarClock} title="A clear schedule" description="No upcoming events or deadlines in the next week." />
                ) : (
                  <>
                    {o.events.length > 0 && (
                      <ul className="space-y-2.5">
                        {o.events.map((e) => {
                          const key = instantToKey(e.startAt, tz);
                          return (
                            <li key={e.id}>
                              <Link href={`/calendar?event=${e.id}`} className="flex gap-3 rounded-md transition-colors hover:text-primary">
                                <span className="flex w-11 shrink-0 flex-col items-center rounded-md border bg-surface-2 py-1 text-center">
                                  <span className="text-[10px] font-medium uppercase text-muted-foreground">{formatInTimeZone(e.startAt, tz, "MMM")}</span>
                                  <span className="text-sm font-semibold leading-tight">{formatInTimeZone(e.startAt, tz, "d")}</span>
                                </span>
                                <span className="min-w-0 pt-0.5">
                                  <span className="block truncate text-[13px] font-medium">{e.title}</span>
                                  <span className="block truncate text-xs text-muted-foreground">
                                    {key === today ? "Today" : formatInTimeZone(e.startAt, tz, "EEE")} · {e.allDay ? "All day" : formatTime(e.startAt, tz)}
                                    {e.customer ? ` · ${e.customer.name}` : ""}
                                  </span>
                                </span>
                              </Link>
                            </li>
                          );
                        })}
                      </ul>
                    )}
                    {o.deadlines.length > 0 && (
                      <div>
                        <p className="mb-2 text-[11px] font-medium uppercase tracking-wider text-muted-foreground">Deadlines this week</p>
                        <ul className="space-y-1.5">
                          {o.deadlines.slice(0, 6).map((d) => (
                            <li key={`${d.kind}-${d.id}`} className="flex items-center justify-between gap-3 text-[13px]">
                              <Link href={d.href} className="flex min-w-0 items-center gap-2 hover:text-primary">
                                {d.kind === "project" ? <FolderKanban className="size-3.5 shrink-0 text-muted-foreground" /> : <CheckSquare className="size-3.5 shrink-0 text-muted-foreground" />}
                                <span className="truncate">{d.title}</span>
                              </Link>
                              <DueLabel date={d.date} today={today} />
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </>
                )}
              </CardContent>
            </Card>
          </div>

          <div className="grid gap-4 lg:grid-cols-3">
            <Card>
              <CardHeader>
                <div>
                  <CardTitle>Task completion</CardTitle>
                  <CardDescription>
                    {o.tasks.total ? `${Math.round((o.tasks.byStatus.DONE / o.tasks.total) * 100)}% of ${o.tasks.total} tasks completed` : "No tasks yet"}
                  </CardDescription>
                </div>
              </CardHeader>
              <CardContent>
                {o.tasks.total ? (
                  <BreakdownBar items={TASK_STATUS.list.map((s) => ({ label: s.label, value: o.tasks.byStatus[s.value] ?? 0, color: STATUS_COLORS[s.value] }))} />
                ) : (
                  <EmptyState compact icon={CheckSquare} title="No tasks yet" />
                )}
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <div>
                  <CardTitle>Projects by status</CardTitle>
                  <CardDescription>{o.projects.total} project{o.projects.total === 1 ? "" : "s"}</CardDescription>
                </div>
              </CardHeader>
              <CardContent>
                {o.projects.total ? (
                  <BreakdownBar
                    items={PROJECT_STATUS.list.map((s) => ({ label: s.label, value: o.projects.statusDistribution[s.value] ?? 0, color: STATUS_COLORS[s.value] }))}
                  />
                ) : (
                  <EmptyState compact icon={FolderKanban} title="No projects yet" />
                )}
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <div>
                  <CardTitle>Recently updated</CardTitle>
                  <CardDescription>Across your workspace</CardDescription>
                </div>
              </CardHeader>
              <CardContent className="px-2 pb-3">
                <ul>
                  {o.recent.map((r) => {
                    const Icon = RECENT_ICONS[r.type];
                    return (
                      <li key={`${r.type}-${r.id}`}>
                        <Link href={r.href} className="flex items-center gap-3 rounded-md px-3 py-1.5 transition-colors hover:bg-accent">
                          <Icon className="size-3.5 shrink-0 text-muted-foreground" />
                          <span className="min-w-0 flex-1 truncate text-[13px]">{r.title}</span>
                          <span className="shrink-0 text-xs text-muted-foreground">{formatDateTime(r.updatedAt, tz, "d MMM, h:mm a")}</span>
                        </Link>
                      </li>
                    );
                  })}
                </ul>
              </CardContent>
            </Card>
          </div>

          <Card>
            <div className="flex flex-col gap-3 px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="text-sm font-semibold">Quick actions</p>
                <p className="text-xs text-muted-foreground">
                  Press <kbd className="font-mono">Ctrl/⌘ K</kbd> anywhere to search or create.
                </p>
              </div>
              <QuickActions />
            </div>
          </Card>

        </>
      )}
    </div>
  );
}
