"use client";

import * as React from "react";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
  type TooltipProps,
} from "recharts";
import { useChartTheme } from "./use-chart-theme";
import { useMoney } from "@/components/app/app-context";
import { Skeleton } from "@/components/ui/misc";
import { cn } from "@/lib/utils";

export type Series = { key: string; label: string; color: "chart-1" | "chart-2" | "chart-3" | "chart-4" | "chart-5" | "success" | "destructive" };

type Formatter = (v: number) => string;

function ChartTooltip({ active, payload, label, format, series }: TooltipProps<number, string> & { format: Formatter; series: Series[] }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="min-w-[160px] rounded-lg border bg-popover px-3 py-2 text-xs shadow-pop">
      <p className="mb-1.5 font-medium text-foreground">{label}</p>
      <div className="grid gap-1">
        {payload.map((p) => {
          const s = series.find((x) => x.key === p.dataKey);
          return (
            <div key={String(p.dataKey)} className="flex items-center justify-between gap-4">
              <span className="flex items-center gap-1.5 text-muted-foreground">
                <span className="size-2 rounded-sm" style={{ background: p.color }} />
                {s?.label ?? p.name}
              </span>
              <span className="font-medium tabular text-foreground">{format(Number(p.value))}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export function Legend({ series, className }: { series: Series[]; className?: string }) {
  if (series.length < 2) return null;
  return (
    <div className={cn("flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground", className)}>
      {series.map((s) => (
        <span key={s.key} className="flex items-center gap-1.5">
          <span className="size-2.5 rounded-sm" style={{ background: `hsl(var(--${s.color}))` }} />
          {s.label}
        </span>
      ))}
    </div>
  );
}

function axisProps(muted: string) {
  return { tick: { fill: muted, fontSize: 11 }, tickLine: false, axisLine: false } as const;
}

export function BarSeriesChart({
  data,
  xKey,
  series,
  format,
  axisFormat,
  height = 260,
  stacked,
}: {
  data: Record<string, string | number>[];
  xKey: string;
  series: Series[];
  format: Formatter;
  axisFormat?: Formatter;
  height?: number;
  stacked?: boolean;
}) {
  const c = useChartTheme();
  if (!c) return <Skeleton style={{ height }} />;
  return (
    <div>
      <Legend series={series} className="mb-3" />
      <div style={{ height }} role="img" aria-label={`Bar chart of ${series.map((s) => s.label).join(" and ")}`}>
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} barGap={2} barCategoryGap="28%" margin={{ top: 4, right: 4, left: 0, bottom: 0 }}>
            <CartesianGrid vertical={false} stroke={c.border} strokeDasharray="3 3" />
            <XAxis dataKey={xKey} {...axisProps(c["muted-foreground"])} dy={6} />
            <YAxis {...axisProps(c["muted-foreground"])} width={56} tickFormatter={axisFormat ?? format} allowDecimals={false} />
            <Tooltip cursor={{ fill: c.border, opacity: 0.4 }} content={<ChartTooltip format={format} series={series} />} />
            {series.map((s, i) => (
              <Bar
                key={s.key}
                dataKey={s.key}
                name={s.label}
                fill={c[s.color]}
                radius={stacked ? (i === series.length - 1 ? [4, 4, 0, 0] : [0, 0, 0, 0]) : [4, 4, 0, 0]}
                maxBarSize={28}
                animationDuration={500}
                stackId={stacked ? "a" : undefined}
                stroke={stacked ? c.popover : undefined}
                strokeWidth={stacked ? 1 : 0}
              />
            ))}
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

export function AreaSeriesChart({
  data,
  xKey,
  series,
  format,
  axisFormat,
  height = 240,
}: {
  data: Record<string, string | number>[];
  xKey: string;
  series: Series[];
  format: Formatter;
  axisFormat?: Formatter;
  height?: number;
}) {
  const c = useChartTheme();
  const id = React.useId().replace(/:/g, "");
  if (!c) return <Skeleton style={{ height }} />;
  return (
    <div>
      <Legend series={series} className="mb-3" />
      <div style={{ height }} role="img" aria-label={`Trend of ${series.map((s) => s.label).join(" and ")}`}>
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={data} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
            <defs>
              {series.map((s) => (
                <linearGradient key={s.key} id={`${id}-${s.key}`} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={c[s.color]} stopOpacity={0.22} />
                  <stop offset="100%" stopColor={c[s.color]} stopOpacity={0} />
                </linearGradient>
              ))}
            </defs>
            <CartesianGrid vertical={false} stroke={c.border} strokeDasharray="3 3" />
            <XAxis dataKey={xKey} {...axisProps(c["muted-foreground"])} dy={6} />
            <YAxis {...axisProps(c["muted-foreground"])} width={56} tickFormatter={axisFormat ?? format} allowDecimals={false} />
            <Tooltip cursor={{ stroke: c["muted-foreground"], strokeDasharray: "3 3" }} content={<ChartTooltip format={format} series={series} />} />
            {series.map((s) => (
              <Area
                key={s.key}
                type="monotone"
                dataKey={s.key}
                name={s.label}
                stroke={c[s.color]}
                strokeWidth={2}
                fill={`url(#${id}-${s.key})`}
                dot={false}
                activeDot={{ r: 4, strokeWidth: 2, stroke: c.popover }}
                animationDuration={500}
              />
            ))}
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

/** Proportional breakdown as a single segmented bar with a labelled legend (HTML, accessible). */
export function BreakdownBar({ items, money: asMoney }: { items: { label: string; value: number; color: string }[]; money?: boolean }) {
  const money = useMoney();
  const format = (v: number) => (asMoney ? money.format(v) : v.toLocaleString("en-IN"));
  const total = items.reduce((s, i) => s + i.value, 0);
  if (total === 0) return null;
  const visible = items.filter((i) => i.value > 0);
  return (
    <div>
      <div className="flex h-2.5 w-full gap-[2px] overflow-hidden rounded-full" aria-hidden>
        {visible.map((i) => (
          <div key={i.label} className="h-full first:rounded-l-full last:rounded-r-full" style={{ width: `${(i.value / total) * 100}%`, background: i.color }} />
        ))}
      </div>
      <ul className="mt-4 grid gap-2">
        {items.map((i) => (
          <li key={i.label} className="flex items-center justify-between gap-3 text-[13px]">
            <span className="flex items-center gap-2 text-muted-foreground">
              <span className="size-2.5 rounded-sm" style={{ background: i.color }} />
              {i.label}
            </span>
            <span className="tabular">
              <span className="font-medium">{format(i.value)}</span>
              <span className="ml-2 inline-block w-9 text-right text-xs text-muted-foreground">{Math.round((i.value / total) * 100)}%</span>
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}
