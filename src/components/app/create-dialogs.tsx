"use client";

import { useApp } from "./app-context";
import { TaskDialog } from "@/components/forms/task-form";
import { ProjectDialog } from "@/components/forms/project-form";
import { CustomerDialog } from "@/components/forms/customer-form";
import { TransactionDialog } from "@/components/forms/transaction-form";
import { EventDialog } from "@/components/forms/event-form";
import { ContentDialog } from "@/components/forms/content-form";
import { NoteCreateDialog } from "@/components/forms/note-create";

/** Global create dialogs, opened from quick-create, the command palette and empty states. */
export function CreateDialogs() {
  const { create, closeCreate } = useApp();
  const kind = create?.kind;
  const defaults = create?.defaults;
  const onOpenChange = (open: boolean) => {
    if (!open) closeCreate();
  };
  return (
    <>
      <TaskDialog open={kind === "task"} onOpenChange={onOpenChange} defaults={defaults} />
      <ProjectDialog open={kind === "project"} onOpenChange={onOpenChange} defaults={defaults} />
      <CustomerDialog open={kind === "customer"} onOpenChange={onOpenChange} />
      <TransactionDialog open={kind === "transaction"} onOpenChange={onOpenChange} defaults={defaults} />
      <EventDialog open={kind === "event"} onOpenChange={onOpenChange} defaults={defaults} />
      <ContentDialog open={kind === "content"} onOpenChange={onOpenChange} defaults={defaults} />
      <NoteCreateDialog open={kind === "note"} onOpenChange={onOpenChange} defaults={defaults} />
    </>
  );
}
