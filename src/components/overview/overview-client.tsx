"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { CalendarPlus, CheckSquare, FileText, FlaskConical, FolderPlus, Receipt, UserPlus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/input";
import { useApp, useMoney } from "@/components/app/app-context";
import { BarSeriesChart } from "@/components/charts/charts";
import { PERIODS, type MonthPoint } from "@/lib/calc/metrics";
import { loadDemoWorkspaceAction } from "@/server/actions/workspace";
import { runClientAction } from "@/lib/client/actions";
import { Card } from "@/components/ui/card";
import * as React from "react";

export function PeriodSelect({ value }: { value: string }) {
  const router = useRouter();
  const params = useSearchParams();
  return (
    <Select
      aria-label="Reporting period"
      className="h-8 w-[150px] text-[13px]"
      value={value}
      onChange={(e) => {
        const next = new URLSearchParams(params);
        next.set("period", e.target.value);
        router.push(`/?${next.toString()}`);
      }}
    >
      {PERIODS.map((p) => (
        <option key={p.value} value={p.value}>
          {p.label}
        </option>
      ))}
    </Select>
  );
}

export function QuickActions() {
  const { openCreate } = useApp();
  const actions = [
    { label: "Task", icon: CheckSquare, onClick: () => openCreate("task") },
    { label: "Project", icon: FolderPlus, onClick: () => openCreate("project") },
    { label: "Customer", icon: UserPlus, onClick: () => openCreate("customer") },
    { label: "Transaction", icon: Receipt, onClick: () => openCreate("transaction") },
    { label: "Event", icon: CalendarPlus, onClick: () => openCreate("event") },
  ];
  return (
    <div className="flex flex-wrap gap-2">
      {actions.map((a) => (
        <Button key={a.label} variant="outline" size="sm" onClick={a.onClick}>
          <a.icon /> {a.label}
        </Button>
      ))}
      <Button variant="outline" size="sm" asChild>
        <Link href="/finance/invoices/new">
          <FileText /> Invoice
        </Link>
      </Button>
    </div>
  );
}

export function CashflowChart({ data }: { data: MonthPoint[] }) {
  const money = useMoney();
  return (
    <BarSeriesChart
      data={data}
      xKey="label"
      series={[
        { key: "income", label: "Income", color: "chart-1" },
        { key: "expense", label: "Expenses", color: "chart-3" },
      ]}
      format={money.format}
      axisFormat={money.compact}
    />
  );
}

export function Onboarding() {
  const { openCreate, workspace } = useApp();
  const router = useRouter();
  const [loading, setLoading] = React.useState(false);
  const steps = [
    { title: "Add your first customer", body: "Keep contacts, deal value and follow-ups in one place.", icon: UserPlus, action: () => openCreate("customer"), cta: "Add customer" },
    { title: "Start a project", body: "Plan scope, budget and deadlines, then break it into tasks.", icon: FolderPlus, action: () => openCreate("project"), cta: "Create project" },
    { title: "Capture a task", body: "Track what needs doing, by when, and its priority.", icon: CheckSquare, action: () => openCreate("task"), cta: "Add task" },
    { title: "Record money in or out", body: "Transactions power your revenue, expense and profit figures.", icon: Receipt, action: () => openCreate("transaction"), cta: "Record transaction" },
  ];
  return (
    <Card className="overflow-hidden">
      <div className="border-b bg-surface-2/50 px-6 py-6">
        <p className="text-xs font-medium uppercase tracking-wider text-primary">Getting started</p>
        <h2 className="mt-1 text-lg font-semibold tracking-tight">Welcome to {workspace.name}</h2>
        <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
          This workspace is empty. Your dashboard fills in automatically from the records you create — nothing here is estimated or invented.
        </p>
      </div>
      <div className="grid gap-px bg-border sm:grid-cols-2 lg:grid-cols-4">
        {steps.map((s, i) => (
          <div key={s.title} className="flex flex-col bg-card p-5">
            <div className="mb-3 flex items-center gap-2">
              <span className="flex size-6 items-center justify-center rounded-full bg-primary-soft text-[11px] font-semibold text-primary">{i + 1}</span>
              <s.icon className="size-4 text-muted-foreground" />
            </div>
            <p className="text-sm font-medium">{s.title}</p>
            <p className="mt-1 flex-1 text-[13px] text-muted-foreground">{s.body}</p>
            <Button variant="outline" size="sm" className="mt-4 self-start" onClick={s.action}>
              {s.cta}
            </Button>
          </div>
        ))}
      </div>
      <div className="flex flex-col gap-3 border-t px-6 py-4 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-[13px] text-muted-foreground">
          Want to explore first? Open a separate demo workspace filled with clearly labelled, fictional sample data.
        </p>
        <Button
          variant="secondary"
          size="sm"
          loading={loading}
          onClick={async () => {
            setLoading(true);
            const res = await runClientAction(loadDemoWorkspaceAction());
            setLoading(false);
            if (res) router.refresh();
          }}
        >
          <FlaskConical /> Open demo workspace
        </Button>
      </div>
    </Card>
  );
}
