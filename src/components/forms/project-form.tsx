"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { projectSchema, type ProjectFormValues, type ProjectInput } from "@/lib/validation";
import { PRIORITY, PROJECT_STATUS } from "@/lib/constants";
import { dateToKey } from "@/lib/dates";
import { minorToInput, currencySymbol } from "@/lib/money";
import { createProjectAction, updateProjectAction } from "@/server/actions/projects";
import { runClientAction } from "@/lib/client/actions";
import { Dialog, DialogBody, DialogContent, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Field, Input, Select, Textarea } from "@/components/ui/input";
import { useApp, type CreateDefaults } from "@/components/app/app-context";

export type ProjectRecord = {
  id: string;
  name: string;
  description: string | null;
  status: string;
  priority: string;
  startDate: Date | null;
  dueDate: Date | null;
  progressMode: string;
  manualProgress: number;
  budget: number;
  customerId: string | null;
  notes: string | null;
};

function toValues(p?: ProjectRecord | null, defaults?: CreateDefaults): ProjectFormValues {
  return {
    name: p?.name ?? "",
    description: p?.description ?? "",
    status: (p?.status ?? "ACTIVE") as ProjectFormValues["status"],
    priority: (p?.priority ?? "MEDIUM") as ProjectFormValues["priority"],
    startDate: p?.startDate ? dateToKey(p.startDate) : "",
    dueDate: p?.dueDate ? dateToKey(p.dueDate) : "",
    progressMode: (p?.progressMode ?? "AUTO") as "AUTO" | "MANUAL",
    manualProgress: p?.manualProgress ?? 0,
    budget: p ? minorToInput(p.budget) : "",
    customerId: p?.customerId ?? (defaults?.customerId as string) ?? "",
    notes: p?.notes ?? "",
  };
}

export function ProjectDialog({
  open,
  onOpenChange,
  project,
  defaults,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  project?: ProjectRecord | null;
  defaults?: CreateDefaults;
}) {
  const { options, workspace } = useApp();
  const router = useRouter();
  const [initialTasks, setInitialTasks] = React.useState("");
  const form = useForm<ProjectFormValues, unknown, ProjectInput>({ resolver: zodResolver(projectSchema), defaultValues: toValues(project, defaults) });
  const { register, handleSubmit, formState, reset, setError, getValues, watch } = form;
  const errors = formState.errors;
  const mode = watch("progressMode");

  React.useEffect(() => {
    if (open) {
      reset(toValues(project, defaults));
      setInitialTasks("");
    }
    // Reset when the dialog opens or switches record, not when a refresh hands over a new object for the same one.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, project?.id, defaults, reset]);

  const onSubmit = handleSubmit(async () => {
    const values = getValues();
    if (project) {
      const res = await runClientAction(updateProjectAction(project.id, values), { setError });
      if (res) onOpenChange(false);
    } else {
      const tasks = initialTasks.split("\n").map((t) => t.trim()).filter(Boolean);
      const res = await runClientAction(createProjectAction(values, tasks), {
        setError,
        success: tasks.length ? `Project created with ${tasks.length} task${tasks.length === 1 ? "" : "s"}` : "Project created",
      });
      if (res?.data) {
        onOpenChange(false);
        router.push(`/projects/${res.data.id}`);
      }
    }
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent size="lg" title={project ? "Edit project" : "New project"} description={project ? undefined : "Set the scope, timeline and budget. You can add tasks right away."}>
        <form onSubmit={onSubmit} noValidate>
          <DialogBody>
            <Field label="Project name" htmlFor="p-name" error={errors.name?.message} required>
              <Input id="p-name" {...register("name")} aria-invalid={!!errors.name} placeholder="e.g. Website relaunch" autoFocus={!project} />
            </Field>
            <Field label="Description" htmlFor="p-desc">
              <Textarea id="p-desc" rows={3} {...register("description")} placeholder="Goals and scope" />
            </Field>
            <div className="grid gap-4 sm:grid-cols-3">
              <Field label="Status" htmlFor="p-status">
                <Select id="p-status" {...register("status")}>
                  {PROJECT_STATUS.list.map((s) => (
                    <option key={s.value} value={s.value}>
                      {s.label}
                    </option>
                  ))}
                </Select>
              </Field>
              <Field label="Priority" htmlFor="p-priority">
                <Select id="p-priority" {...register("priority")}>
                  {PRIORITY.list.map((s) => (
                    <option key={s.value} value={s.value}>
                      {s.label}
                    </option>
                  ))}
                </Select>
              </Field>
              <Field label="Customer" htmlFor="p-customer">
                <Select id="p-customer" {...register("customerId")}>
                  <option value="">Internal / none</option>
                  {options.customers.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </Select>
              </Field>
            </div>
            <div className="grid gap-4 sm:grid-cols-3">
              <Field label="Start date" htmlFor="p-start" error={errors.startDate?.message}>
                <Input id="p-start" type="date" {...register("startDate")} />
              </Field>
              <Field label="Target deadline" htmlFor="p-due" error={errors.dueDate?.message}>
                <Input id="p-due" type="date" {...register("dueDate")} aria-invalid={!!errors.dueDate} />
              </Field>
              <Field label={`Budget (${currencySymbol(workspace.currency)})`} htmlFor="p-budget" error={errors.budget?.message}>
                <Input id="p-budget" inputMode="decimal" {...register("budget")} aria-invalid={!!errors.budget} placeholder="0.00" />
              </Field>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field
                label="Progress tracking"
                htmlFor="p-mode"
                hint={mode === "AUTO" ? "Calculated from completed tasks." : "You set the percentage manually."}
              >
                <Select id="p-mode" {...register("progressMode")}>
                  <option value="AUTO">Automatic — from tasks</option>
                  <option value="MANUAL">Manual</option>
                </Select>
              </Field>
              {mode === "MANUAL" && (
                <Field label="Manual progress (%)" htmlFor="p-progress" error={errors.manualProgress?.message}>
                  <Input id="p-progress" type="number" min={0} max={100} step={1} {...register("manualProgress")} />
                </Field>
              )}
            </div>
            <Field label="Notes" htmlFor="p-notes">
              <Textarea id="p-notes" rows={3} {...register("notes")} placeholder="Decisions, links, access details…" />
            </Field>
            {!project && (
              <Field label="Initial tasks" htmlFor="p-tasks" hint="Optional — one task per line. They are created in the same step.">
                <Textarea
                  id="p-tasks"
                  rows={4}
                  value={initialTasks}
                  onChange={(e) => setInitialTasks(e.target.value)}
                  placeholder={"Kick-off call\nCollect requirements\nFirst draft"}
                />
              </Field>
            )}
          </DialogBody>
          <DialogFooter>
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" loading={formState.isSubmitting}>
              {project ? "Save changes" : "Create project"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
