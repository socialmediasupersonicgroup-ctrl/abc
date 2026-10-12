"use client";

import * as React from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Trash2 } from "lucide-react";
import { taskSchema, type TaskFormValues, type TaskInput } from "@/lib/validation";
import { PRIORITY, TASK_STATUS } from "@/lib/constants";
import { dateToKey, formatDateTime } from "@/lib/dates";
import { createTaskAction, deleteTaskAction, updateTaskAction } from "@/server/actions/tasks";
import { runClientAction } from "@/lib/client/actions";
import { Dialog, DialogBody, DialogContent, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Field, Input, Select, Textarea } from "@/components/ui/input";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { useApp, type CreateDefaults } from "@/components/app/app-context";

export type TaskRecord = {
  id: string;
  title: string;
  description: string | null;
  status: string;
  priority: string;
  dueDate: Date | null;
  assignee: string | null;
  projectId: string | null;
  customerId: string | null;
  tags: { name: string }[];
  createdAt: Date;
  updatedAt: Date;
};

function toValues(task?: TaskRecord | null, defaults?: CreateDefaults): TaskFormValues {
  return {
    title: task?.title ?? "",
    description: task?.description ?? "",
    status: (task?.status ?? (defaults?.status as string) ?? "TODO") as TaskFormValues["status"],
    priority: (task?.priority ?? "MEDIUM") as TaskFormValues["priority"],
    dueDate: task?.dueDate ? dateToKey(task.dueDate) : ((defaults?.dueDate as string) ?? ""),
    assignee: task?.assignee ?? "",
    projectId: task?.projectId ?? (defaults?.projectId as string) ?? "",
    customerId: task?.customerId ?? (defaults?.customerId as string) ?? "",
    tags: task?.tags.map((t) => t.name).join(", ") ?? "",
  };
}

export function TaskDialog({
  open,
  onOpenChange,
  task,
  defaults,
  onSaved,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  task?: TaskRecord | null;
  defaults?: CreateDefaults;
  onSaved?: (id: string) => void;
}) {
  const { options, workspace } = useApp();
  const [confirmDelete, setConfirmDelete] = React.useState(false);
  const form = useForm<TaskFormValues, unknown, TaskInput>({ resolver: zodResolver(taskSchema), defaultValues: toValues(task, defaults) });
  const { register, handleSubmit, formState, reset, setError, getValues, watch, setValue } = form;
  const errors = formState.errors;

  React.useEffect(() => {
    if (open) reset(toValues(task, defaults));
  }, [open, task, defaults, reset]);

  const projectId = watch("projectId");
  // Selecting a project pre-fills its customer when none is chosen.
  React.useEffect(() => {
    if (!projectId || getValues("customerId")) return;
    const p = options.projects.find((x) => x.id === projectId);
    if (p?.customerId) setValue("customerId", p.customerId);
  }, [projectId, options.projects, getValues, setValue]);

  const onSubmit = handleSubmit(async () => {
    const values = getValues();
    const res = task
      ? await runClientAction(updateTaskAction(task.id, values), { setError })
      : await runClientAction(createTaskAction(values), { setError });
    if (res) {
      onSaved?.(res.data?.id ?? task?.id ?? "");
      onOpenChange(false);
    }
  });

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent size="lg" title={task ? "Task details" : "New task"} description={task ? undefined : "Capture the work, when it's due and who it's for."}>
          <form onSubmit={onSubmit} noValidate>
            <DialogBody>
              <Field label="Title" htmlFor="task-title" error={errors.title?.message} required>
                <Input id="task-title" {...register("title")} aria-invalid={!!errors.title} placeholder="e.g. Send revised proposal" autoFocus={!task} />
              </Field>
              <Field label="Description" htmlFor="task-desc" error={errors.description?.message}>
                <Textarea id="task-desc" rows={4} {...register("description")} placeholder="Context, acceptance criteria, links…" />
              </Field>
              <div className="grid gap-4 sm:grid-cols-3">
                <Field label="Status" htmlFor="task-status">
                  <Select id="task-status" {...register("status")}>
                    {TASK_STATUS.list.map((s) => (
                      <option key={s.value} value={s.value}>
                        {s.label}
                      </option>
                    ))}
                  </Select>
                </Field>
                <Field label="Priority" htmlFor="task-priority">
                  <Select id="task-priority" {...register("priority")}>
                    {PRIORITY.list.map((s) => (
                      <option key={s.value} value={s.value}>
                        {s.label}
                      </option>
                    ))}
                  </Select>
                </Field>
                <Field label="Due date" htmlFor="task-due" error={errors.dueDate?.message}>
                  <Input id="task-due" type="date" {...register("dueDate")} aria-invalid={!!errors.dueDate} />
                </Field>
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="Project" htmlFor="task-project">
                  <Select id="task-project" {...register("projectId")}>
                    <option value="">No project</option>
                    {options.projects.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.name}
                      </option>
                    ))}
                  </Select>
                </Field>
                <Field label="Customer" htmlFor="task-customer">
                  <Select id="task-customer" {...register("customerId")}>
                    <option value="">No customer</option>
                    {options.customers.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                        {c.company ? ` — ${c.company}` : ""}
                      </option>
                    ))}
                  </Select>
                </Field>
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="Assignee" htmlFor="task-assignee" hint="Free text — NEXUS runs in single-user mode.">
                  <Input id="task-assignee" {...register("assignee")} placeholder="e.g. Priya" />
                </Field>
                <Field label="Tags" htmlFor="task-tags" hint="Separate with commas" error={errors.tags?.message}>
                  <Input id="task-tags" {...register("tags")} placeholder="design, client" />
                </Field>
              </div>
              {task && (
                <p className="text-xs text-muted-foreground">
                  Created {formatDateTime(task.createdAt, workspace.timezone)} · Updated {formatDateTime(task.updatedAt, workspace.timezone)}
                </p>
              )}
            </DialogBody>
            <DialogFooter>
              {task && (
                <Button variant="destructive-ghost" className="sm:mr-auto" onClick={() => setConfirmDelete(true)}>
                  <Trash2 /> Delete
                </Button>
              )}
              <Button variant="outline" onClick={() => onOpenChange(false)}>
                Cancel
              </Button>
              <Button type="submit" loading={formState.isSubmitting}>
                {task ? "Save changes" : "Create task"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
      {task && (
        <ConfirmDialog
          open={confirmDelete}
          onOpenChange={setConfirmDelete}
          title="Delete this task?"
          description={`“${task.title}” will be permanently deleted. Linked events and notes are kept.`}
          onConfirm={async () => {
            const res = await runClientAction(deleteTaskAction(task.id));
            if (res) onOpenChange(false);
            return !!res;
          }}
        />
      )}
    </>
  );
}
