import Link from "next/link";
import { ArrowDownRight, ArrowUpRight, Minus } from "lucide-react";
import { cn } from "@/lib/utils";

export function ChangeIndicator({ value, goodWhenUp = true, label = "vs previous period" }: { value: number | null; goodWhenUp?: boolean; label?: string }) {
  if (value == null) return null;
  const up = value > 0;
  const flat = value === 0;
  const good = flat ? null : up === goodWhenUp;
  const Icon = flat ? Minus : up ? ArrowUpRight : ArrowDownRight;
  return (
    <span className="inline-flex items-center gap-1 text-xs">
      <span
        className={cn(
          "inline-flex items-center gap-0.5 rounded px-1 font-medium tabular",
          good == null ? "bg-muted text-muted-foreground" : good ? "bg-success-soft text-success" : "bg-destructive-soft text-destructive",
        )}
      >
        <Icon className="size-3" />
        {Math.abs(value).toLocaleString("en-IN", { maximumFractionDigits: 1 })}%
      </span>
      <span className="text-muted-foreground">{label}</span>
    </span>
  );
}

export function StatCard({
  label,
  value,
  icon: Icon,
  footer,
  href,
  tone,
  testId,
}: {
  label: string;
  value: React.ReactNode;
  icon: React.ComponentType<{ className?: string }>;
  footer?: React.ReactNode;
  href?: string;
  tone?: "danger" | "success";
  testId?: string;
}) {
  const body = (
    <>
      <div className="flex items-center justify-between">
        <p className="text-[13px] font-medium text-muted-foreground">{label}</p>
        <Icon className="size-4 text-muted-foreground/70" />
      </div>
      <p
        className={cn(
          "mt-2 truncate text-[22px] font-semibold tracking-tight tabular",
          tone === "danger" && "text-destructive",
          tone === "success" && "text-success",
        )}
        data-testid={testId}
      >
        {value}
      </p>
      <div className="mt-1.5 min-h-[18px] text-xs text-muted-foreground">{footer}</div>
    </>
  );
  const cls = "block rounded-lg border bg-card p-4 shadow-card transition-colors";
  return href ? (
    <Link href={href} className={cn(cls, "hover:border-foreground/15 hover:bg-surface-2/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring")}>
      {body}
    </Link>
  ) : (
    <div className={cls}>{body}</div>
  );
}
