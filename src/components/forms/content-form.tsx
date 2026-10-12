"use client";

import * as React from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Copy, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { contentSchema, type ContentFormValues, type ContentInput } from "@/lib/validation";
import { CONTENT_FORMATS, CONTENT_PLATFORMS, CONTENT_STATUS } from "@/lib/constants";
import { dateToZonedInput } from "@/lib/dates";
import { createContentAction, deleteContentAction, updateContentAction } from "@/server/actions/content";
import { runClientAction } from "@/lib/client/actions";
import { Dialog, DialogBody, DialogContent, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Field, Input, Select, Textarea } from "@/components/ui/input";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { useApp, type CreateDefaults } from "@/components/app/app-context";

export type ContentRecord = {
  id: string;
  title: string;
  platform: string;
  format: string;
  campaign: string | null;
  scheduledAt: Date | null;
  status: string;
  caption: string | null;
  hashtags: string | null;
  notes: string | null;
};

function toValues(c: ContentRecord | null | undefined, tz: string, defaults?: CreateDefaults): ContentFormValues {
  return {
    title: c?.title ?? "",
    platform: c?.platform ?? "Instagram",
    format: c?.format ?? "Post",
    campaign: c?.campaign ?? "",
    scheduledAt: c?.scheduledAt ? dateToZonedInput(c.scheduledAt, tz) : defaults?.date ? `${defaults.date}T11:00` : "",
    status: (c?.status ?? "IDEA") as ContentFormValues["status"],
    caption: c?.caption ?? "",
    hashtags: c?.hashtags ?? "",
    notes: c?.notes ?? "",
  };
}

export async function copyText(text: string, label = "Copied to clipboard") {
  try {
    await navigator.clipboard.writeText(text);
    toast.success(label);
  } catch {
    toast.error("Your browser blocked clipboard access. Select the text and copy it manually.");
  }
}

export function ContentDialog({
  open,
  onOpenChange,
  item,
  defaults,
  campaigns = [],
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  item?: ContentRecord | null;
  defaults?: CreateDefaults;
  campaigns?: string[];
}) {
  const { workspace } = useApp();
  const tz = workspace.timezone;
  const [confirmDelete, setConfirmDelete] = React.useState(false);
  const form = useForm<ContentFormValues, unknown, ContentInput>({ resolver: zodResolver(contentSchema), defaultValues: toValues(item, tz, defaults) });
  const { register, handleSubmit, formState, reset, setError, getValues, watch } = form;
  const errors = formState.errors;
  const caption = watch("caption") ?? "";
  const hashtags = watch("hashtags") ?? "";

  React.useEffect(() => {
    if (open) reset(toValues(item, tz, defaults));
  }, [open, item, tz, defaults, reset]);

  const onSubmit = handleSubmit(async () => {
    const values = getValues();
    const res = item
      ? await runClientAction(updateContentAction(item.id, values), { setError })
      : await runClientAction(createContentAction(values), { setError });
    if (res) onOpenChange(false);
  });

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent
          size="lg"
          title={item ? "Edit content" : "New content"}
          description="Plan and draft here. NEXUS does not post to social platforms — mark items Published after you post them."
        >
          <form onSubmit={onSubmit} noValidate>
            <DialogBody>
              <Field label="Title" htmlFor="ct-title" error={errors.title?.message} required>
                <Input id="ct-title" {...register("title")} aria-invalid={!!errors.title} autoFocus={!item} placeholder="e.g. 3 lessons from our latest launch" />
              </Field>
              <div className="grid gap-4 sm:grid-cols-3">
                <Field label="Platform" htmlFor="ct-platform">
                  <Select id="ct-platform" {...register("platform")}>
                    {CONTENT_PLATFORMS.map((p) => (
                      <option key={p}>{p}</option>
                    ))}
                  </Select>
                </Field>
                <Field label="Format" htmlFor="ct-format">
                  <Select id="ct-format" {...register("format")}>
                    {CONTENT_FORMATS.map((p) => (
                      <option key={p}>{p}</option>
                    ))}
                  </Select>
                </Field>
                <Field label="Status" htmlFor="ct-status">
                  <Select id="ct-status" {...register("status")}>
                    {CONTENT_STATUS.list.map((s) => (
                      <option key={s.value} value={s.value}>
                        {s.label}
                      </option>
                    ))}
                  </Select>
                </Field>
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="Campaign" htmlFor="ct-campaign">
                  <Input id="ct-campaign" list="campaign-list" {...register("campaign")} placeholder="e.g. Festive launch" />
                  <datalist id="campaign-list">
                    {campaigns.map((c) => (
                      <option key={c} value={c} />
                    ))}
                  </datalist>
                </Field>
                <Field label={`Scheduled for (${tz})`} htmlFor="ct-date" error={errors.scheduledAt?.message}>
                  <Input id="ct-date" type="datetime-local" {...register("scheduledAt")} />
                </Field>
              </div>
              <Field
                label="Caption / draft"
                htmlFor="ct-caption"
                error={errors.caption?.message}
                hint={
                  <span className="flex items-center justify-between">
                    <span>{caption.length.toLocaleString()} characters</span>
                    {caption && (
                      <button
                        type="button"
                        className="inline-flex items-center gap-1 font-medium text-primary hover:underline"
                        onClick={() => copyText(hashtags ? `${caption}\n\n${hashtags}` : caption, "Caption copied")}
                      >
                        <Copy className="size-3" /> Copy caption
                      </button>
                    )}
                  </span>
                }
              >
                <Textarea id="ct-caption" rows={6} {...register("caption")} placeholder="Write the post…" />
              </Field>
              <Field label="Hashtags" htmlFor="ct-tags">
                <Input id="ct-tags" {...register("hashtags")} placeholder="#smallbusiness #launch" />
              </Field>
              <Field label="Campaign notes" htmlFor="ct-notes">
                <Textarea id="ct-notes" rows={2} {...register("notes")} placeholder="Assets, references, call to action…" />
              </Field>
            </DialogBody>
            <DialogFooter>
              {item && (
                <Button variant="destructive-ghost" className="sm:mr-auto" onClick={() => setConfirmDelete(true)}>
                  <Trash2 /> Delete
                </Button>
              )}
              <Button variant="outline" onClick={() => onOpenChange(false)}>
                Cancel
              </Button>
              <Button type="submit" loading={formState.isSubmitting}>
                {item ? "Save changes" : "Create content"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
      {item && (
        <ConfirmDialog
          open={confirmDelete}
          onOpenChange={setConfirmDelete}
          title="Delete this content item?"
          description={`“${item.title}” and its draft will be permanently deleted.`}
          onConfirm={async () => {
            const res = await runClientAction(deleteContentAction(item.id));
            if (res) onOpenChange(false);
            return !!res;
          }}
        />
      )}
    </>
  );
}
