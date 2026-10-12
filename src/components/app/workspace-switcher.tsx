"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Check, ChevronsUpDown, FlaskConical, Plus, Settings } from "lucide-react";
import { useApp } from "./app-context";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Dialog, DialogBody, DialogContent, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/input";
import { createWorkspaceAction, switchWorkspaceAction } from "@/server/actions/workspace";
import { runClientAction } from "@/lib/client/actions";
import { cn, initials } from "@/lib/utils";

export function WorkspaceSwitcher({ collapsed }: { collapsed?: boolean }) {
  const { workspace, workspaces } = useApp();
  const router = useRouter();
  const [createOpen, setCreateOpen] = React.useState(false);
  const [name, setName] = React.useState("");
  const [pending, setPending] = React.useState(false);

  async function switchTo(id: string) {
    if (id === workspace.id) return;
    const res = await runClientAction(switchWorkspaceAction(id));
    if (res) router.push("/");
  }

  async function create(e: React.FormEvent) {
    e.preventDefault();
    setPending(true);
    const res = await runClientAction(createWorkspaceAction(name));
    setPending(false);
    if (res) {
      setCreateOpen(false);
      setName("");
      router.push("/");
    }
  }

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger
          className={cn(
            "flex w-full items-center gap-2.5 rounded-md border bg-surface px-2 py-1.5 text-left shadow-card transition-colors hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
            collapsed && "justify-center px-0",
          )}
          aria-label="Switch workspace"
        >
          <span className="flex size-6 shrink-0 items-center justify-center rounded bg-foreground text-[10px] font-semibold text-background">
            {initials(workspace.name)}
          </span>
          {!collapsed && (
            <>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-[13px] font-medium">{workspace.name}</span>
                <span className="block text-[11px] text-muted-foreground">{workspace.isDemo ? "Sample data" : "Local workspace"}</span>
              </span>
              <ChevronsUpDown className="size-3.5 text-muted-foreground" />
            </>
          )}
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" className="w-64">
          <DropdownMenuLabel>Workspaces</DropdownMenuLabel>
          {workspaces.map((w) => (
            <DropdownMenuItem key={w.id} onSelect={() => switchTo(w.id)}>
              <span className="flex size-5 items-center justify-center rounded bg-muted text-[9px] font-semibold">{initials(w.name)}</span>
              <span className="flex-1 truncate">{w.name}</span>
              {w.isDemo && <FlaskConical className="size-3.5" aria-label="Demo" />}
              {w.id === workspace.id && <Check className="!text-primary" />}
            </DropdownMenuItem>
          ))}
          <DropdownMenuSeparator />
          <DropdownMenuItem onSelect={() => setCreateOpen(true)}>
            <Plus /> New workspace
          </DropdownMenuItem>
          <DropdownMenuItem asChild>
            <Link href="/settings">
              <Settings /> Workspace settings
            </Link>
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent size="sm" title="Create workspace" description="Workspaces keep data for separate businesses apart. They are stored locally on this server.">
          <form onSubmit={create}>
            <DialogBody>
              <Field label="Workspace name" htmlFor="ws-name" required>
                <Input id="ws-name" value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Acme Consulting" autoFocus maxLength={80} />
              </Field>
            </DialogBody>
            <DialogFooter>
              <Button variant="outline" onClick={() => setCreateOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" loading={pending} disabled={!name.trim()}>
                Create workspace
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}
