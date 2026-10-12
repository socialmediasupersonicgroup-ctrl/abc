"use client";

import * as React from "react";
import { Circle, CircleCheck, Plus } from "lucide-react";
import { createTaskAction, setTaskStatusAction } from "@/server/actions/tasks";
import { runClientAction } from "@/lib/client/actions";
import { TaskDialog } from "@/components/forms/task-form";
import { DueLabel, PriorityIcon } from "@/components/shared/bits";
import { TaskStatusMenu } from "./status-menu";
import { useApp } from "@/components/app/app-context";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import type { TaskItem } from "./tasks-view";
import { cn } from "@/lib/utils";

/** Task list used on project and customer pages, with inline quick-add. */
export function TaskListCompact({
  tasks,
  projectId,
  customerId,
  emptyText = "No tasks yet.",
}: {
  tasks: TaskItem[];
  projectId?: string | null;
  customerId?: string | null;
  emptyText?: string;
}) {
  const { today } = useApp();
  const [editing, setEditing] = React.useState<TaskItem | null>(null);
  const [title, setTitle] = React.useState("");
  const [adding, setAdding] = React.useState(false);
  const [optimistic, setOptimistic] = React.useState<Record<string, string>>({});
  React.useEffect(() => setOptimistic({}), [tasks]);

  async function add(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim()) return;
    setAdding(true);
    const res = await runClientAction(
      createTaskAction({ title, status: "TODO", priority: "MEDIUM", projectId: projectId ?? null, customerId: customerId ?? null, dueDate: "", description: "", assignee: "", tags: "" }),
      { success: "Task added" },
    );
    setAdding(false);
    if (res) setTitle("");
  }

  async function changeStatus(t: TaskItem, status: string) {
    setOptimistic((o) => ({ ...o, [t.id]: status }));
    const res = await runClientAction(setTaskStatusAction(t.id, status), { success: false });
    if (!res) setOptimistic((o) => ({ ...o, [t.id]: t.status }));
  }

  const rows = tasks.map((t) => (optimistic[t.id] ? { ...t, status: optimistic[t.id] } : t));

  return (
    <div>
      <form onSubmit={add} className="flex gap-2 px-5 pb-3">
        <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Add a task and press Enter…" className="h-8 text-[13px]" aria-label="New task title" maxLength={200} />
        <Button type="submit" size="sm" variant="outline" loading={adding} disabled={!title.trim()}>
          <Plus /> Add
        </Button>
      </form>
      {rows.length === 0 ? (
        <p className="px-5 pb-5 text-[13px] text-muted-foreground">{emptyText}</p>
      ) : (
        <ul className="divide-y border-t">
          {rows.map((t) => {
            const done = t.status === "DONE";
            return (
              <li key={t.id} className="flex items-center gap-3 px-5 py-2">
                <button
                  onClick={() => changeStatus(t, done ? "TODO" : "DONE")}
                  className="flex rounded-full text-muted-foreground hover:text-success focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  aria-label={done ? `Reopen “${t.title}”` : `Complete “${t.title}”`}
                >
                  {done ? <CircleCheck className="size-[18px] text-success" /> : <Circle className="size-[18px]" />}
                </button>
                <button onClick={() => setEditing(t)} className="min-w-0 flex-1 text-left focus-visible:outline-none">
                  <span className={cn("block truncate text-[13px] font-medium", done && "text-muted-foreground line-through")}>{t.title}</span>
                </button>
                <PriorityIcon priority={t.priority} />
                <span className="hidden sm:block">
                  <DueLabel date={t.dueDate} today={today} done={done} />
                </span>
                <TaskStatusMenu status={t.status} onChange={(s) => changeStatus(t, s)} />
              </li>
            );
          })}
        </ul>
      )}
      <TaskDialog open={!!editing} onOpenChange={(o) => !o && setEditing(null)} task={editing} />
    </div>
  );
}
