import Link from "next/link";
import { format, parseISO, startOfMonth, subMonths } from "date-fns";
import { BarChart3, CheckSquare, FileText, FolderKanban, Megaphone, Users, Wallet } from "lucide-react";
import { getContext } from "@/server/workspace";
import { getAnalytics } from "@/lib/services/analytics";
import { str, type SearchParams } from "@/server/load";
import { isDateKey, formatDate } from "@/lib/dates";
import { formatMoney } from "@/lib/money";
import { CONTENT_STATUS, INVOICE_STATUS, PROJECT_STATUS } from "@/lib/constants";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { EmptyState, PageHeader } from "@/components/ui/misc";
import { StatusBadge } from "@/components/ui/badge";
import { BreakdownBar } from "@/components/charts/charts";
import { CountArea, CountBars, MoneyArea, MoneyBars, RangePicker } from "@/components/analytics/analytics-charts";
import { ProgressBlock } from "@/components/projects/project-bits";
import { cn } from "@/lib/utils";

export const metadata = { title: "Analytics" };

const CAT = ["hsl(var(--chart-1))", "hsl(var(--chart-2))", "hsl(var(--chart-3))", "hsl(var(--chart-4))", "hsl(var(--chart-5))"];
const OTHER = "hsl(var(--muted-foreground) / 0.45)";
const STATUS_COLOR: Record<string, string> = {
  DRAFT: OTHER,
  SENT: "hsl(var(--chart-4))",
  PAID: "hsl(var(--chart-2))",
  OVERDUE: "hsl(var(--chart-3))",
  CANCELLED: "hsl(var(--chart-5))",
  IDEA: OTHER,
  PLANNED: "hsl(var(--chart-4))",
  IN_PRODUCTION: "hsl(var(--chart-1))",
  READY: "hsl(var(--chart-3))",
  PUBLISHED: "hsl(var(--chart-2))",
};

/** Top five categories keep fixed hues; the rest fold into "Other" (never a generated 6th hue). */
function topFive(items: { name: string; value: number }[]) {
  const top = items.slice(0, 5).map((c, i) => ({ label: c.name, value: c.value, color: CAT[i] }));
  const rest = items.slice(5).reduce((s, c) => s + c.value, 0);
  return rest > 0 ? [...top, { label: "Other", value: rest, color: OTHER }] : top;
}

export default async function AnalyticsPage({ searchParams }: { searchParams: SearchParams }) {
  const sp = await searchParams;
  const { workspaceId, today, currency } = await getContext();
  const defFrom = format(startOfMonth(subMonths(parseISO(today), 11)), "yyyy-MM-dd");
  let from = isDateKey(str(sp.from)) ? str(sp.from) : defFrom;
  let to = isDateKey(str(sp.to)) ? str(sp.to) : today;
  if (from > to) [from, to] = [to, from];
  const a = await getAnalytics(workspaceId, { from, to }, today);
  const m = (v: number) => formatMoney(v, currency);
  const hasFinance = a.totals.count > 0;

  return (
    <div className="space-y-6">
      <PageHeader title="Analytics" description={`Insights from your recorded data · ${formatDate(from)} – ${formatDate(to)}`} />
      <RangePicker from={from} to={to} />

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {[
          { label: "Revenue", value: m(a.totals.income), icon: Wallet },
          { label: "Expenses", value: m(a.totals.expense), icon: Wallet },
          { label: "Net income", value: m(a.totals.net), icon: BarChart3, danger: a.totals.net < 0 },
          { label: "Invoice collection rate", value: a.invoices.collectionRate == null ? "—" : `${a.invoices.collectionRate}%`, icon: FileText },
        ].map((s) => (
          <Card key={s.label} className="p-4">
            <div className="flex items-center justify-between">
              <p className="text-[13px] font-medium text-muted-foreground">{s.label}</p>
              <s.icon className="size-4 text-muted-foreground/70" />
            </div>
            <p className={cn("mt-2 text-[22px] font-semibold tabular", s.danger && "text-destructive")}>{s.value}</p>
          </Card>
        ))}
      </div>

      <div className="grid gap-4 xl:grid-cols-3">
        <Card className="xl:col-span-2">
          <CardHeader>
            <div>
              <CardTitle>Revenue & expenses over time</CardTitle>
              <CardDescription>Monthly totals from transactions (invoice payments included as income)</CardDescription>
            </div>
          </CardHeader>
          <CardContent>
            {hasFinance ? (
              <MoneyBars data={a.financeSeries} keys={["income", "expense"]} />
            ) : (
              <EmptyState compact icon={Wallet} title="No transactions in this period" description="Record income and expenses, or widen the date range." />
            )}
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <div>
              <CardTitle>Expenses by category</CardTitle>
              <CardDescription>Where the money went</CardDescription>
            </div>
          </CardHeader>
          <CardContent>
            {a.expenseByCategory.length ? (
              <BreakdownBar items={topFive(a.expenseByCategory)} money />
            ) : (
              <EmptyState compact icon={Wallet} title="No expenses in this period" />
            )}
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 xl:grid-cols-2">
        <Card>
          <CardHeader>
            <div>
              <CardTitle>Net income by month</CardTitle>
              <CardDescription>Income minus expenses</CardDescription>
            </div>
          </CardHeader>
          <CardContent>{hasFinance ? <MoneyBars data={a.financeSeries} keys={["net"]} /> : <EmptyState compact icon={BarChart3} title="Not enough data" description="Net income appears once transactions exist in this period." />}</CardContent>
        </Card>
        <Card>
          <CardHeader>
            <div>
              <CardTitle>Cumulative net income</CardTitle>
              <CardDescription>Running total across the selected period</CardDescription>
            </div>
          </CardHeader>
          <CardContent>{hasFinance ? <MoneyArea data={a.financeSeries} dataKey="cumulative" label="Cumulative net" /> : <EmptyState compact icon={BarChart3} title="Not enough data" />}</CardContent>
        </Card>
      </div>

      <div className="grid gap-4 xl:grid-cols-2">
        <Card>
          <CardHeader>
            <div>
              <CardTitle>Task throughput</CardTitle>
              <CardDescription>
                {a.tasksCreatedTotal} created · {a.tasksCompletedTotal} completed in this period
              </CardDescription>
            </div>
          </CardHeader>
          <CardContent>
            {a.tasksCreatedTotal + a.tasksCompletedTotal > 0 ? (
              <CountBars
                data={a.taskSeries}
                series={[
                  { key: "created", label: "Created", color: "chart-4" },
                  { key: "completed", label: "Completed", color: "chart-2" },
                ]}
              />
            ) : (
              <EmptyState compact icon={CheckSquare} title="No task activity in this period" />
            )}
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <div>
              <CardTitle>Customer growth</CardTitle>
              <CardDescription>{a.customersAdded} new customer{a.customersAdded === 1 ? "" : "s"} in this period · total at month end</CardDescription>
            </div>
          </CardHeader>
          <CardContent>
            {a.customerSeries.some((c) => c.total > 0) ? (
              <CountArea data={a.customerSeries} dataKey="total" label="Customers" />
            ) : (
              <EmptyState compact icon={Users} title="No customers yet" />
            )}
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 xl:grid-cols-3">
        <Card>
          <CardHeader>
            <div>
              <CardTitle>Invoice collection</CardTitle>
              <CardDescription>Invoices issued in this period</CardDescription>
            </div>
          </CardHeader>
          <CardContent>
            {a.invoices.count ? (
              <>
                <dl className="mb-5 grid grid-cols-3 gap-2 text-center">
                  <div className="rounded-md bg-surface-2 p-2">
                    <dt className="text-[11px] text-muted-foreground">Invoiced</dt>
                    <dd className="text-[13px] font-semibold tabular">{m(a.invoices.invoiced)}</dd>
                  </div>
                  <div className="rounded-md bg-surface-2 p-2">
                    <dt className="text-[11px] text-muted-foreground">Collected</dt>
                    <dd className="text-[13px] font-semibold tabular text-success">{m(a.invoices.collected)}</dd>
                  </div>
                  <div className="rounded-md bg-surface-2 p-2">
                    <dt className="text-[11px] text-muted-foreground">Outstanding</dt>
                    <dd className="text-[13px] font-semibold tabular">{m(a.invoices.outstanding)}</dd>
                  </div>
                </dl>
                <BreakdownBar
                  items={INVOICE_STATUS.list.map((s) => ({ label: `${s.label} (${a.invoices.byStatus[s.value]?.count ?? 0})`, value: a.invoices.byStatus[s.value]?.amount ?? 0, color: STATUS_COLOR[s.value] }))}
                  money
                />
              </>
            ) : (
              <EmptyState compact icon={FileText} title="No invoices issued in this period" />
            )}
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <div>
              <CardTitle>Project progress</CardTitle>
              <CardDescription>Open projects, by deadline</CardDescription>
            </div>
            <Link href="/projects" className="text-xs font-medium text-primary hover:underline">
              All projects
            </Link>
          </CardHeader>
          <CardContent>
            {a.projects.length ? (
              <ul className="space-y-4">
                {a.projects.map((p) => (
                  <li key={p.id}>
                    <div className="mb-1 flex items-center justify-between gap-2">
                      <Link href={`/projects/${p.id}`} className="truncate text-[13px] font-medium hover:text-primary">
                        {p.name}
                      </Link>
                      <StatusBadge options={PROJECT_STATUS} value={p.status} />
                    </div>
                    <ProgressBlock progress={p.progress} compact />
                  </li>
                ))}
              </ul>
            ) : (
              <EmptyState compact icon={FolderKanban} title="No open projects" />
            )}
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <div>
              <CardTitle>Content production</CardTitle>
              <CardDescription>{a.content.total} items in the pipeline (all time)</CardDescription>
            </div>
          </CardHeader>
          <CardContent>
            {a.content.total ? (
              <BreakdownBar items={CONTENT_STATUS.list.map((s) => ({ label: s.label, value: a.content.byStatus[s.value] ?? 0, color: STATUS_COLOR[s.value] }))} />
            ) : (
              <EmptyState compact icon={Megaphone} title="No content planned yet" />
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
