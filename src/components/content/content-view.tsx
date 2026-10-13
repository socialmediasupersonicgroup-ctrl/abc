"use client";

import * as React from "react";
import { format, parseISO } from "date-fns";
import { formatInTimeZone } from "date-fns-tz";
import { CalendarDays, ChevronLeft, ChevronRight, Columns3, Copy, List, Megaphone, Plus } from "lucide-react";
import { CONTENT_PLATFORMS, CONTENT_STATUS } from "@/lib/constants";
import { addDaysToKey, instantToKey } from "@/lib/dates";
import { safeAnchor, shiftAnchor, visibleRange } from "@/lib/calendar";
import { setContentStatusAction } from "@/server/actions/content";
import { runClientAction } from "@/lib/client/actions";
import { useApp } from "@/components/app/app-context";
import { ContentDialog, copyText, type ContentRecord } from "@/components/forms/content-form";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/misc";
import { Table, TableWrap, TBody, TD, TH, THead, TR } from "@/components/ui/table";
import { ClearFilters, SearchFilter, Segmented, SelectFilter, useUrlParams } from "@/components/shared/url-filters";
import { cn } from "@/lib/utils";

const KEYS = ["q", "status", "platform", "campaign"];
type View = "board" | "list" | "calendar";

export function ContentView({ items, campaigns, selected, view: initialView }: { items: ContentRecord[]; campaigns: string[]; selected: ContentRecord | null; view: View }) {
  // Local state makes the switch instant; the URL keeps it shareable and reload-safe.
  const [view, setView] = React.useState(initialView);
  const { workspace, today, openCreate } = useApp();
  const tz = workspace.timezone;
  const { params, set } = useUrlParams();
  // Follow the browser URL (not the server prop), so a late server refresh can't revert the chosen view.
  const urlView = params.get("view");
  React.useEffect(() => {
    setView(urlView && (["board", "list", "calendar"] as string[]).includes(urlView) ? (urlView as typeof initialView) : "board");
  }, [urlView]);
  const [editing, setEditing] = React.useState<ContentRecord | null>(selected);
  const [optimistic, setOptimistic] = React.useState<Record<string, string>>({});
  React.useEffect(() => setEditing(selected), [selected]);
  React.useEffect(() => setOptimistic({}), [items]);
  const rows = items.map((i) => (optimistic[i.id] ? { ...i, status: optimistic[i.id] } : i));
  const filtered = KEYS.some((k) => params.get(k));

  async function changeStatus(item: ContentRecord, status: string) {
    setOptimistic((o) => ({ ...o, [item.id]: status }));
    const res = await runClientAction(setContentStatusAction(item.id, status), {
      success: status === "PUBLISHED" ? "Marked as published (recorded in NEXUS only)" : `Moved to ${CONTENT_STATUS.label(status)}`,
    });
    if (!res) setOptimistic((o) => ({ ...o, [item.id]: item.status }));
  }

  function close() {
    setEditing(null);
    if (params.get("item")) set({ item: null }, { replace: true });
  }

  const when = (d: Date | null) => (d ? formatInTimeZone(d, tz, "d MMM, h:mm a") : "Unscheduled");

  return (
    <>
      <div className="mb-4 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex flex-wrap items-center gap-2">
          <SearchFilter placeholder="Search titles, captions, hashtags…" />
          <SelectFilter param="status" label="Status" allLabel="All statuses" options={CONTENT_STATUS.list.map((s) => ({ value: s.value, label: s.label }))} />
          <SelectFilter param="platform" label="Platform" allLabel="All platforms" options={CONTENT_PLATFORMS.map((p) => ({ value: p, label: p }))} />
          {campaigns.length > 0 && <SelectFilter param="campaign" label="Campaign" allLabel="All campaigns" options={campaigns.map((c) => ({ value: c, label: c }))} />}
          <ClearFilters keys={KEYS} />
        </div>
        <Segmented
          label="View"
          value={view}
          onChange={(v) => {
              setView(v);
              set({ view: v === "board" ? null : v }, { replace: true });
            }}
          options={[
            { value: "board", label: "Board", icon: Columns3 },
            { value: "list", label: "List", icon: List },
            { value: "calendar", label: "Calendar", icon: CalendarDays },
          ]}
        />
      </div>

      {rows.length === 0 && view !== "calendar" ? (
        <Card>
          <EmptyState
            icon={Megaphone}
            title={filtered ? "No content matches these filters" : "Your content pipeline is empty"}
            description={filtered ? "Try a different filter." : "Capture ideas, draft captions and schedule posts across platforms."}
            action={
              !filtered && (
                <Button onClick={() => openCreate("content")}>
                  <Plus /> New content idea
                </Button>
              )
            }
          />
        </Card>
      ) : view === "board" ? (
        <div className="relative -mx-4 flex snap-x gap-3 overflow-x-auto px-4 pb-2 sm:mx-0 sm:px-0 xl:grid xl:grid-cols-5 xl:overflow-visible">
          {CONTENT_STATUS.list.map((col) => {
            const colItems = rows.filter((r) => r.status === col.value);
            return (
              <section key={col.value} aria-label={col.label} className="flex w-[260px] shrink-0 snap-start flex-col rounded-lg border bg-surface-2/50 xl:w-auto">
                <header className="flex items-center justify-between px-3 py-2.5">
                  <span className="flex items-center gap-2">
                    <Badge tone={col.tone} dot>
                      {col.label}
                    </Badge>
                    <span className="text-xs text-muted-foreground">{colItems.length}</span>
                  </span>
                </header>
                <div className="flex min-h-[100px] flex-col gap-2 px-2 pb-2">
                  {colItems.map((it) => (
                    <article key={it.id} className="group rounded-md border bg-card p-3 shadow-card">
                      <button onClick={() => setEditing(it)} className="block w-full text-left focus-visible:outline-none">
                        <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                          {it.platform} · {it.format}
                        </p>
                        <p className="mt-1 text-[13px] font-medium leading-snug">{it.title}</p>
                        {it.caption && <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">{it.caption}</p>}
                      </button>
                      <div className="mt-2.5 flex items-center justify-between gap-2">
                        <span className={cn("text-[11px]", it.scheduledAt && instantToKey(it.scheduledAt, tz) < today && it.status !== "PUBLISHED" ? "font-medium text-destructive" : "text-muted-foreground")}>
                          {when(it.scheduledAt)}
                        </span>
                        <select
                          aria-label="Move to"
                          value={it.status}
                          onChange={(e) => changeStatus(it, e.target.value)}
                          className="h-6 rounded border-0 bg-transparent text-[11px] text-muted-foreground focus:ring-1 focus:ring-ring xl:opacity-0 xl:group-hover:opacity-100 xl:focus:opacity-100"
                        >
                          {CONTENT_STATUS.list.map((s) => (
                            <option key={s.value} value={s.value}>
                              {s.label}
                            </option>
                          ))}
                        </select>
                      </div>
                    </article>
                  ))}
                </div>
              </section>
            );
          })}
        </div>
      ) : view === "list" ? (
        <Card className="overflow-hidden">
          <TableWrap>
            <Table>
              <THead>
                <tr>
                  <TH>Content</TH>
                  <TH className="hidden md:table-cell">Platform</TH>
                  <TH className="hidden lg:table-cell">Campaign</TH>
                  <TH>Scheduled</TH>
                  <TH>Status</TH>
                  <TH className="w-10">
                    <span className="sr-only">Copy</span>
                  </TH>
                </tr>
              </THead>
              <TBody>
                {rows.map((it) => (
                  <TR key={it.id}>
                    <TD className="max-w-[320px]">
                      <button onClick={() => setEditing(it)} className="block w-full truncate text-left font-medium hover:text-primary">
                        {it.title}
                      </button>
                      <span className="block truncate text-xs text-muted-foreground">{it.format}</span>
                    </TD>
                    <TD className="hidden text-[13px] md:table-cell">{it.platform}</TD>
                    <TD className="hidden text-[13px] text-muted-foreground lg:table-cell">{it.campaign ?? "—"}</TD>
                    <TD className="whitespace-nowrap text-[13px] text-muted-foreground">{when(it.scheduledAt)}</TD>
                    <TD>
<select
                        aria-label={`Status for ${it.title}`}
                        value={it.status}
                        onChange={(e) => changeStatus(it, e.target.value)}
                        className="h-7 rounded-md border bg-surface px-2 text-xs font-medium focus:outline-none focus:ring-2 focus:ring-ring"
                      >
                        {CONTENT_STATUS.list.map((s) => (
                          <option key={s.value} value={s.value}>
                            {s.label}
                          </option>
                        ))}
                      </select>
                    </TD>
                    <TD className="w-10">
                      <Button
                        variant="ghost"
                        size="icon-xs"
                        disabled={!it.caption}
                        aria-label={`Copy caption for ${it.title}`}
                        onClick={() => copyText(it.hashtags ? `${it.caption}\n\n${it.hashtags}` : (it.caption ?? ""), "Caption copied")}
                      >
                        <Copy />
                      </Button>
                    </TD>
                  </TR>
                ))}
              </TBody>
            </Table>
          </TableWrap>
        </Card>
      ) : (
        <ContentCalendar items={rows} onOpen={setEditing} />
      )}

      <ContentDialog open={!!editing} onOpenChange={(o) => !o && close()} item={editing} campaigns={campaigns} />
    </>
  );
}

function ContentCalendar({ items, onOpen }: { items: ContentRecord[]; onOpen: (i: ContentRecord) => void }) {
  const { workspace, today, openCreate } = useApp();
  const tz = workspace.timezone;
  const { params, set } = useUrlParams();
  const anchor = safeAnchor(params.get("date") ?? "", today);
  const range = visibleRange("month", anchor, workspace.weekStartsOn === 0 ? 0 : 1);
  const days = Array.from({ length: 42 }, (_, i) => addDaysToKey(range.from, i));
  const byDay = new Map<string, ContentRecord[]>();
  for (const it of items) {
    if (!it.scheduledAt) continue;
    const k = instantToKey(it.scheduledAt, tz);
    byDay.set(k, [...(byDay.get(k) ?? []), it]);
  }
  const unscheduled = items.filter((i) => !i.scheduledAt);
  return (
    <div className="grid gap-4 xl:grid-cols-[1fr_260px]">
      <Card className="overflow-hidden">
        <div className="flex items-center gap-2 border-b px-4 py-2.5">
          <Button variant="outline" size="icon-xs" aria-label="Previous month" onClick={() => set({ date: shiftAnchor("month", anchor, -1) })}>
            <ChevronLeft />
          </Button>
          <Button variant="outline" size="icon-xs" aria-label="Next month" onClick={() => set({ date: shiftAnchor("month", anchor, 1) })}>
            <ChevronRight />
          </Button>
          <span className="ml-1 text-sm font-semibold">{format(parseISO(anchor), "MMMM yyyy")}</span>
        </div>
        <div className="grid grid-cols-7 border-b bg-surface-2/60 text-center text-xs font-medium text-muted-foreground">
          {days.slice(0, 7).map((d) => (
            <div key={d} className="py-2">
              {format(parseISO(d), "EEE")}
            </div>
          ))}
        </div>
        <div className="grid grid-cols-7">
          {days.map((d, i) => (
            <div key={d} className={cn("group min-h-[90px] border-b border-r p-1", (i + 1) % 7 === 0 && "border-r-0", d.slice(0, 7) !== anchor.slice(0, 7) && "bg-surface-2/40")}>
              <div className="flex items-center justify-between">
                <span className={cn("flex size-6 items-center justify-center rounded-full text-xs", d === today && "bg-primary font-semibold text-primary-foreground")}>{Number(d.slice(8))}</span>
                <button onClick={() => openCreate("content", { date: d })} className="rounded p-0.5 text-muted-foreground opacity-0 transition-opacity hover:bg-accent focus-visible:opacity-100 group-hover:opacity-100 [@media(hover:none)]:opacity-100" aria-label={`Plan content on ${d}`}>
                  <Plus className="size-3.5" />
                </button>
              </div>
              <ul className="mt-0.5 space-y-0.5">
                {(byDay.get(d) ?? []).map((it) => (
                  <li key={it.id}>
                    <button
                      onClick={() => onOpen(it)}
                      className={cn("w-full truncate rounded bg-primary-soft px-1.5 py-0.5 text-left text-[11px] font-medium hover:bg-primary-soft/70", it.status === "PUBLISHED" && "opacity-60")}
                      title={`${it.platform}: ${it.title}`}
                    >
                      {it.platform.slice(0, 2).toUpperCase()} · {it.title}
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </Card>
      <Card className="p-4">
        <p className="text-sm font-semibold">Unscheduled</p>
        <p className="mb-3 text-xs text-muted-foreground">Ideas without a date</p>
        {unscheduled.length ? (
          <ul className="space-y-1.5">
            {unscheduled.map((it) => (
              <li key={it.id}>
                <button onClick={() => onOpen(it)} className="w-full rounded-md border px-2.5 py-1.5 text-left text-[13px] hover:bg-accent">
                  <span className="block truncate font-medium">{it.title}</span>
                  <span className="text-xs text-muted-foreground">{it.platform}</span>
                </button>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-xs text-muted-foreground">Everything is scheduled.</p>
        )}
      </Card>
    </div>
  );
}
