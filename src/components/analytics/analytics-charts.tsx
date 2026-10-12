"use client";

import { endOfMonth, format, parseISO, startOfMonth, startOfYear, subMonths } from "date-fns";
import { AreaSeriesChart, BarSeriesChart } from "@/components/charts/charts";
import { useApp, useMoney } from "@/components/app/app-context";
import { Input } from "@/components/ui/input";
import { useUrlParams } from "@/components/shared/url-filters";
import { cn } from "@/lib/utils";

type Row = Record<string, string | number>;

export function MoneyBars({ data, keys }: { data: Row[]; keys: ("income" | "expense" | "net")[] }) {
  const money = useMoney();
  const meta = { income: { label: "Income", color: "chart-1" as const }, expense: { label: "Expenses", color: "chart-3" as const }, net: { label: "Net income", color: "chart-2" as const } };
  return <BarSeriesChart data={data} xKey="label" series={keys.map((k) => ({ key: k, ...meta[k] }))} format={money.format} axisFormat={money.compact} />;
}

export function CountBars({ data, series }: { data: Row[]; series: { key: string; label: string; color: "chart-1" | "chart-2" | "chart-4" }[] }) {
  return <BarSeriesChart data={data} xKey="label" series={series} format={(v) => v.toLocaleString("en-IN")} height={220} />;
}

export function CountArea({ data, dataKey, label }: { data: Row[]; dataKey: string; label: string }) {
  return <AreaSeriesChart data={data} xKey="label" series={[{ key: dataKey, label, color: "chart-4" }]} format={(v) => v.toLocaleString("en-IN")} height={220} />;
}

export function MoneyArea({ data, dataKey, label }: { data: Row[]; dataKey: string; label: string }) {
  const money = useMoney();
  return <AreaSeriesChart data={data} xKey="label" series={[{ key: dataKey, label, color: "chart-2" }]} format={money.format} axisFormat={money.compact} height={220} />;
}

export function RangePicker({ from, to }: { from: string; to: string }) {
  const { set } = useUrlParams();
  const { today } = useApp();
  const t = parseISO(today);
  const k = (d: Date) => format(d, "yyyy-MM-dd");
  const presets = [
    { label: "3 months", from: k(startOfMonth(subMonths(t, 2))), to: today },
    { label: "6 months", from: k(startOfMonth(subMonths(t, 5))), to: today },
    { label: "12 months", from: k(startOfMonth(subMonths(t, 11))), to: today },
    { label: "This year", from: k(startOfYear(t)), to: today },
    { label: "Last month", from: k(startOfMonth(subMonths(t, 1))), to: k(endOfMonth(subMonths(t, 1))) },
  ];
  return (
    <div className="flex flex-wrap items-center gap-2">
      {presets.map((p) => (
        <button
          key={p.label}
          onClick={() => set({ from: p.from, to: p.to })}
          className={cn(
            "h-8 rounded-md border px-2.5 text-xs font-medium transition-colors",
            p.from === from && p.to === to ? "border-primary/40 bg-primary-soft text-primary" : "text-muted-foreground hover:bg-accent hover:text-foreground",
          )}
        >
          {p.label}
        </button>
      ))}
      <Input type="date" aria-label="From" value={from} max={to} onChange={(e) => e.target.value && set({ from: e.target.value })} className="h-8 w-[140px] text-[13px]" />
      <span className="text-xs text-muted-foreground">to</span>
      <Input type="date" aria-label="To" value={to} min={from} onChange={(e) => e.target.value && set({ to: e.target.value })} className="h-8 w-[140px] text-[13px]" />
    </div>
  );
}
