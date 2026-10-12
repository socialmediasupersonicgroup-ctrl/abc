import "server-only";
import { cache } from "react";
import { cookies } from "next/headers";
import { prisma } from "@/lib/db";
import { todayKey } from "@/lib/dates";

export const WORKSPACE_COOKIE = "nexus_workspace";

/**
 * NEXUS runs in local single-user mode: there is no authentication, and workspaces are a way of
 * separating data (e.g. two businesses, or demo vs. real), not a security boundary.
 * The active workspace is remembered in a cookie.
 */
export const getWorkspace = cache(async () => {
  const store = await cookies();
  const id = store.get(WORKSPACE_COOKIE)?.value;
  let ws = id ? await prisma.workspace.findUnique({ where: { id } }) : null;
  if (!ws) ws = await prisma.workspace.findFirst({ where: { isDemo: false }, orderBy: { createdAt: "asc" } });
  if (!ws) ws = await prisma.workspace.findFirst({ orderBy: { createdAt: "asc" } });
  if (!ws) ws = await prisma.workspace.create({ data: { name: "My Workspace" } });
  return ws;
});

export async function getContext() {
  const ws = await getWorkspace();
  return { ws, workspaceId: ws.id, tz: ws.timezone, today: todayKey(ws.timezone), currency: ws.currency };
}
