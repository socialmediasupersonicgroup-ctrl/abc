import { CalendarClock } from "lucide-react";
import { Progress } from "@/components/ui/misc";
import { dateToKey, daysBetweenKeys, formatDateShort } from "@/lib/dates";
import { cn } from "@/lib/utils";
import type { ProgressSource } from "@/lib/calc/progress";

export function ProgressBlock({ progress, compact }: { progress: { value: number; source: ProgressSource; done: number; total: number }; compact?: boolean }) {
  const caption =
    progress.source === "tasks"
      ? `${progress.done}/${progress.total} tasks done`
      : progress.source === "manual"
        ? "Set manually"
        : "No tasks yet";
  return (
    <div>
      <div className="mb-1.5 flex items-center justify-between text-xs">
        <span className="text-muted-foreground">{caption}</span>
        <span className="font-medium tabular">{progress.source === "none" ? "—" : `${progress.value}%`}</span>
      </div>
      <Progress value={progress.value} tone={progress.value === 100 ? "success" : "primary"} className={compact ? "h-1" : undefined} />
    </div>
  );
}

const CLOSED = ["COMPLETED", "CANCELLED"];

export function deadlineState(status: string, dueDate: Date | null, today: string) {
  if (!dueDate || CLOSED.includes(status)) return null;
  const diff = daysBetweenKeys(today, dateToKey(dueDate));
  if (diff < 0) return { tone: "overdue" as const, label: `${Math.abs(diff)}d overdue` };
  if (diff <= 7) return { tone: "soon" as const, label: diff === 0 ? "Due today" : `Due in ${diff}d` };
  return null;
}

export function DeadlineChip({ status, dueDate, today }: { status: string; dueDate: Date | null; today: string }) {
  if (!dueDate) return <span className="text-xs text-muted-foreground">No deadline</span>;
  const state = deadlineState(status, dueDate, today);
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 text-xs",
        state?.tone === "overdue" ? "font-medium text-destructive" : state?.tone === "soon" ? "font-medium text-warning" : "text-muted-foreground",
      )}
    >
      <CalendarClock className="size-3.5" />
      {state ? state.label : formatDateShort(dueDate)}
    </span>
  );
}
