"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { useTheme } from "next-themes";
import { Command } from "cmdk";
import * as D from "@radix-ui/react-dialog";
import {
  CalendarDays,
  CalendarPlus,
  CheckSquare,
  FileText,
  FolderKanban,
  FolderPlus,
  Loader2,
  Megaphone,
  Moon,
  NotebookPen,
  Receipt,
  Search,
  Sun,
  UserPlus,
  Users,
  Wallet,
} from "lucide-react";
import { searchAction } from "@/server/actions/search";
import type { SearchHit, SearchType } from "@/lib/services/search";
import { NAV } from "./nav";
import { useApp } from "./app-context";
import { Kbd } from "@/components/ui/misc";

const TYPE_META: Record<SearchType, { label: string; icon: React.ComponentType<{ className?: string }> }> = {
  task: { label: "Tasks", icon: CheckSquare },
  project: { label: "Projects", icon: FolderKanban },
  customer: { label: "Customers", icon: Users },
  invoice: { label: "Invoices", icon: FileText },
  transaction: { label: "Transactions", icon: Wallet },
  event: { label: "Events", icon: CalendarDays },
  note: { label: "Notes", icon: NotebookPen },
  content: { label: "Content", icon: Megaphone },
};

const itemClass =
  "flex cursor-default select-none items-center gap-2.5 rounded-md px-2.5 py-2 text-[13px] outline-none aria-selected:bg-accent data-[disabled=true]:opacity-50 [&_svg]:size-4 [&_svg]:shrink-0 [&_svg]:text-muted-foreground";
const groupClass =
  "px-1.5 py-1 [&_[cmdk-group-heading]]:px-2 [&_[cmdk-group-heading]]:pb-1 [&_[cmdk-group-heading]]:pt-2 [&_[cmdk-group-heading]]:text-[11px] [&_[cmdk-group-heading]]:font-medium [&_[cmdk-group-heading]]:uppercase [&_[cmdk-group-heading]]:tracking-wider [&_[cmdk-group-heading]]:text-muted-foreground";

export function CommandPalette() {
  const { paletteOpen: open, setPaletteOpen: setOpen, openCreate } = useApp();
  const router = useRouter();
  const { resolvedTheme, setTheme } = useTheme();
  const [query, setQuery] = React.useState("");
  const [hits, setHits] = React.useState<SearchHit[]>([]);
  const [loading, setLoading] = React.useState(false);

  React.useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setOpen(!open);
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, setOpen]);

  React.useEffect(() => {
    if (!open) {
      setQuery("");
      setHits([]);
    }
  }, [open]);

  React.useEffect(() => {
    const q = query.trim();
    if (!q) {
      setHits([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    let cancelled = false;
    const t = setTimeout(async () => {
      const res = await searchAction(q);
      if (!cancelled) {
        setHits(res);
        setLoading(false);
      }
    }, 180);
    return () => {
      cancelled = true;
      clearTimeout(t);
    };
  }, [query]);

  function go(href: string) {
    setOpen(false);
    router.push(href);
  }
  function create(kind: Parameters<typeof openCreate>[0]) {
    setOpen(false);
    openCreate(kind);
  }

  const grouped = React.useMemo(() => {
    const map = new Map<SearchType, SearchHit[]>();
    for (const h of hits) map.set(h.type, [...(map.get(h.type) ?? []), h]);
    return [...map.entries()];
  }, [hits]);

  return (
    <D.Root open={open} onOpenChange={setOpen}>
      <D.Portal>
        <D.Overlay className="fixed inset-0 z-50 bg-black/40 backdrop-blur-[2px] data-[state=open]:animate-fade-in" />
        <D.Content className="fixed left-1/2 top-[12vh] z-50 w-[calc(100vw-1.5rem)] max-w-xl -translate-x-1/2 overflow-hidden rounded-xl border bg-popover shadow-pop focus:outline-none data-[state=open]:animate-fade-in">
          <D.Title className="sr-only">Command palette</D.Title>
          <D.Description className="sr-only">Search records, navigate and run quick actions</D.Description>
          <Command shouldFilter={false} label="Command palette" loop>
            <div className="flex items-center gap-2 border-b px-3.5">
              {loading ? <Loader2 className="size-4 animate-spin text-muted-foreground" /> : <Search className="size-4 text-muted-foreground" />}
              <Command.Input
                value={query}
                onValueChange={setQuery}
                placeholder="Search tasks, customers, invoices, notes…"
                className="h-12 flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground"
              />
              <Kbd>Esc</Kbd>
            </div>
            <Command.List className="max-h-[min(420px,60vh)] overflow-y-auto py-1">
              {query.trim() && !loading && hits.length === 0 && (
                <Command.Empty className="px-4 py-8 text-center text-sm text-muted-foreground">No records match “{query.trim()}”.</Command.Empty>
              )}
              {grouped.map(([type, items]) => {
                const meta = TYPE_META[type];
                return (
                  <Command.Group key={type} heading={meta.label} className={groupClass}>
                    {items.map((h) => (
                      <Command.Item key={`${h.type}-${h.id}`} value={`${h.type}-${h.id}`} onSelect={() => go(h.href)} className={itemClass}>
                        <meta.icon />
                        <span className="min-w-0 flex-1 truncate">{h.title}</span>
                        <span className="shrink-0 truncate text-xs text-muted-foreground">{h.subtitle}</span>
                      </Command.Item>
                    ))}
                  </Command.Group>
                );
              })}
              {!query.trim() && (
                <>
                  <Command.Group heading="Create" className={groupClass}>
                    <Command.Item value="create-task" onSelect={() => create("task")} className={itemClass}>
                      <CheckSquare /> New task
                    </Command.Item>
                    <Command.Item value="create-project" onSelect={() => create("project")} className={itemClass}>
                      <FolderPlus /> New project
                    </Command.Item>
                    <Command.Item value="create-customer" onSelect={() => create("customer")} className={itemClass}>
                      <UserPlus /> New customer
                    </Command.Item>
                    <Command.Item value="create-invoice" onSelect={() => go("/finance/invoices/new")} className={itemClass}>
                      <FileText /> New invoice
                    </Command.Item>
                    <Command.Item value="create-transaction" onSelect={() => create("transaction")} className={itemClass}>
                      <Receipt /> Record transaction
                    </Command.Item>
                    <Command.Item value="create-event" onSelect={() => create("event")} className={itemClass}>
                      <CalendarPlus /> New event
                    </Command.Item>
                    <Command.Item value="create-note" onSelect={() => create("note")} className={itemClass}>
                      <NotebookPen /> New note
                    </Command.Item>
                  </Command.Group>
                  <Command.Group heading="Go to" className={groupClass}>
                    {NAV.map((n) => (
                      <Command.Item key={n.href} value={`nav-${n.href}`} onSelect={() => go(n.href)} className={itemClass}>
                        <n.icon /> {n.label}
                      </Command.Item>
                    ))}
                  </Command.Group>
                  <Command.Group heading="Preferences" className={groupClass}>
                    <Command.Item
                      value="toggle-theme"
                      onSelect={() => {
                        setTheme(resolvedTheme === "dark" ? "light" : "dark");
                        setOpen(false);
                      }}
                      className={itemClass}
                    >
                      {resolvedTheme === "dark" ? <Sun /> : <Moon />} Switch to {resolvedTheme === "dark" ? "light" : "dark"} theme
                    </Command.Item>
                  </Command.Group>
                </>
              )}
            </Command.List>
            <div className="flex items-center gap-3 border-t px-3.5 py-2 text-[11px] text-muted-foreground">
              <span className="flex items-center gap-1">
                <Kbd>↑</Kbd>
                <Kbd>↓</Kbd> navigate
              </span>
              <span className="flex items-center gap-1">
                <Kbd>↵</Kbd> open
              </span>
            </div>
          </Command>
        </D.Content>
      </D.Portal>
    </D.Root>
  );
}
