"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { CalendarPlus, FileText, MoreHorizontal, NotebookPen, Pencil, Receipt, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { ProjectDialog, type ProjectRecord } from "@/components/forms/project-form";
import { deleteProjectAction } from "@/server/actions/projects";
import { runClientAction } from "@/lib/client/actions";
import { useApp } from "@/components/app/app-context";

export function ProjectActions({ project, taskCount }: { project: ProjectRecord; taskCount: number }) {
  const router = useRouter();
  const { openCreate } = useApp();
  const [editOpen, setEditOpen] = React.useState(false);
  const [confirm, setConfirm] = React.useState(false);
  const defaults = { projectId: project.id, customerId: project.customerId };
  return (
    <>
      <Button variant="outline" size="sm" onClick={() => setEditOpen(true)}>
        <Pencil /> Edit
      </Button>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="outline" size="icon-sm" aria-label="More project actions">
            <MoreHorizontal />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent className="w-52">
          <DropdownMenuItem asChild>
            <Link href={`/finance/invoices/new?projectId=${project.id}${project.customerId ? `&customerId=${project.customerId}` : ""}`}>
              <FileText /> Create invoice
            </Link>
          </DropdownMenuItem>
          <DropdownMenuItem onSelect={() => openCreate("transaction", defaults)}>
            <Receipt /> Record transaction
          </DropdownMenuItem>
          <DropdownMenuItem onSelect={() => openCreate("event", defaults)}>
            <CalendarPlus /> Schedule event
          </DropdownMenuItem>
          <DropdownMenuItem onSelect={() => openCreate("note", defaults)}>
            <NotebookPen /> Add note
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem destructive onSelect={() => setConfirm(true)}>
            <Trash2 /> Delete project
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
      <ProjectDialog open={editOpen} onOpenChange={setEditOpen} project={project} />
      <ConfirmDialog
        open={confirm}
        onOpenChange={setConfirm}
        title="Delete this project?"
        description={`“${project.name}” will be deleted. Its ${taskCount} task(s), invoices, transactions, events and notes are kept but no longer linked to a project.`}
        onConfirm={async () => {
          const res = await runClientAction(deleteProjectAction(project.id));
          if (res) router.push("/projects");
          return !!res;
        }}
      />
    </>
  );
}
