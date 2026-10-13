import { prisma } from "@/lib/db";
import { getContext } from "@/server/workspace";
import { listEvents, eventInclude } from "@/lib/services/events";
import { str, type SearchParams } from "@/server/load";
import { keyToDate, addDaysToKey, zonedDayStart, dateToKey, instantToKey, formatTime, formatDateTime } from "@/lib/dates";
import { safeAnchor, visibleRange, type CalendarView as View } from "@/lib/calendar";
import { PageHeader } from "@/components/ui/misc";
import { NewButton } from "@/components/shared/new-button";
import { CalendarView, type CalMarker } from "@/components/calendar/calendar-view";

export const metadata = { title: "Calendar" };

export default async function CalendarPage({ searchParams }: { searchParams: SearchParams }) {
  const sp = await searchParams;
  const { ws, today, tz } = await getContext();
  const view: View = (["week", "agenda"] as const).find((v) => v === str(sp.view)) ?? "month";
  const anchor = safeAnchor(str(sp.date), today);
  const range = visibleRange(view, anchor, ws.weekStartsOn === 0 ? 0 : 1);
  const from = zonedDayStart(range.from, tz);
  const to = zonedDayStart(addDaysToKey(range.to, 1), tz);
  const selectedId = str(sp.event);

  const [events, tasks, projects, content, selected] = await Promise.all([
    listEvents(ws.id, from, to),
    prisma.task.findMany({
      where: { workspaceId: ws.id, dueDate: { gte: keyToDate(range.from), lte: keyToDate(range.to) } },
      select: { id: true, title: true, dueDate: true, status: true },
    }),
    prisma.project.findMany({
      where: { workspaceId: ws.id, dueDate: { gte: keyToDate(range.from), lte: keyToDate(range.to) } },
      select: { id: true, name: true, dueDate: true, status: true },
    }),
    prisma.contentItem.findMany({
      where: { workspaceId: ws.id, scheduledAt: { gte: from, lt: to } },
      select: { id: true, title: true, scheduledAt: true, status: true, platform: true },
    }),
    selectedId ? prisma.event.findFirst({ where: { id: selectedId, workspaceId: ws.id }, include: eventInclude }) : Promise.resolve(null),
  ]);

  const markers: CalMarker[] = [
    ...tasks.map((t) => ({ id: t.id, kind: "task" as const, title: t.title, day: dateToKey(t.dueDate!), done: t.status === "DONE", href: `/tasks?task=${t.id}` })),
    ...projects.map((p) => ({
      id: p.id,
      kind: "project" as const,
      title: `Deadline: ${p.name}`,
      day: dateToKey(p.dueDate!),
      done: p.status === "COMPLETED" || p.status === "CANCELLED",
      href: `/projects/${p.id}`,
    })),
    ...content.map((c) => ({
      id: c.id,
      kind: "content" as const,
      title: `${c.platform}: ${c.title}`,
      day: instantToKey(c.scheduledAt!, tz),
      time: formatTime(c.scheduledAt!, tz),
      sortTime: formatDateTime(c.scheduledAt!, tz, "HH:mm"),
      done: c.status === "PUBLISHED",
      href: `/content?item=${c.id}`,
    })),
  ];

  return (
    <>
      <PageHeader
        title="Calendar"
        description={`Events, deadlines and scheduled content · times shown in ${tz}. Not synced with external calendars.`}
        actions={<NewButton kind="event" label="New event" defaults={{ date: anchor }} />}
      />
      <CalendarView view={view} anchor={anchor} range={range} events={events} markers={markers} selected={selected} />
    </>
  );
}
