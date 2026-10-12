import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { PRIORITY_RANK, type Priority, type TaskStatus } from "@/lib/constants";
import { addDaysToKey, keyToDate } from "@/lib/dates";
import type { TaskInput } from "@/lib/validation";
import { NotFoundError } from "./errors";
import { assertLinks, containsText, pruneOrphanTags, tagsPayload, toDate, type Db } from "./shared";

export const taskInclude = {
  project: { select: { id: true, name: true } },
  customer: { select: { id: true, name: true } },
  tags: { select: { id: true, name: true }, orderBy: { name: "asc" } },
} satisfies Prisma.TaskInclude;

export type TaskWithRelations = Prisma.TaskGetPayload<{ include: typeof taskInclude }>;

export type TaskFilters = {
  q?: string;
  status?: string;
  priority?: string;
  projectId?: string;
  customerId?: string;
  tag?: string;
  due?: "overdue" | "today" | "week" | "none" | "";
  sort?: "due" | "priority" | "updated" | "created" | "title" | "";
  includeDone?: boolean;
};

export async function listTasks(workspaceId: string, filters: TaskFilters = {}, today?: string, db: Db = prisma) {
  const where: Prisma.TaskWhereInput = { workspaceId };
  const q = containsText(filters.q);
  if (q) where.OR = [{ title: q }, { description: q }, { assignee: q }, { tags: { some: { name: q } } }];
  if (filters.status) where.status = filters.status;
  else if (filters.includeDone === false) where.status = { not: "DONE" };
  if (filters.priority) where.priority = filters.priority;
  if (filters.projectId) where.projectId = filters.projectId;
  if (filters.customerId) where.customerId = filters.customerId;
  if (filters.tag) where.tags = { some: { name: filters.tag } };
  if (filters.due && today) {
    if (filters.due === "none") where.dueDate = null;
    else {
      where.status = filters.status ? filters.status : { not: "DONE" };
      if (filters.due === "overdue") where.dueDate = { lt: keyToDate(today) };
      if (filters.due === "today") where.dueDate = keyToDate(today);
      if (filters.due === "week") where.dueDate = { gte: keyToDate(today), lte: keyToDate(addDaysToKey(today, 7)) };
    }
  }

  const orderBy: Prisma.TaskOrderByWithRelationInput[] =
    filters.sort === "updated"
      ? [{ updatedAt: "desc" }]
      : filters.sort === "created"
        ? [{ createdAt: "desc" }]
        : filters.sort === "title"
          ? [{ title: "asc" }]
          : [{ dueDate: { sort: "asc", nulls: "last" } }, { createdAt: "desc" }];

  const tasks = await db.task.findMany({ where, include: taskInclude, orderBy, take: 500 });
  if (filters.sort === "priority") {
    tasks.sort((a, b) => PRIORITY_RANK[a.priority as Priority] - PRIORITY_RANK[b.priority as Priority]);
  }
  if (!filters.sort || filters.sort === "due" || filters.sort === "priority") {
    // Open work first; completed tasks sink to the bottom (Array.prototype.sort is stable).
    tasks.sort((a, b) => Number(a.status === "DONE") - Number(b.status === "DONE"));
  }
  return tasks;
}

export async function getTask(workspaceId: string, id: string, db: Db = prisma) {
  const task = await db.task.findFirst({ where: { id, workspaceId }, include: taskInclude });
  if (!task) throw new NotFoundError("Task");
  return task;
}

function completedAtFor(status: string, previous?: { status: string; completedAt: Date | null }) {
  if (status !== "DONE") return null;
  if (previous?.status === "DONE" && previous.completedAt) return previous.completedAt;
  return new Date();
}

export async function createTask(workspaceId: string, input: TaskInput, db: Db = prisma) {
  await assertLinks(workspaceId, input, db);
  return db.task.create({
    data: {
      workspaceId,
      title: input.title,
      description: input.description,
      status: input.status,
      priority: input.priority,
      dueDate: toDate(input.dueDate),
      assignee: input.assignee,
      projectId: input.projectId,
      customerId: input.customerId,
      completedAt: completedAtFor(input.status),
      tags: tagsPayload(workspaceId, input.tags, "create"),
    },
    include: taskInclude,
  });
}

export async function updateTask(workspaceId: string, id: string, input: TaskInput, db: Db = prisma) {
  const existing = await db.task.findFirst({ where: { id, workspaceId }, select: { status: true, completedAt: true } });
  if (!existing) throw new NotFoundError("Task");
  await assertLinks(workspaceId, input, db);
  const task = await db.task.update({
    where: { id },
    data: {
      title: input.title,
      description: input.description,
      status: input.status,
      priority: input.priority,
      dueDate: toDate(input.dueDate),
      assignee: input.assignee,
      projectId: input.projectId,
      customerId: input.customerId,
      completedAt: completedAtFor(input.status, existing),
      tags: tagsPayload(workspaceId, input.tags, "update"),
    },
    include: taskInclude,
  });
  await pruneOrphanTags(workspaceId, db);
  return task;
}

export async function setTaskStatus(workspaceId: string, id: string, status: TaskStatus, db: Db = prisma) {
  const existing = await db.task.findFirst({ where: { id, workspaceId }, select: { status: true, completedAt: true } });
  if (!existing) throw new NotFoundError("Task");
  return db.task.update({ where: { id }, data: { status, completedAt: completedAtFor(status, existing) } });
}

export async function deleteTask(workspaceId: string, id: string, db: Db = prisma) {
  const { count } = await db.task.deleteMany({ where: { id, workspaceId } });
  if (!count) throw new NotFoundError("Task");
  await pruneOrphanTags(workspaceId, db);
}

export async function listTags(workspaceId: string, db: Db = prisma) {
  return db.tag.findMany({ where: { workspaceId }, orderBy: { name: "asc" }, select: { id: true, name: true } });
}
