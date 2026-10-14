import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import type { NoteInput } from "@/lib/validation";
import { NotFoundError } from "./errors";
import { assertLinks, textWhere, pruneOrphanTags, tagsPayload, type Db, type TextSpec } from "./shared";

export const noteInclude = {
  tags: { select: { id: true, name: true }, orderBy: { name: "asc" } },
  task: { select: { id: true, title: true } },
  project: { select: { id: true, name: true } },
  customer: { select: { id: true, name: true } },
} satisfies Prisma.NoteInclude;

export type NoteWithRelations = Prisma.NoteGetPayload<{ include: typeof noteInclude }>;

export const NOTE_TEXT: TextSpec = { table: "Note", columns: ["title", "content"], tags: true };

export type NoteFilters = { q?: string; tag?: string; view?: "active" | "archived" | "pinned" | "" };

export async function listNotes(workspaceId: string, filters: NoteFilters = {}, db: Db = prisma) {
  const where: Prisma.NoteWhereInput = { workspaceId, archived: filters.view === "archived" };
  if (filters.view === "pinned") where.pinned = true;
  const text = await textWhere(db, workspaceId, filters.q, NOTE_TEXT);
  if (text) where.AND = [text as Prisma.NoteWhereInput];
  if (filters.tag) where.tags = { some: { name: filters.tag } };
  return db.note.findMany({
    where,
    include: noteInclude,
    orderBy: [{ pinned: "desc" }, { updatedAt: "desc" }],
    take: 300,
  });
}

export async function getNote(workspaceId: string, id: string, db: Db = prisma) {
  const note = await db.note.findFirst({ where: { id, workspaceId }, include: noteInclude });
  if (!note) throw new NotFoundError("Note");
  return note;
}

export async function createNote(workspaceId: string, input: NoteInput, db: Db = prisma) {
  await assertLinks(workspaceId, input, db);
  return db.note.create({
    data: {
      workspaceId,
      title: input.title,
      content: input.content,
      pinned: input.pinned,
      taskId: input.taskId,
      projectId: input.projectId,
      customerId: input.customerId,
      tags: tagsPayload(workspaceId, input.tags, "create"),
    },
    include: noteInclude,
  });
}

export async function updateNote(workspaceId: string, id: string, input: NoteInput, db: Db = prisma) {
  const exists = await db.note.count({ where: { id, workspaceId } });
  if (!exists) throw new NotFoundError("Note");
  await assertLinks(workspaceId, input, db);
  const note = await db.note.update({
    where: { id },
    data: {
      title: input.title,
      content: input.content,
      pinned: input.pinned,
      taskId: input.taskId,
      projectId: input.projectId,
      customerId: input.customerId,
      tags: tagsPayload(workspaceId, input.tags, "update"),
    },
    include: noteInclude,
  });
  await pruneOrphanTags(workspaceId, db);
  return note;
}

export async function setNoteFlags(workspaceId: string, id: string, flags: { pinned?: boolean; archived?: boolean }, db: Db = prisma) {
  const { count } = await db.note.updateMany({ where: { id, workspaceId }, data: flags });
  if (!count) throw new NotFoundError("Note");
}

export async function deleteNote(workspaceId: string, id: string, db: Db = prisma) {
  const { count } = await db.note.deleteMany({ where: { id, workspaceId } });
  if (!count) throw new NotFoundError("Note");
  await pruneOrphanTags(workspaceId, db);
}

export async function noteTags(workspaceId: string, db: Db = prisma) {
  return db.tag.findMany({ where: { workspaceId, notes: { some: { archived: false } } }, orderBy: { name: "asc" }, select: { name: true } });
}
