"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Archive, ArchiveRestore, ArrowLeft, Check, Eye, Loader2, NotebookPen, Pencil, Pin, PinOff, Plus, Trash2, TriangleAlert } from "lucide-react";
import { createNoteAction, deleteNoteAction, setNoteFlagsAction, updateNoteAction } from "@/server/actions/notes";
import { runClientAction } from "@/lib/client/actions";
import type { NoteFormValues } from "@/lib/validation";
import { formatDateTime } from "@/lib/dates";
import { useApp } from "@/components/app/app-context";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input, Select, Textarea } from "@/components/ui/input";
import { EmptyState } from "@/components/ui/misc";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { SearchFilter, SelectFilter, Segmented, useUrlParams } from "@/components/shared/url-filters";
import { Markdown } from "./markdown";
import { cn } from "@/lib/utils";

export type NoteItem = {
  id: string;
  title: string;
  content: string;
  pinned: boolean;
  archived: boolean;
  updatedAt: Date;
  taskId: string | null;
  projectId: string | null;
  customerId: string | null;
  tags: { id: string; name: string }[];
  project: { id: string; name: string } | null;
  customer: { id: string; name: string } | null;
  task: { id: string; title: string } | null;
};

type SaveState = "idle" | "dirty" | "saving" | "saved" | "error";

export function NotesView({ notes, selected, tags, view }: { notes: NoteItem[]; selected: NoteItem | null; tags: string[]; view: "active" | "pinned" | "archived" }) {
  const { set, params } = useUrlParams();
  const { workspace } = useApp();
  const router = useRouter();
  const [creating, setCreating] = React.useState(false);
  const flushRef = React.useRef<(() => Promise<boolean>) | null>(null);

  async function select(id: string | null) {
    // Persist pending edits before navigating away from the current note.
    if (flushRef.current) await flushRef.current();
    set({ note: id }, { replace: false });
  }

  async function create() {
    if (flushRef.current) await flushRef.current();
    setCreating(true);
    const res = await runClientAction(createNoteAction({ title: "Untitled", content: "", pinned: false, tags: "", projectId: null, customerId: null, taskId: null }), {
      success: false,
    });
    setCreating(false);
    if (res?.data) router.push(`/notes?note=${res.data.id}`);
  }

  return (
    <div className="grid gap-4 lg:grid-cols-[320px_1fr]">
      <div className={cn("space-y-3", selected && "hidden lg:block")}>
        <div className="flex items-center gap-2">
          <SearchFilter placeholder="Search notes…" className="sm:w-full" />
          <Button size="icon-sm" onClick={create} loading={creating} aria-label="New note">
            {!creating && <Plus />}
          </Button>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Segmented
            label="Notes view"
            value={view}
            onChange={(v) => set({ view: v === "active" ? null : v, note: null })}
            options={[
              { value: "active", label: "All" },
              { value: "pinned", label: "Pinned" },
              { value: "archived", label: "Archived" },
            ]}
          />
          {tags.length > 0 && <SelectFilter param="tag" label="Tag" allLabel="Any tag" options={tags.map((t) => ({ value: t, label: `#${t}` }))} className="min-w-[110px]" />}
        </div>
        <Card className="overflow-hidden">
          {notes.length === 0 ? (
            <EmptyState
              compact
              icon={NotebookPen}
              title={params.get("q") || params.get("tag") ? "No matching notes" : view === "archived" ? "No archived notes" : "No notes yet"}
              description={view === "active" && !params.get("q") ? "Capture meeting notes, processes and ideas." : undefined}
            />
          ) : (
            <ul className="max-h-[calc(100dvh-260px)] divide-y overflow-y-auto">
              {notes.map((n) => (
                <li key={n.id}>
                  <button
                    onClick={() => select(n.id)}
                    className={cn("block w-full px-4 py-3 text-left transition-colors hover:bg-accent/60", selected?.id === n.id && "bg-accent")}
                    aria-current={selected?.id === n.id ? "true" : undefined}
                    data-testid="note-item"
                  >
                    <span className="flex items-center gap-1.5">
                      {n.pinned && <Pin className="size-3 shrink-0 text-primary" aria-label="Pinned" />}
                      <span className="truncate text-[13px] font-medium">{n.title || "Untitled"}</span>
                    </span>
                    <span className="mt-0.5 line-clamp-2 text-xs text-muted-foreground">{n.content.replace(/[#*`>\-]/g, "").trim() || "Empty note"}</span>
                    <span className="mt-1 flex flex-wrap items-center gap-x-2 text-[11px] text-muted-foreground/80">
                      {formatDateTime(n.updatedAt, workspace.timezone, "d MMM, h:mm a")}
                      {n.tags.map((t) => (
                        <span key={t.id}>#{t.name}</span>
                      ))}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>

      <div className={cn(!selected && "hidden lg:block")}>
        {selected ? (
          <NoteEditor key={selected.id} note={selected} flushRef={flushRef} onBack={() => select(null)} />
        ) : (
          <Card className="flex h-full min-h-[420px] items-center justify-center">
            <EmptyState
              icon={NotebookPen}
              title="Select a note"
              description="Choose a note from the list, or start a new one."
              action={
                <Button onClick={create} loading={creating}>
                  <Plus /> New note
                </Button>
              }
            />
          </Card>
        )}
      </div>
    </div>
  );
}

function toValues(n: NoteItem): NoteFormValues {
  return {
    title: n.title,
    content: n.content,
    pinned: n.pinned,
    tags: n.tags.map((t) => t.name).join(", "),
    projectId: n.projectId ?? "",
    customerId: n.customerId ?? "",
    taskId: n.taskId ?? "",
  };
}

function NoteEditor({ note, flushRef, onBack }: { note: NoteItem; flushRef: React.MutableRefObject<(() => Promise<boolean>) | null>; onBack: () => void }) {
  const { options, workspace } = useApp();
  const router = useRouter();
  const [values, setValues] = React.useState<NoteFormValues>(() => toValues(note));
  const [state, setState] = React.useState<SaveState>("idle");
  const [savedAt, setSavedAt] = React.useState<Date>(note.updatedAt);
  const [mode, setMode] = React.useState<"write" | "preview">(note.content ? "preview" : "write");
  const [confirmDelete, setConfirmDelete] = React.useState(false);
  const latest = React.useRef(values);
  const dirty = React.useRef(false);
  const inflight = React.useRef<Promise<boolean> | null>(null);

  const save = React.useCallback(async (): Promise<boolean> => {
    if (inflight.current) await inflight.current;
    if (!dirty.current) return true;
    dirty.current = false;
    setState("saving");
    const snapshot = latest.current;
    const p = (async () => {
      const res = await runClientAction(updateNoteAction(note.id, snapshot), { success: false });
      if (!res) {
        dirty.current = true;
        setState("error");
        return false;
      }
      if (res.data) setSavedAt(new Date(res.data.updatedAt));
      setState(dirty.current ? "dirty" : "saved");
      return true;
    })();
    inflight.current = p;
    const ok = await p;
    inflight.current = null;
    return ok;
  }, [note.id]);

  React.useEffect(() => {
    flushRef.current = save;
    return () => {
      // Flush on unmount (e.g. navigation within the app).
      if (dirty.current) void save();
      flushRef.current = null;
    };
  }, [save, flushRef]);

  // Debounced autosave.
  React.useEffect(() => {
    if (state !== "dirty") return;
    const t = setTimeout(() => void save(), 900);
    return () => clearTimeout(t);
  }, [values, state, save]);

  // Warn before closing the tab with unsaved edits.
  React.useEffect(() => {
    const handler = (e: BeforeUnloadEvent) => {
      if (dirty.current || inflight.current) {
        e.preventDefault();
        e.returnValue = "";
      }
    };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, []);

  function update<K extends keyof NoteFormValues>(key: K, value: NoteFormValues[K]) {
    const next = { ...latest.current, [key]: value };
    latest.current = next;
    dirty.current = true;
    setValues(next);
    setState("dirty");
  }

  async function flag(flags: { pinned?: boolean; archived?: boolean }) {
    await save();
    const res = await runClientAction(setNoteFlagsAction(note.id, flags), {
      success: flags.archived === true ? "Note archived" : flags.archived === false ? "Note restored" : flags.pinned ? "Pinned" : "Unpinned",
    });
    if (res && flags.pinned !== undefined) {
      latest.current = { ...latest.current, pinned: flags.pinned };
      setValues(latest.current);
    }
    if (res && flags.archived !== undefined) router.push(flags.archived ? "/notes" : `/notes?note=${note.id}`);
  }

  const status =
    state === "saving" ? (
      <span className="flex items-center gap-1">
        <Loader2 className="size-3 animate-spin" /> Saving…
      </span>
    ) : state === "dirty" ? (
      <span>Unsaved changes</span>
    ) : state === "error" ? (
      <span className="flex items-center gap-1 text-destructive">
        <TriangleAlert className="size-3" /> Not saved —{" "}
        <button className="underline" onClick={() => void save()}>
          retry
        </button>
      </span>
    ) : (
      <span className="flex items-center gap-1">
        <Check className="size-3 text-success" /> Saved {formatDateTime(savedAt, workspace.timezone, "d MMM, h:mm a")}
      </span>
    );

  return (
    <Card className="flex min-h-[560px] flex-col">
      <div className="flex flex-wrap items-center gap-2 border-b px-4 py-2.5">
        <Button variant="ghost" size="icon-sm" className="lg:hidden" onClick={onBack} aria-label="Back to notes">
          <ArrowLeft />
        </Button>
        <span className="text-xs text-muted-foreground" aria-live="polite" data-testid="save-state">
          {status}
        </span>
        <div className="ml-auto flex items-center gap-1">
          <Segmented
            label="Editor mode"
            value={mode}
            onChange={setMode}
            options={[
              { value: "write", label: "Write", icon: Pencil },
              { value: "preview", label: "Preview", icon: Eye },
            ]}
          />
          <Button variant="ghost" size="icon-sm" onClick={() => flag({ pinned: !values.pinned })} aria-label={values.pinned ? "Unpin note" : "Pin note"}>
            {values.pinned ? <PinOff /> : <Pin />}
          </Button>
          <Button variant="ghost" size="icon-sm" onClick={() => flag({ archived: !note.archived })} aria-label={note.archived ? "Restore note" : "Archive note"}>
            {note.archived ? <ArchiveRestore /> : <Archive />}
          </Button>
          <Button variant="ghost" size="icon-sm" onClick={() => setConfirmDelete(true)} aria-label="Delete note" className="hover:text-destructive">
            <Trash2 />
          </Button>
        </div>
      </div>
      {note.archived && <p className="border-b bg-warning-soft px-4 py-2 text-xs text-warning">This note is archived. Restore it to show it in your main list.</p>}
      <div className="flex flex-1 flex-col gap-3 p-4 sm:p-6">
        <input
          value={values.title}
          onChange={(e) => update("title", e.target.value)}
          onBlur={() => void save()}
          placeholder="Untitled"
          maxLength={200}
          aria-label="Note title"
          className="w-full bg-transparent text-xl font-semibold tracking-tight outline-none placeholder:text-muted-foreground/50"
        />
        {mode === "write" ? (
          <Textarea
            value={values.content}
            onChange={(e) => update("content", e.target.value)}
            onBlur={() => void save()}
            placeholder={"Start writing… Markdown supported: # heading, - list, **bold**, *italic*, `code`, [link](https://…)"}
            className="min-h-[320px] flex-1 resize-none border-0 bg-transparent px-0 font-mono text-[13px] shadow-none focus-visible:ring-0"
            aria-label="Note content"
          />
        ) : (
          <div className="min-h-[320px] flex-1 cursor-text" onDoubleClick={() => setMode("write")}>
            {values.content.trim() ? <Markdown text={values.content} /> : <p className="text-sm text-muted-foreground">Nothing here yet — switch to Write to start.</p>}
          </div>
        )}
      </div>
      <div className="grid gap-3 border-t px-4 py-3 sm:grid-cols-2 xl:grid-cols-4">
        <label className="grid gap-1 text-xs text-muted-foreground">
          Tags
          <Input value={values.tags ?? ""} onChange={(e) => update("tags", e.target.value)} onBlur={() => void save()} placeholder="comma, separated" className="h-8 text-[13px]" />
        </label>
        <label className="grid gap-1 text-xs text-muted-foreground">
          Project
          <Select value={values.projectId ?? ""} onChange={(e) => update("projectId", e.target.value)} className="h-8 text-[13px]">
            <option value="">None</option>
            {options.projects.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </Select>
        </label>
        <label className="grid gap-1 text-xs text-muted-foreground">
          Customer
          <Select value={values.customerId ?? ""} onChange={(e) => update("customerId", e.target.value)} className="h-8 text-[13px]">
            <option value="">None</option>
            {options.customers.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </Select>
        </label>
        <label className="grid gap-1 text-xs text-muted-foreground">
          Task
          <Select value={values.taskId ?? ""} onChange={(e) => update("taskId", e.target.value)} className="h-8 text-[13px]">
            <option value="">None</option>
            {note.task && !options.tasks.some((t) => t.id === note.task!.id) && <option value={note.task.id}>{note.task.title}</option>}
            {options.tasks.map((t) => (
              <option key={t.id} value={t.id}>
                {t.title}
              </option>
            ))}
          </Select>
        </label>
        {(note.project || note.customer) && (
          <p className="text-xs text-muted-foreground sm:col-span-2 xl:col-span-4">
            Linked:{" "}
            {note.project && (
              <Link href={`/projects/${note.project.id}`} className="text-primary hover:underline">
                {note.project.name}
              </Link>
            )}
            {note.project && note.customer && " · "}
            {note.customer && (
              <Link href={`/customers/${note.customer.id}`} className="text-primary hover:underline">
                {note.customer.name}
              </Link>
            )}
          </p>
        )}
      </div>
      <ConfirmDialog
        open={confirmDelete}
        onOpenChange={setConfirmDelete}
        title="Delete this note?"
        description={`“${values.title || "Untitled"}” will be permanently deleted. Consider archiving instead.`}
        onConfirm={async () => {
          dirty.current = false;
          const res = await runClientAction(deleteNoteAction(note.id));
          if (res) router.push("/notes");
          return !!res;
        }}
      />
    </Card>
  );
}
