import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { addDaysToKey, zonedDayStart, zonedInputToDate } from "@/lib/dates";
import type { EventInput } from "@/lib/validation";
import { AppError, NotFoundError } from "./errors";
import { assertLinks, type Db } from "./shared";

export const eventInclude = {
  task: { select: { id: true, title: true } },
  project: { select: { id: true, name: true } },
  customer: { select: { id: true, name: true } },
} satisfies Prisma.EventInclude;

export type EventWithRelations = Prisma.EventGetPayload<{ include: typeof eventInclude }>;

/** Events overlapping [from, to). */
export async function listEvents(workspaceId: string, from: Date, to: Date, db: Db = prisma) {
  return db.event.findMany({
    where: { workspaceId, startAt: { lt: to }, endAt: { gt: from } },
    include: eventInclude,
    orderBy: { startAt: "asc" },
    take: 1000,
  });
}

export async function upcomingEvents(workspaceId: string, now: Date, limit = 6, db: Db = prisma) {
  return db.event.findMany({
    where: { workspaceId, endAt: { gte: now } },
    include: eventInclude,
    orderBy: { startAt: "asc" },
    take: limit,
  });
}

/** Converts form values (wall-clock times in the workspace zone) to stored instants. */
export function eventTimes(input: Pick<EventInput, "allDay" | "start" | "end">, tz: string) {
  if (input.allDay) {
    const startKey = input.start.slice(0, 10);
    const endKey = input.end.slice(0, 10);
    // All-day events end at the start of the day after the last day (exclusive end).
    const startAt = zonedDayStart(startKey, tz);
    const endAt = zonedDayStart(addDaysToKey(endKey, 1), tz);
    if (endAt <= startAt) throw new AppError("End must be on or after the start date.", { end: "End must be on or after the start date" });
    return { startAt, endAt };
  }
  const startAt = zonedInputToDate(input.start, tz);
  const endAt = zonedInputToDate(input.end, tz);
  if (!startAt || !endAt) throw new AppError("Enter a valid start and end time.");
  if (endAt <= startAt) throw new AppError("End must be after the start.", { end: "End must be after the start" });
  return { startAt, endAt };
}

function data(input: EventInput, tz: string) {
  return {
    title: input.title,
    description: input.description,
    location: input.location,
    allDay: input.allDay,
    ...eventTimes(input, tz),
    taskId: input.taskId,
    projectId: input.projectId,
    customerId: input.customerId,
  };
}

export async function createEvent(workspaceId: string, tz: string, input: EventInput, db: Db = prisma) {
  await assertLinks(workspaceId, input, db);
  return db.event.create({ data: { workspaceId, ...data(input, tz) } });
}

export async function updateEvent(workspaceId: string, tz: string, id: string, input: EventInput, db: Db = prisma) {
  const exists = await db.event.count({ where: { id, workspaceId } });
  if (!exists) throw new NotFoundError("Event");
  await assertLinks(workspaceId, input, db);
  return db.event.update({ where: { id }, data: data(input, tz) });
}

export async function deleteEvent(workspaceId: string, id: string, db: Db = prisma) {
  const { count } = await db.event.deleteMany({ where: { id, workspaceId } });
  if (!count) throw new NotFoundError("Event");
}
