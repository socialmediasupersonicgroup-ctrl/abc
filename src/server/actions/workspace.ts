"use server";

import { cookies } from "next/headers";
import { prisma } from "@/lib/db";
import { workspaceSchema, type WorkspaceFormValues } from "@/lib/validation";
import * as workspaces from "@/lib/services/workspaces";
import { seedDemoData } from "@/lib/demo-data";
import { AppError } from "@/lib/services/errors";
import { getContext, WORKSPACE_COOKIE } from "@/server/workspace";
import { assertId, parseInput, runAction } from "@/server/action-utils";

async function setActive(id: string) {
  const store = await cookies();
  store.set(WORKSPACE_COOKIE, id, { httpOnly: true, sameSite: "lax", path: "/", maxAge: 60 * 60 * 24 * 365 });
}

export async function switchWorkspaceAction(id: string) {
  return runAction(async () => {
    const ws = await prisma.workspace.findUnique({ where: { id: assertId(id) } });
    if (!ws) throw new AppError("Workspace not found.");
    await setActive(ws.id);
  }, "Workspace switched");
}

export async function createWorkspaceAction(name: string) {
  return runAction(async () => {
    const { currency } = await getContext();
    const ws = await workspaces.createWorkspace(name, { currency });
    await setActive(ws.id);
    return { id: ws.id };
  }, "Workspace created");
}

export async function updateWorkspaceAction(values: WorkspaceFormValues) {
  return runAction(async () => {
    const { workspaceId } = await getContext();
    await workspaces.updateWorkspace(workspaceId, parseInput(workspaceSchema, values));
  }, "Settings saved");
}

/** Creates (or refreshes) the dedicated demo workspace and switches to it. Never touches real workspaces. */
export async function loadDemoWorkspaceAction() {
  return runAction(async () => {
    let demo = await prisma.workspace.findFirst({ where: { isDemo: true } });
    if (demo) await workspaces.clearWorkspaceData(demo.id);
    else demo = await workspaces.createWorkspace("Demo Studio (sample data)", { isDemo: true });
    await seedDemoData(prisma, demo.id, demo.timezone);
    await setActive(demo.id);
  }, "Demo workspace ready");
}

export async function clearWorkspaceDataAction(confirmName: string) {
  return runAction(async () => {
    const { ws } = await getContext();
    if (confirmName.trim() !== ws.name) throw new AppError("The workspace name you typed does not match.");
    await workspaces.clearWorkspaceData(ws.id);
  }, "All workspace data deleted");
}

export async function deleteWorkspaceAction(confirmName: string) {
  return runAction(async () => {
    const { ws } = await getContext();
    if (confirmName.trim() !== ws.name) throw new AppError("The workspace name you typed does not match.");
    await workspaces.deleteWorkspace(ws.id);
    const next = await prisma.workspace.findFirst({ orderBy: { createdAt: "asc" } });
    if (next) await setActive(next.id);
  }, "Workspace deleted");
}
