import type { PrismaClient } from "@prisma/client";
import { prisma } from "@/lib/db";
import type { WorkspaceInput } from "@/lib/validation";
import { instantToKey, zonedDayStart } from "@/lib/dates";
import { AppError, NotFoundError } from "./errors";

export async function listWorkspaces(db: PrismaClient = prisma) {
  return db.workspace.findMany({ orderBy: { createdAt: "asc" }, select: { id: true, name: true, isDemo: true, currency: true } });
}

export async function createWorkspace(name: string, opts: { currency?: string; isDemo?: boolean } = {}, db: PrismaClient = prisma) {
  const trimmed = name.trim().slice(0, 80);
  if (!trimmed) throw new AppError("Workspace name is required.", { name: "Workspace name is required" });
  return db.workspace.create({ data: { name: trimmed, currency: opts.currency ?? "INR", isDemo: opts.isDemo ?? false } });
}

/** True when the workspace already holds amounts, so its currency can no longer be changed safely. */
export async function hasMoneyRecords(workspaceId: string, db: PrismaClient = prisma) {
  const [invoices, transactions, valued] = await Promise.all([
    db.invoice.count({ where: { workspaceId } }),
    db.transaction.count({ where: { workspaceId } }),
    db.customer.count({ where: { workspaceId, dealValue: { gt: 0 } } }).then(async (n) => n + (await db.project.count({ where: { workspaceId, budget: { gt: 0 } } }))),
  ]);
  return invoices + transactions + valued > 0;
}

export async function updateWorkspace(id: string, input: WorkspaceInput, db: PrismaClient = prisma) {
  const current = await db.workspace.findUnique({ where: { id } });
  if (!current) throw new NotFoundError("Workspace");
  if (input.currency !== current.currency && (await hasMoneyRecords(id, db))) {
    // NEXUS does not convert amounts; relabelling stored amounts in another currency would misstate them.
    throw new AppError(
      `The currency can't be changed because this workspace already has amounts in ${current.currency}. Create a new workspace for ${input.currency}.`,
      { currency: "Locked once amounts exist" },
    );
  }
  return db.$transaction(
    async (tx) => {
      // Compare-and-set on the time zone read inside the transaction: if another save changed it meanwhile,
      // stop instead of re-anchoring all-day events from a stale zone (which would shift them by a day).
      const fresh = await tx.workspace.findUniqueOrThrow({ where: { id }, select: { timezone: true } });
      if (input.timezone !== fresh.timezone) {
        const { count } = await tx.workspace.updateMany({ where: { id, timezone: fresh.timezone }, data: { timezone: input.timezone } });
        if (count === 0) throw new AppError("Settings were changed in another tab. Reload and try again.");
        const allDay = await tx.event.findMany({ where: { workspaceId: id, allDay: true }, select: { id: true, startAt: true, endAt: true } });
        for (const e of allDay) {
          await tx.event.update({
            where: { id: e.id },
            data: {
              startAt: zonedDayStart(instantToKey(e.startAt, fresh.timezone), input.timezone),
              endAt: zonedDayStart(instantToKey(e.endAt, fresh.timezone), input.timezone),
            },
          });
        }
      }
      return tx.workspace.update({
        where: { id },
        data: {
          name: input.name,
          currency: input.currency,
          timezone: input.timezone,
          weekStartsOn: input.weekStartsOn,
          invoicePrefix: input.invoicePrefix,
          defaultTaxBps: input.defaultTaxRate,
          ownerName: input.ownerName,
          ownerEmail: input.ownerEmail,
        },
      });
    },
    { timeout: 30_000 },
  );
}

/** Deletes every record in the workspace, in an order that respects the restrictive relations. */
export async function clearWorkspaceData(workspaceId: string, db: PrismaClient = prisma) {
  await db.$transaction([
    db.transaction.deleteMany({ where: { workspaceId } }),
    db.payment.deleteMany({ where: { invoice: { workspaceId } } }),
    db.invoice.deleteMany({ where: { workspaceId } }),
    db.event.deleteMany({ where: { workspaceId } }),
    db.note.deleteMany({ where: { workspaceId } }),
    db.contentItem.deleteMany({ where: { workspaceId } }),
    db.task.deleteMany({ where: { workspaceId } }),
    db.project.deleteMany({ where: { workspaceId } }),
    db.customer.deleteMany({ where: { workspaceId } }),
    db.tag.deleteMany({ where: { workspaceId } }),
  ]);
}

export async function deleteWorkspace(workspaceId: string, db: PrismaClient = prisma) {
  const count = await db.workspace.count();
  if (count <= 1) throw new AppError("You cannot delete your only workspace. Clear its data instead.");
  await clearWorkspaceData(workspaceId, db);
  await db.workspace.delete({ where: { id: workspaceId } });
}

export async function workspaceStats(workspaceId: string, db: PrismaClient = prisma) {
  const [tasks, projects, customers, transactions, invoices, events, content, notes] = await Promise.all([
    db.task.count({ where: { workspaceId } }),
    db.project.count({ where: { workspaceId } }),
    db.customer.count({ where: { workspaceId } }),
    db.transaction.count({ where: { workspaceId } }),
    db.invoice.count({ where: { workspaceId } }),
    db.event.count({ where: { workspaceId } }),
    db.contentItem.count({ where: { workspaceId } }),
    db.note.count({ where: { workspaceId } }),
  ]);
  return { tasks, projects, customers, transactions, invoices, events, content, notes };
}
