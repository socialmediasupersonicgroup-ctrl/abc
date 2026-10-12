import type { Prisma, PrismaClient } from "@prisma/client";
import { prisma } from "@/lib/db";
import { keyToDate } from "@/lib/dates";
import { parseTagList } from "@/lib/utils";
import { AppError } from "./errors";

export type Db = PrismaClient | Prisma.TransactionClient;

export const toDate = (key: string | null | undefined) => (key ? keyToDate(key) : null);

/** Ensures optional foreign keys point at records inside the same workspace. */
export async function assertLinks(
  workspaceId: string,
  links: { projectId?: string | null; customerId?: string | null; taskId?: string | null },
  db: Db = prisma,
) {
  const checks: Promise<void>[] = [];
  if (links.projectId)
    checks.push(
      db.project.count({ where: { id: links.projectId, workspaceId } }).then((n) => {
        if (!n) throw new AppError("The selected project no longer exists.");
      }),
    );
  if (links.customerId)
    checks.push(
      db.customer.count({ where: { id: links.customerId, workspaceId } }).then((n) => {
        if (!n) throw new AppError("The selected customer no longer exists.");
      }),
    );
  if (links.taskId)
    checks.push(
      db.task.count({ where: { id: links.taskId, workspaceId } }).then((n) => {
        if (!n) throw new AppError("The selected task no longer exists.");
      }),
    );
  await Promise.all(checks);
}

/** Builds a relation payload that sets the record's tags to exactly the given list. */
export function tagsPayload(workspaceId: string, input: string | null | undefined, mode: "create" | "update") {
  const names = parseTagList(input);
  const connectOrCreate = names.map((name) => ({
    where: { workspaceId_name: { workspaceId, name } },
    create: { workspaceId, name },
  }));
  return mode === "create" ? { connectOrCreate } : { set: [], connectOrCreate };
}

export async function pruneOrphanTags(workspaceId: string, db: Db = prisma) {
  await db.tag.deleteMany({ where: { workspaceId, tasks: { none: {} }, notes: { none: {} } } });
}

export function containsText(q: string | undefined | null) {
  const v = q?.trim();
  return v ? { contains: v } : undefined;
}
