"use client";

import * as React from "react";
import Link from "next/link";
import { CheckSquare, Circle, CircleCheck, Columns3, List, Plus } from "lucide-react";
import { PRIORITY, TASK_STATUS, type TaskStatus } from "@/lib/constants";
import { dateToKey } from "@/lib/dates";
import { setTaskStatusAction } from "@/server/actions/tasks";
import { runClientAction } from "@/lib/client/actions";
import { TaskDialog, type TaskRecord } from "@/components/forms/task-form";
import { useApp } from "@/components/app/app-context";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/misc";
import { Table, TableWrap, TBody, TD, TH, THead, TR } from "@/components/ui/table";
import { ClearFilters, SearchFilter, Segmented, SelectFilter, useUrlParams } from "@/components/shared/url-filters";
import { DueLabel, PriorityIcon } from "@/components/shared/bits";
import { TaskStatusMenu } from "./status-menu";
import { cn } from "@/lib/utils";

export type TaskItem = Omit<TaskRecord, "tags"> & {
  project: { id: string; name: string } | null;
  customer: { id: string; name: string } | null;
  tags: { id: string; name: string }[];
};

const FILTER_KEYS = ["q", "status", "priority", "projectId", "tag", "due"];

export function TasksView({ tasks, tags, selected, view }: { tasks: TaskItem[]; tags: string[]; selected: TaskItem | null; view: "list" | "board" }) {
  const { options, today, openCreate } = useApp();
  const { params, set } = useUrlParams();
  const [optimistic, setOptimistic] = React.useState<Record<string, string>>({});
  const [editing, setEditing] = React.useState<TaskItem | null>(selected);

  React.useEffect(() => setEditing(selected), [selected]);
  // Clear optimistic overrides once fresh server data arrives.
  React.useEffect(() => setOptimistic({}), [tasks]);

  const rows = tasks.map((t) => (optimistic[t.id] ? { ...t, status: optimistic[t.id] } : t));

  async function changeStatus(task: TaskItem, status: string) {
    setOptimistic((o) => ({ ...o, [task.id]: status }));
    const res = await runClientAction(setTaskStatusAction(task.id, status), {
      success: status === "DONE" ? `Completed “${task.title}”` : `Moved to ${TASK_STATUS.label(status)}`,
    });
    if (!res) setOptimistic((o) => ({ ...o, [task.id]: task.status }));
  }

  function openTask(task: TaskItem | null) {
    setEditing(task);
    if (!task && params.get("task")) set({ task: null }, { replace: true });
  }

  const hasFilters = FILTER_KEYS.some((k) => params.get(k));

  return (
    <>
      <div className="mb-4 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex flex-wrap items-center gap-2">
          <SearchFilter placeholder="Search tasks…" />
          <SelectFilter param="status" label="Status" allLabel="All statuses" options={TASK_STATUS.list.map((s) => ({ value: s.value, label: s.label }))} />
          <SelectFilter param="priority" label="Priority" allLabel="Any priority" options={PRIORITY.list.map((s) => ({ value: s.value, label: s.label }))} />
          <SelectFilter param="projectId" label="Project" allLabel="All projects" options={options.projects.map((p) => ({ value: p.id, label: p.name }))} />
          <SelectFilter
            param="due"
            label="Due"
            allLabel="Any due date"
            options={[
              { value: "overdue", label: "Overdue" },
              { value: "today", label: "Due today" },
              { value: "week", label: "Next 7 days" },
              { value: "none", label: "No due date" },
            ]}
          />
          {tags.length > 0 && <SelectFilter param="tag" label="Tag" allLabel="Any tag" options={tags.map((t) => ({ value: t, label: `#${t}` }))} />}
          <ClearFilters keys={FILTER_KEYS} />
        </div>
        <div className="flex items-center gap-2">
          <SelectFilter
            param="sort"
            label="Sort"
            allLabel="Sort: due date"
            options={[
              { value: "priority", label: "Sort: priority" },
              { value: "updated", label: "Sort: recently updated" },
              { value: "created", label: "Sort: newest" },
              { value: "title", label: "Sort: title" },
            ]}
          />
          <Segmented
            label="View"
            value={view}
            onChange={(v) => set({ view: v === "list" ? null : v }, { replace: true })}
            options={[
              { value: "list", label: "List", icon: List },
              { value: "board", label: "Board", icon: Columns3 },
            ]}
          />
        </div>
      </div>

      {rows.length === 0 ? (
        <Card>
          <EmptyState
            icon={CheckSquare}
            title={hasFilters ? "No tasks match these filters" : "No tasks yet"}
            description={hasFilters ? "Try a different search or clear the filters." : "Create your first task to start tracking work."}
            action={
              !hasFilters && (
                <Button onClick={() => openCreate("task")}>
                  <Plus /> New task
                </Button>
              )
            }
          />
        </Card>
      ) : view === "board" ? (
        <Board tasks={rows} today={today} onOpen={openTask} onStatus={changeStatus} />
      ) : (
        <Card className="overflow-hidden">
          <TableWrap>
            <Table>
              <THead>
                <tr>
                  <TH className="w-10 pr-0">
                    <span className="sr-only">Done</span>
                  </TH>
                  <TH>Task</TH>
                  <TH>Status</TH>
                  <TH className="hidden md:table-cell">Priority</TH>
                  <TH>Due</TH>
                  <TH className="hidden lg:table-cell">Project / customer</TH>
                  <TH className="hidden xl:table-cell">Assignee</TH>
                </tr>
              </THead>
              <TBody>
                {rows.map((t) => {
                  const done = t.status === "DONE";
                  return (
                    <TR key={t.id} data-testid="task-row">
                      <TD className="w-10 pr-0">
                        <button
                          onClick={() => changeStatus(t, done ? "TODO" : "DONE")}
                          className="flex rounded-full text-muted-foreground transition-colors hover:text-success focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                          aria-label={done ? `Mark “${t.title}” as not done` : `Mark “${t.title}” as done`}
                        >
                          {done ? <CircleCheck className="size-[18px] text-success" /> : <Circle className="size-[18px]" />}
                        </button>
                      </TD>
                      <TD className="max-w-[360px]">
                        <button onClick={() => openTask(t)} className="block w-full text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
                          <span className={cn("block truncate font-medium", done && "text-muted-foreground line-through decoration-muted-foreground/50")}>{t.title}</span>
                          {t.tags.length > 0 && (
                            <span className="mt-0.5 flex flex-wrap gap-1">
                              {t.tags.map((tag) => (
                                <span key={tag.id} className="text-[11px] text-muted-foreground">
                                  #{tag.name}
                                </span>
                              ))}
                            </span>
                          )}
                        </button>
                      </TD>
                      <TD>
                        <TaskStatusMenu status={t.status} onChange={(s) => changeStatus(t, s)} />
                      </TD>
                      <TD className="hidden md:table-cell">
                        <PriorityIcon priority={t.priority} withLabel />
                      </TD>
                      <TD>
                        <DueLabel date={t.dueDate} today={today} done={done} />
                      </TD>
                      <TD className="hidden max-w-[220px] lg:table-cell">
                        <span className="block truncate text-[13px] text-muted-foreground">
                          {t.project ? (
                            <Link href={`/projects/${t.project.id}`} className="hover:text-foreground hover:underline">
                              {t.project.name}
                            </Link>
                          ) : t.customer ? (
                            <Link href={`/customers/${t.customer.id}`} className="hover:text-foreground hover:underline">
                              {t.customer.name}
                            </Link>
                          ) : (
                            "—"
                          )}
                        </span>
                      </TD>
                      <TD className="hidden text-[13px] text-muted-foreground xl:table-cell">{t.assignee ?? "—"}</TD>
                    </TR>
                  );
                })}
              </TBody>
            </Table>
          </TableWrap>
          <div className="border-t px-5 py-2.5 text-xs text-muted-foreground">
            {rows.length} task{rows.length === 1 ? "" : "s"}
            {rows.length >= 500 && " · showing the first 500, refine your filters to see more"}
          </div>
        </Card>
      )}

      <TaskDialog open={!!editing} onOpenChange={(o) => !o && openTask(null)} task={editing} />
    </>
  );
}

function Board({
  tasks,
  today,
  onOpen,
  onStatus,
}: {
  tasks: TaskItem[];
  today: string;
  onOpen: (t: TaskItem) => void;
  onStatus: (t: TaskItem, s: string) => void;
}) {
  const { openCreate } = useApp();
  const [dragOver, setDragOver] = React.useState<string | null>(null);
  const byId = new Map(tasks.map((t) => [t.id, t]));
  return (
    <div className="-mx-4 flex snap-x gap-3 overflow-x-auto px-4 pb-2 sm:mx-0 sm:px-0 lg:grid lg:grid-cols-4 lg:overflow-visible">
      {TASK_STATUS.list.map((col) => {
        const items = tasks.filter((t) => t.status === col.value);
        return (
          <section
            key={col.value}
            aria-label={col.label}
            className={cn(
              "flex w-[280px] shrink-0 snap-start flex-col rounded-lg border bg-surface-2/50 lg:w-auto",
              dragOver === col.value && "border-primary/50 bg-primary-soft/40",
            )}
            onDragOver={(e) => {
              e.preventDefault();
              setDragOver(col.value);
            }}
            onDragLeave={() => setDragOver(null)}
            onDrop={(e) => {
              e.preventDefault();
              setDragOver(null);
              const task = byId.get(e.dataTransfer.getData("text/task-id"));
              if (task && task.status !== col.value) onStatus(task, col.value as TaskStatus);
            }}
          >
            <header className="flex items-center justify-between px-3 py-2.5">
              <span className="flex items-center gap-2 text-[13px] font-medium">
                <Badge tone={col.tone} dot>
                  {col.label}
                </Badge>
                <span className="text-xs text-muted-foreground">{items.length}</span>
              </span>
              <Button variant="ghost" size="icon-xs" aria-label={`Add task to ${col.label}`} onClick={() => openCreate("task", { status: col.value })}>
                <Plus />
              </Button>
            </header>
            <div className="flex min-h-[120px] flex-1 flex-col gap-2 px-2 pb-2">
              {items.map((t) => (
                <article
                  key={t.id}
                  draggable
                  onDragStart={(e) => e.dataTransfer.setData("text/task-id", t.id)}
                  className="group cursor-grab rounded-md border bg-card p-3 shadow-card transition-shadow hover:shadow-md active:cursor-grabbing"
                >
                  <button onClick={() => onOpen(t)} className="block w-full text-left focus-visible:outline-none">
                    <p className={cn("text-[13px] font-medium leading-snug", t.status === "DONE" && "text-muted-foreground line-through")}>{t.title}</p>
                    {(t.project || t.customer) && <p className="mt-1 truncate text-xs text-muted-foreground">{t.project?.name ?? t.customer?.name}</p>}
                  </button>
                  <div className="mt-2.5 flex items-center justify-between gap-2">
                    <span className="flex items-center gap-2">
                      <PriorityIcon priority={t.priority} />
                      <DueLabel date={t.dueDate} today={today} done={t.status === "DONE"} />
                    </span>
                    <select
                      aria-label="Move to"
                      value={t.status}
                      onChange={(e) => onStatus(t, e.target.value)}
                      className="h-6 rounded border-0 bg-transparent text-[11px] text-muted-foreground opacity-100 focus:ring-1 focus:ring-ring lg:opacity-0 lg:group-hover:opacity-100 lg:focus:opacity-100"
                    >
                      {TASK_STATUS.list.map((s) => (
                        <option key={s.value} value={s.value}>
                          {s.label}
                        </option>
                      ))}
                    </select>
                  </div>
                  {t.dueDate && dateToKey(t.dueDate) < today && t.status !== "DONE" && <span className="sr-only">Overdue</span>}
                </article>
              ))}
              {items.length === 0 && <p className="px-2 py-6 text-center text-xs text-muted-foreground">Drop tasks here</p>}
            </div>
          </section>
        );
      })}
    </div>
  );
}
