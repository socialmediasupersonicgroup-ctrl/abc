"use client";

import * as React from "react";
import Link from "next/link";
import { format, parseISO } from "date-fns";
import { formatInTimeZone } from "date-fns-tz";
import { CalendarDays, CheckSquare, ChevronLeft, ChevronRight, FolderKanban, Megaphone, Plus } from "lucide-react";
import { addDaysToKey, instantToKey } from "@/lib/dates";
import { shiftAnchor, type CalendarView as View } from "@/lib/calendar";
import { useApp } from "@/components/app/app-context";
import { EventDialog, type EventRecord } from "@/components/forms/event-form";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/misc";
import { Segmented, useUrlParams } from "@/components/shared/url-filters";
import { cn } from "@/lib/utils";

export type CalEvent = EventRecord & { customer: { name: string } | null; project: { name: string } | null };
export type CalMarker = { id: string; kind: "task" | "project" | "content"; title: string; day: string; done?: boolean; href: string; time?: string; sortTime?: string };

type Item =
  | { kind: "event"; id: string; title: string; sort: string; time: string; allDay: boolean; event: CalEvent }
  | { kind: CalMarker["kind"]; id: string; title: string; sort: string; time: string; marker: CalMarker };

const MARKER_ICON = { task: CheckSquare, project: FolderKanban, content: Megaphone };

export function CalendarView({
  view,
  anchor,
  range,
  events,
  markers,
  selected,
}: {
  view: View;
  anchor: string;
  range: { from: string; to: string; days: number };
  events: CalEvent[];
  markers: CalMarker[];
  selected: CalEvent | null;
}) {
  const { workspace, today, openCreate } = useApp();
  const tz = workspace.timezone;
  const { set, params } = useUrlParams();
  const [editing, setEditing] = React.useState<CalEvent | null>(selected);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  React.useEffect(() => setEditing(selected), [selected?.id]);

  const days = React.useMemo(() => Array.from({ length: range.days }, (_, i) => addDaysToKey(range.from, i)), [range]);

  const byDay = React.useMemo(() => {
    const map = new Map<string, Item[]>();
    const push = (day: string, item: Item) => {
      if (day < range.from || day > range.to) return;
      map.set(day, [...(map.get(day) ?? []), item]);
    };
    for (const e of events) {
      const startKey = instantToKey(e.startAt, tz);
      // End is exclusive: an event ending exactly at midnight does not occupy that day.
      const endKey = instantToKey(new Date(new Date(e.endAt).getTime() - 1), tz);
      const time = e.allDay ? "All day" : formatInTimeZone(e.startAt, tz, "h:mm a");
      for (let d = startKey < range.from ? range.from : startKey; d <= endKey && d <= range.to; d = addDaysToKey(d, 1)) {
        push(d, {
          kind: "event",
          id: e.id,
          title: e.title,
          sort: e.allDay || d !== startKey ? "0" : formatInTimeZone(e.startAt, tz, "HH:mm"),
          time: d !== startKey ? "Continues" : time,
          allDay: e.allDay,
          event: e,
        });
      }
    }
    // Sort keys are 24-hour "HH:mm" for both events and markers; untimed markers ("0…") lead the day.
    for (const m of markers) push(m.day, { kind: m.kind, id: m.id, title: m.title, sort: m.sortTime ?? "0", time: m.time ?? "", marker: m });
    for (const list of map.values()) list.sort((a, b) => a.sort.localeCompare(b.sort));
    return map;
  }, [events, markers, range, tz]);

  const title =
    view === "month"
      ? format(parseISO(anchor), "MMMM yyyy")
      : view === "week"
        ? `${format(parseISO(range.from), "d MMM")} – ${format(parseISO(range.to), "d MMM yyyy")}`
        : `Next 30 days from ${format(parseISO(range.from), "d MMM")}`;

  const weekdays = days.slice(0, 7).map((d) => format(parseISO(d), "EEE"));
  const month = anchor.slice(0, 7);

  function openItem(item: Item) {
    if (item.kind === "event") setEditing(item.event);
  }

  function closeEvent() {
    setEditing(null);
    if (params.get("event")) set({ event: null }, { replace: true });
  }

  return (
    <>
      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-2">
          <Button variant="outline" size="icon-sm" aria-label="Previous" onClick={() => set({ date: shiftAnchor(view, anchor, -1) })}>
            <ChevronLeft />
          </Button>
          <Button variant="outline" size="icon-sm" aria-label="Next" onClick={() => set({ date: shiftAnchor(view, anchor, 1) })}>
            <ChevronRight />
          </Button>
          <Button variant="outline" size="sm" onClick={() => set({ date: null })}>
            Today
          </Button>
          <h2 className="ml-2 text-[15px] font-semibold" aria-live="polite">
            {title}
          </h2>
        </div>
        <div className="flex items-center gap-2">
          <Segmented
            label="Calendar view"
            value={view}
            onChange={(v) => set({ view: v === "month" ? null : v })}
            options={[
              { value: "month", label: "Month" },
              { value: "week", label: "Week" },
              { value: "agenda", label: "Agenda" },
            ]}
          />
        </div>
      </div>

      <div className="mb-3 flex flex-wrap gap-4 text-xs text-muted-foreground">
        <span className="flex items-center gap-1.5">
          <span className="size-2 rounded-full bg-primary" /> Events
        </span>
        <span className="flex items-center gap-1.5">
          <CheckSquare className="size-3.5" /> Task deadlines
        </span>
        <span className="flex items-center gap-1.5">
          <FolderKanban className="size-3.5" /> Project deadlines
        </span>
        <span className="flex items-center gap-1.5">
          <Megaphone className="size-3.5" /> Scheduled content
        </span>
      </div>

      {view === "month" && (
        <Card className="overflow-hidden">
          <div className="grid grid-cols-7 border-b bg-surface-2/60">
            {weekdays.map((w) => (
              <div key={w} className="px-2 py-2 text-center text-xs font-medium text-muted-foreground">
                {w}
              </div>
            ))}
          </div>
          <div className="grid grid-cols-7">
            {days.map((d, i) => {
              const items = byDay.get(d) ?? [];
              const inMonth = d.slice(0, 7) === month;
              return (
                <div
                  key={d}
                  className={cn(
                    "group relative min-h-[76px] border-b border-r p-1 sm:min-h-[112px] sm:p-1.5",
                    (i + 1) % 7 === 0 && "border-r-0",
                    i >= 35 && "border-b-0",
                    !inMonth && "bg-surface-2/40",
                  )}
                >
                  <div className="mb-1 flex items-center justify-between">
                    <span
                      className={cn(
                        "flex size-6 items-center justify-center rounded-full text-xs",
                        d === today ? "bg-primary font-semibold text-primary-foreground" : inMonth ? "text-foreground" : "text-muted-foreground/60",
                      )}
                    >
                      {Number(d.slice(8))}
                    </span>
                    <button
                      onClick={() => openCreate("event", { date: d })}
                      className="rounded p-0.5 text-muted-foreground opacity-0 transition-opacity hover:bg-accent hover:text-foreground focus-visible:opacity-100 group-hover:opacity-100 [@media(hover:none)]:opacity-100"
                      aria-label={`Add event on ${d}`}
                    >
                      <Plus className="size-3.5" />
                    </button>
                  </div>
                  <ul className="space-y-0.5">
                    {items.slice(0, 3).map((it) => (
                      <li key={`${it.kind}-${it.id}`}>
                        <ItemChip item={it} onOpen={openItem} compact />
                      </li>
                    ))}
                    {items.length > 3 && (
                      <li>
                        <button onClick={() => set({ view: "week", date: d })} className="w-full px-1 text-left text-[11px] font-medium text-muted-foreground hover:text-foreground">
                          +{items.length - 3} more
                        </button>
                      </li>
                    )}
                  </ul>
                </div>
              );
            })}
          </div>
        </Card>
      )}

      {view === "week" && (
        <div className="grid gap-3 md:grid-cols-7">
          {days.map((d) => {
            const items = byDay.get(d) ?? [];
            return (
              <Card key={d} className={cn("flex min-h-[140px] flex-col md:min-h-[420px]", d === today && "border-primary/50")}>
                <div className="flex items-center justify-between border-b px-3 py-2">
                  <span className="text-xs">
                    <span className="font-medium text-muted-foreground">{format(parseISO(d), "EEE")}</span>{" "}
                    <span className={cn("font-semibold", d === today && "text-primary")}>{format(parseISO(d), "d MMM")}</span>
                  </span>
                  <button onClick={() => openCreate("event", { date: d })} className="rounded p-0.5 text-muted-foreground hover:bg-accent hover:text-foreground" aria-label={`Add event on ${d}`}>
                    <Plus className="size-3.5" />
                  </button>
                </div>
                <ul className="flex-1 space-y-1 p-2">
                  {items.map((it) => (
                    <li key={`${it.kind}-${it.id}`}>
                      <ItemChip item={it} onOpen={openItem} />
                    </li>
                  ))}
                  {items.length === 0 && <li className="py-2 text-center text-[11px] text-muted-foreground/70">—</li>}
                </ul>
              </Card>
            );
          })}
        </div>
      )}

      {view === "agenda" && (
        <Card>
          {days.every((d) => !(byDay.get(d)?.length)) ? (
            <EmptyState
              icon={CalendarDays}
              title="Nothing scheduled"
              description="No events, deadlines or scheduled content in the next 30 days."
              action={
                <Button onClick={() => openCreate("event")}>
                  <Plus /> New event
                </Button>
              }
            />
          ) : (
            <ul className="divide-y">
              {days
                .filter((d) => byDay.get(d)?.length)
                .map((d) => (
                  <li key={d} className="grid gap-2 px-5 py-4 sm:grid-cols-[140px_1fr]">
                    <div>
                      <p className={cn("text-sm font-semibold", d === today && "text-primary")}>{d === today ? "Today" : format(parseISO(d), "EEEE")}</p>
                      <p className="text-xs text-muted-foreground">{format(parseISO(d), "d MMMM yyyy")}</p>
                    </div>
                    <ul className="space-y-1.5">
                      {byDay.get(d)!.map((it) => (
                        <li key={`${it.kind}-${it.id}`}>
                          <ItemChip item={it} onOpen={openItem} detailed />
                        </li>
                      ))}
                    </ul>
                  </li>
                ))}
            </ul>
          )}
        </Card>
      )}

      <EventDialog open={!!editing} onOpenChange={(o) => !o && closeEvent()} event={editing} />
    </>
  );
}

function ItemChip({ item, onOpen, compact, detailed }: { item: Item; onOpen: (i: Item) => void; compact?: boolean; detailed?: boolean }) {
  if (item.kind === "event") {
    const e = item.event;
    return (
      <button
        onClick={() => onOpen(item)}
        className={cn(
          "flex w-full items-center gap-1.5 rounded px-1.5 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
          item.allDay ? "bg-primary text-primary-foreground hover:bg-primary/90" : "bg-primary-soft text-foreground hover:bg-primary-soft/70",
          compact ? "py-0.5 text-[11px]" : "py-1 text-xs",
        )}
        title={`${item.title} · ${item.time}`}
      >
        {!item.allDay && <span className="size-1.5 shrink-0 rounded-full bg-primary" />}
        {!compact && !item.allDay && <span className="shrink-0 tabular text-muted-foreground">{item.time}</span>}
        <span className="truncate font-medium">{item.title}</span>
        {detailed && (e.customer || e.project) && <span className="ml-auto hidden shrink-0 truncate text-muted-foreground sm:block">{e.customer?.name ?? e.project?.name}</span>}
      </button>
    );
  }
  const m = item.marker;
  const Icon = MARKER_ICON[m.kind];
  return (
    <Link
      href={m.href}
      className={cn(
        "flex w-full items-center gap-1.5 rounded border border-dashed px-1.5 text-left text-muted-foreground transition-colors hover:border-solid hover:bg-accent hover:text-foreground",
        compact ? "py-0.5 text-[11px]" : "py-1 text-xs",
        m.done && "line-through opacity-60",
      )}
      title={m.title}
    >
      <Icon className="size-3 shrink-0" />
      {!compact && m.time && <span className="shrink-0 tabular">{m.time}</span>}
      <span className="truncate">{m.title}</span>
    </Link>
  );
}
