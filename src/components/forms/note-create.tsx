"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { createNoteAction } from "@/server/actions/notes";
import { runClientAction } from "@/lib/client/actions";
import { Dialog, DialogBody, DialogContent, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/input";
import type { CreateDefaults } from "@/components/app/app-context";

export function NoteCreateDialog({ open, onOpenChange, defaults }: { open: boolean; onOpenChange: (o: boolean) => void; defaults?: CreateDefaults }) {
  const router = useRouter();
  const [title, setTitle] = React.useState("");
  const [pending, setPending] = React.useState(false);
  React.useEffect(() => {
    if (open) setTitle("");
  }, [open]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setPending(true);
    const res = await runClientAction(
      createNoteAction({
        title: title || "Untitled",
        content: "",
        pinned: false,
        tags: "",
        projectId: (defaults?.projectId as string) ?? null,
        customerId: (defaults?.customerId as string) ?? null,
        taskId: null,
      }),
      { success: "Note created" },
    );
    setPending(false);
    if (res?.data) {
      onOpenChange(false);
      router.push(`/notes?note=${res.data.id}`);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent size="sm" title="New note" description="Give it a title — you'll write the content in the editor.">
        <form onSubmit={submit}>
          <DialogBody>
            <Field label="Title" htmlFor="n-title">
              <Input id="n-title" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Untitled" autoFocus maxLength={200} />
            </Field>
          </DialogBody>
          <DialogFooter>
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" loading={pending}>
              Create &amp; open
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
