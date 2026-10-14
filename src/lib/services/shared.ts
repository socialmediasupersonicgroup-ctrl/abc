import { Prisma, type PrismaClient } from "@prisma/client";
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

type TextTable = "Task" | "Project" | "Customer" | "Transaction" | "Invoice" | "Event" | "ContentItem" | "Note" | "Tag";

export type TextSpec = {
  table: TextTable;
  /** Text columns on the table itself (Prisma field names = SQLite column names). */
  columns: string[];
  /** Text on a related record, e.g. a transaction's customer name. */
  relations?: { fk: string; relation: string; table: TextTable; columns: string[] }[];
  /** Match tag names through a many-to-many `tags` relation. */
  tags?: boolean;
};

/** Ids of rows whose columns literally contain `q` (case-insensitive for ASCII, like SQLite LIKE). */
async function literalIds(db: Db, workspaceId: string, table: TextTable, columns: string[], q: string): Promise<string[]> {
  // Table and column names come from the constant specs in the services, never from user input.
  const conds = columns.map((c) => Prisma.sql`instr(lower(coalesce(${Prisma.raw(`"${c}"`)}, '')), lower(${q})) > 0`);
  const rows = await db.$queryRaw<{ id: string }[]>(
    Prisma.sql`SELECT "id" FROM ${Prisma.raw(`"${table}"`)} WHERE "workspaceId" = ${workspaceId} AND (${Prisma.join(conds, " OR ")})`,
  );
  return rows.map((r) => r.id);
}

/**
 * Where-fragment for a free-text search across a spec's fields.
 * Plain queries use Prisma `contains` (SQLite LIKE). Queries containing % or _ — which LIKE would treat as
 * wildcards and Prisma cannot escape — are matched literally with instr() via a parameterised raw query,
 * so lists, counts and summaries stay exact.
 */
export async function textWhere(db: Db, workspaceId: string, rawQuery: string | undefined | null, spec: TextSpec): Promise<Record<string, unknown> | null> {
  const q = rawQuery?.trim().slice(0, 200);
  if (!q) return null;
  if (!/[%_]/.test(q)) {
    const c = { contains: q };
    return {
      OR: [
        ...spec.columns.map((col) => ({ [col]: c })),
        ...(spec.relations ?? []).flatMap((r) => r.columns.map((col) => ({ [r.relation]: { [col]: c } }))),
        ...(spec.tags ? [{ tags: { some: { name: c } } }] : []),
      ],
    };
  }
  const [ids, relIds, tagIds] = await Promise.all([
    literalIds(db, workspaceId, spec.table, spec.columns, q),
    Promise.all((spec.relations ?? []).map((r) => literalIds(db, workspaceId, r.table, r.columns, q))),
    spec.tags ? literalIds(db, workspaceId, "Tag", ["name"], q) : Promise.resolve([] as string[]),
  ]);
  return {
    OR: [
      { id: { in: ids } },
      ...(spec.relations ?? []).map((r, i) => ({ [r.fk]: { in: relIds[i] } })),
      ...(spec.tags ? [{ tags: { some: { id: { in: tagIds } } } }] : []),
    ],
  };
}
