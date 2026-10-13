"use server";

import { globalSearch } from "@/lib/services/search";
import { getContext } from "@/server/workspace";

export async function searchAction(query: string) {
  if (typeof query !== "string") return [];
  const { workspaceId, currency, tz } = await getContext();
  try {
    return await globalSearch(workspaceId, query, currency, 5, tz);
  } catch (err) {
    console.error("[nexus] search failed", err);
    return [];
  }
}
