import { AlertCircle, ArrowDown, ArrowUp, ChevronsUp, Equal } from "lucide-react";
import { PRIORITY } from "@/lib/constants";
import { dateToKey, formatDateShort, relativeDue } from "@/lib/dates";
import { cn } from "@/lib/utils";

const PRIORITY_ICON = { URGENT: ChevronsUp, HIGH: ArrowUp, MEDIUM: Equal, LOW: ArrowDown } as const;
const PRIORITY_COLOR = { URGENT: "text-destructive", HIGH: "text-warning", MEDIUM: "text-info", LOW: "text-muted-foreground" } as const;

export function PriorityIcon({ priority, withLabel, className }: { priority: string; withLabel?: boolean; className?: string }) {
  const key = (priority in PRIORITY_ICON ? priority : "MEDIUM") as keyof typeof PRIORITY_ICON;
  const Icon = PRIORITY_ICON[key];
  return (
    <span className={cn("inline-flex items-center gap-1 text-xs", PRIORITY_COLOR[key], className)} title={`${PRIORITY.label(key)} priority`}>
      <Icon className="size-3.5" aria-hidden />
      {withLabel ? <span className="text-foreground/80">{PRIORITY.label(key)}</span> : <span className="sr-only">{PRIORITY.label(key)} priority</span>}
    </span>
  );
}

export function DueLabel({ date, today, done, className }: { date: Date | null; today: string; done?: boolean; className?: string }) {
  if (!date) return <span className={cn("text-xs text-muted-foreground/70", className)}>No date</span>;
  if (done) return <span className={cn("whitespace-nowrap text-xs text-muted-foreground", className)}>{formatDateShort(date)}</span>;
  const r = relativeDue(dateToKey(date), today);
  const tone = done ? "text-muted-foreground" : r.tone === "overdue" ? "text-destructive font-medium" : r.tone === "today" ? "text-warning font-medium" : "text-muted-foreground";
  return (
    <span className={cn("inline-flex items-center gap-1 whitespace-nowrap text-xs", tone, className)}>
      {!done && r.tone === "overdue" && <AlertCircle className="size-3" aria-hidden />}
      {r.label}
    </span>
  );
}
