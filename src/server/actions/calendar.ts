"use server";

import { eventSchema, type EventFormValues } from "@/lib/validation";
import * as events from "@/lib/services/events";
import { getContext } from "@/server/workspace";
import { assertId, parseInput, runAction } from "@/server/action-utils";

export async function createEventAction(values: EventFormValues) {
  return runAction(async () => {
    const { workspaceId, tz } = await getContext();
    const e = await events.createEvent(workspaceId, tz, parseInput(eventSchema, values));
    return { id: e.id };
  }, "Event created");
}

export async function updateEventAction(id: string, values: EventFormValues) {
  return runAction(async () => {
    const { workspaceId, tz } = await getContext();
    await events.updateEvent(workspaceId, tz, assertId(id), parseInput(eventSchema, values));
    return { id };
  }, "Event updated");
}

export async function deleteEventAction(id: string) {
  return runAction(async () => {
    const { workspaceId } = await getContext();
    await events.deleteEvent(workspaceId, assertId(id));
  }, "Event deleted");
}
