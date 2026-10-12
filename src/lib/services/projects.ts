import type { Prisma, PrismaClient } from "@prisma/client";
import { prisma } from "@/lib/db";
import { projectProgress } from "@/lib/calc/progress";
import type { ProjectInput } from "@/lib/validation";
import { NotFoundError } from "./errors";
import { assertLinks, containsText, toDate, type Db } from "./shared";
import { taskInclude } from "./tasks";

export type ProjectFilters = { q?: string; status?: string; priority?: string; customerId?: string; sort?: string };

export async function listProjects(workspaceId: string, filters: ProjectFilters = {}, db: Db = prisma) {
  const where: Prisma.ProjectWhereInput = { workspaceId };
  const q = containsText(filters.q);
  if (q) where.OR = [{ name: q }, { description: q }, { customer: { name: q } }];
  if (filters.status === "OPEN") where.status = { in: ["PLANNING", "ACTIVE", "ON_HOLD"] };
  else if (filters.status) where.status = filters.status;
  if (filters.priority) where.priority = filters.priority;
  if (filters.customerId) where.customerId = filters.customerId;

  const orderBy: Prisma.ProjectOrderByWithRelationInput[] =
    filters.sort === "name"
      ? [{ name: "asc" }]
      : filters.sort === "updated"
        ? [{ updatedAt: "desc" }]
        : filters.sort === "budget"
          ? [{ budget: "desc" }]
          : [{ dueDate: { sort: "asc", nulls: "last" } }, { createdAt: "desc" }];

  const projects = await db.project.findMany({
    where,
    orderBy,
    include: {
      customer: { select: { id: true, name: true } },
      tasks: { select: { status: true } },
    },
    take: 300,
  });
  return projects.map(({ tasks, ...p }) => ({ ...p, progress: projectProgress(p, tasks) }));
}
export type ProjectListItem = Awaited<ReturnType<typeof listProjects>>[number];

export async function getProject(workspaceId: string, id: string, db: Db = prisma) {
  const project = await db.project.findFirst({
    where: { id, workspaceId },
    include: {
      customer: { select: { id: true, name: true, company: true } },
      tasks: { include: taskInclude, orderBy: [{ status: "asc" }, { dueDate: { sort: "asc", nulls: "last" } }] },
      invoices: { orderBy: { issueDate: "desc" }, include: { customer: { select: { name: true } } } },
      transactions: { orderBy: { date: "desc" }, take: 20 },
      events: { orderBy: { startAt: "asc" }, take: 20 },
      linkedNotes: { where: { archived: false }, orderBy: { updatedAt: "desc" }, select: { id: true, title: true, updatedAt: true } },
    },
  });
  if (!project) throw new NotFoundError("Project");
  return { ...project, progress: projectProgress(project, project.tasks) };
}
export type ProjectDetail = Awaited<ReturnType<typeof getProject>>;

function data(input: ProjectInput) {
  return {
    name: input.name,
    description: input.description,
    status: input.status,
    priority: input.priority,
    startDate: toDate(input.startDate),
    dueDate: toDate(input.dueDate),
    progressMode: input.progressMode,
    manualProgress: input.manualProgress,
    budget: input.budget,
    customerId: input.customerId,
    notes: input.notes,
  };
}

export async function createProject(workspaceId: string, input: ProjectInput, db: Db = prisma) {
  await assertLinks(workspaceId, { customerId: input.customerId }, db);
  return db.project.create({ data: { workspaceId, ...data(input) } });
}

/** Creates a project together with an initial list of tasks, atomically. */
export async function createProjectWithTasks(workspaceId: string, input: ProjectInput, taskTitles: string[], db: PrismaClient = prisma) {
  await assertLinks(workspaceId, { customerId: input.customerId }, db);
  return db.$transaction(async (tx) => {
    const project = await tx.project.create({ data: { workspaceId, ...data(input) } });
    for (const title of taskTitles) {
      await tx.task.create({ data: { workspaceId, title, projectId: project.id, customerId: input.customerId, status: "TODO", priority: "MEDIUM" } });
    }
    return project;
  });
}

export async function updateProject(workspaceId: string, id: string, input: ProjectInput, db: Db = prisma) {
  const exists = await db.project.count({ where: { id, workspaceId } });
  if (!exists) throw new NotFoundError("Project");
  await assertLinks(workspaceId, { customerId: input.customerId }, db);
  return db.project.update({ where: { id }, data: data(input) });
}

/** Deletes the project. Linked tasks, invoices, transactions, events and notes are kept and simply unlinked. */
export async function deleteProject(workspaceId: string, id: string, db: Db = prisma) {
  const { count } = await db.project.deleteMany({ where: { id, workspaceId } });
  if (!count) throw new NotFoundError("Project");
}

export async function projectOptions(workspaceId: string, db: Db = prisma) {
  return db.project.findMany({
    where: { workspaceId },
    select: { id: true, name: true, status: true, customerId: true },
    orderBy: { name: "asc" },
  });
}
