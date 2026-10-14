"use client";

import * as React from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Trash2 } from "lucide-react";
import { eventSchema, type EventFormValues, type EventInput } from "@/lib/validation";
import { addDaysToKey, dateToZonedInput, plusOneHour, todayKey } from "@/lib/dates";
import { createEventAction, deleteEventAction, updateEventAction } from "@/server/actions/calendar";
import { runClientAction } from "@/lib/client/actions";
import { Dialog, DialogBody, DialogContent, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Checkbox, Field, Input, Select, Textarea } from "@/components/ui/input";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { useApp, type CreateDefaults } from "@/components/app/app-context";

export type EventRecord = {
  id: string;
  title: string;
  description: string | null;
  location: string | null;
  startAt: Date;
  endAt: Date;
  allDay: boolean;
  taskId: string | null;
  projectId: string | null;
  customerId: string | null;
  task?: { id: string; title: string } | null;
};

function toValues(e: EventRecord | null | undefined, tz: string, today: string, defaults?: CreateDefaults): EventFormValues {
  if (e) {
    const start = dateToZonedInput(e.startAt, tz);
    // All-day end is stored exclusive; show the last included day.
    const end = e.allDay ? `${addDaysToKey(dateToZonedInput(e.endAt, tz).slice(0, 10), -1)}T00:00` : dateToZonedInput(e.endAt, tz);
    return {
      title: e.title,
      description: e.description ?? "",
      location: e.location ?? "",
      allDay: e.allDay,
      start,
      end,
      taskId: e.taskId ?? "",
      projectId: e.projectId ?? "",
      customerId: e.customerId ?? "",
    };
  }
  const day = (defaults?.date as string) || today;
  return {
    title: "",
    description: "",
    location: "",
    allDay: false,
    start: `${day}T10:00`,
    end: `${day}T11:00`,
    taskId: (defaults?.taskId as string) ?? "",
    projectId: (defaults?.projectId as string) ?? "",
    customerId: (defaults?.customerId as string) ?? "",
  };
}

export function EventDialog({
  open,
  onOpenChange,
  event,
  defaults,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  event?: EventRecord | null;
  defaults?: CreateDefaults;
}) {
  const { options, workspace } = useApp();
  const tz = workspace.timezone;
  // Computed now, not taken from the layout, so a tab left open overnight still defaults to the real today.
  const today = React.useMemo(() => (open ? todayKey(tz) : ""), [open, tz]);
  const [confirmDelete, setConfirmDelete] = React.useState(false);
  const form = useForm<EventFormValues, unknown, EventInput>({ resolver: zodResolver(eventSchema), defaultValues: toValues(event, tz, today, defaults) });
  const { register, handleSubmit, formState, reset, setError, getValues, watch, setValue } = form;
  const errors = formState.errors;
  const allDay = watch("allDay");
  const start = watch("start");

  React.useEffect(() => {
    if (open) reset(toValues(event, tz, today, defaults));
    // Reset when the dialog opens or switches record, not when a refresh hands over a new object for the same one.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, event?.id, tz, today, defaults, reset]);

  const onSubmit = handleSubmit(async () => {
    const values = getValues();
    const res = event
      ? await runClientAction(updateEventAction(event.id, values), { setError })
      : await runClientAction(createEventAction(values), { setError });
    if (res) onOpenChange(false);
  });

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent size="lg" title={event ? "Edit event" : "New event"} description={`Times are in ${tz}. Events are stored in NEXUS only — no external calendar sync.`}>
          <form onSubmit={onSubmit} noValidate>
            <DialogBody>
              <Field label="Title" htmlFor="e-title" error={errors.title?.message} required>
                <Input id="e-title" {...register("title")} aria-invalid={!!errors.title} autoFocus={!event} placeholder="e.g. Client review call" />
              </Field>
              <label className="flex items-center gap-2 text-[13px]">
                <Checkbox
                  checked={allDay}
                  onChange={(e) => {
                    setValue("allDay", e.target.checked);
                    if (e.target.checked) {
                      setValue("start", `${getValues("start").slice(0, 10)}T00:00`);
                      setValue("end", `${getValues("end").slice(0, 10)}T00:00`);
                    }
                  }}
                />
                All-day event
              </label>
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="Starts" htmlFor="e-start" error={errors.start?.message} required>
                  {allDay ? (
                    <Input
                      id="e-start"
                      type="date"
                      value={start.slice(0, 10)}
                      onChange={(e) => setValue("start", `${e.target.value}T00:00`, { shouldValidate: formState.isSubmitted })}
                    />
                  ) : (
                    <Input
                      id="e-start"
                      type="datetime-local"
                      {...register("start", {
                        onChange: (e) => {
                          // Keep the end after the start when the start moves past it.
                          const s = e.target.value as string;
                          if (s && getValues("end") <= s) setValue("end", plusOneHour(s));
                        },
                      })}
                    />
                  )}
                </Field>
                <Field label="Ends" htmlFor="e-end" error={errors.end?.message} required>
                  {allDay ? (
                    <Input
                      id="e-end"
                      type="date"
                      value={watch("end").slice(0, 10)}
                      onChange={(e) => setValue("end", `${e.target.value}T00:00`, { shouldValidate: formState.isSubmitted })}
                      aria-invalid={!!errors.end}
                    />
                  ) : (
                    <Input id="e-end" type="datetime-local" {...register("end")} aria-invalid={!!errors.end} />
                  )}
                </Field>
              </div>
              <Field label="Location or meeting link" htmlFor="e-loc">
                <Input id="e-loc" {...register("location")} placeholder="Office, address or video link" />
              </Field>
              <Field label="Description" htmlFor="e-desc">
                <Textarea id="e-desc" rows={3} {...register("description")} />
              </Field>
              <div className="grid gap-4 sm:grid-cols-3">
                <Field label="Customer" htmlFor="e-customer">
                  <Select id="e-customer" {...register("customerId")}>
                    <option value="">None</option>
                    {options.customers.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                      </option>
                    ))}
                  </Select>
                </Field>
                <Field label="Project" htmlFor="e-project">
                  <Select id="e-project" {...register("projectId")}>
                    <option value="">None</option>
                    {options.projects.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.name}
                      </option>
                    ))}
                  </Select>
                </Field>
                <Field label="Task" htmlFor="e-task">
                  <Select id="e-task" {...register("taskId")}>
                    <option value="">None</option>
                    {/* Completed tasks aren't in the open-task list; keep an existing link visible and selectable. */}
                    {event?.taskId && !options.tasks.some((t) => t.id === event.taskId) && <option value={event.taskId}>{event.task?.title ?? "Completed task"}</option>}
                    {options.tasks.map((t) => (
                      <option key={t.id} value={t.id}>
                        {t.title}
                      </option>
                    ))}
                  </Select>
                </Field>
              </div>
            </DialogBody>
            <DialogFooter>
              {event && (
                <Button variant="destructive-ghost" className="sm:mr-auto" onClick={() => setConfirmDelete(true)}>
                  <Trash2 /> Delete
                </Button>
              )}
              <Button variant="outline" onClick={() => onOpenChange(false)}>
                Cancel
              </Button>
              <Button type="submit" loading={formState.isSubmitting}>
                {event ? "Save changes" : "Create event"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
      {event && (
        <ConfirmDialog
          open={confirmDelete}
          onOpenChange={setConfirmDelete}
          title="Delete this event?"
          description={`“${event.title}” will be removed from your calendar.`}
          onConfirm={async () => {
            const res = await runClientAction(deleteEventAction(event.id));
            if (res) onOpenChange(false);
            return !!res;
          }}
        />
      )}
    </>
  );
}
