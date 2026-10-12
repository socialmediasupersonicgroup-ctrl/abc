"use server";

import { z } from "zod";
import { CONTENT_STATUS } from "@/lib/constants";
import { contentSchema, type ContentFormValues } from "@/lib/validation";
import * as content from "@/lib/services/content";
import { getContext } from "@/server/workspace";
import { assertId, parseInput, runAction } from "@/server/action-utils";

export async function createContentAction(values: ContentFormValues) {
  return runAction(async () => {
    const { workspaceId, tz } = await getContext();
    const c = await content.createContent(workspaceId, tz, parseInput(contentSchema, values));
    return { id: c.id };
  }, "Content item created");
}

export async function updateContentAction(id: string, values: ContentFormValues) {
  return runAction(async () => {
    const { workspaceId, tz } = await getContext();
    await content.updateContent(workspaceId, tz, assertId(id), parseInput(contentSchema, values));
    return { id };
  }, "Content item updated");
}

export async function setContentStatusAction(id: string, status: string) {
  return runAction(async () => {
    const { workspaceId } = await getContext();
    await content.setContentStatus(workspaceId, assertId(id), parseInput(z.enum(CONTENT_STATUS.values), status));
  }, "Status updated");
}

export async function deleteContentAction(id: string) {
  return runAction(async () => {
    const { workspaceId } = await getContext();
    await content.deleteContent(workspaceId, assertId(id));
  }, "Content item deleted");
}
