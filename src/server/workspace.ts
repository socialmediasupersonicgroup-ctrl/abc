import "server-only";
import { cache } from "react";
import { cookies } from "next/headers";
import { prisma } from "@/lib/db";
import { todayKey } from "@/lib/dates";
import { requireAuth } from "@/server/auth";

export const WORKSPACE_COOKIE = "nexus_workspace";

/**
 * NEXUS is single-user. When NEXUS_PASSWORD is set, every request requires the owner's session
 * (see src/middleware.ts and requireAuth). Workspaces separate data (e.g. two businesses, or demo
 * vs. real); they are not separate user accounts.
 * The active workspace is remembered in a cookie.
 */
export const getWorkspace = cache(async () => {
  await requireAuth();
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
