import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import type { ContentStatus } from "@/lib/constants";
import { zonedInputToDate } from "@/lib/dates";
import type { ContentInput } from "@/lib/validation";
import { NotFoundError } from "./errors";
import { containsText, type Db } from "./shared";

export type ContentFilters = { q?: string; status?: string; platform?: string; campaign?: string };

export async function listContent(workspaceId: string, filters: ContentFilters = {}, db: Db = prisma) {
  const where: Prisma.ContentItemWhereInput = { workspaceId };
  const q = containsText(filters.q);
  if (q) where.OR = [{ title: q }, { caption: q }, { hashtags: q }, { campaign: q }];
  if (filters.status) where.status = filters.status;
  if (filters.platform) where.platform = filters.platform;
  if (filters.campaign) where.campaign = filters.campaign;
  return db.contentItem.findMany({
    where,
    orderBy: [{ scheduledAt: { sort: "asc", nulls: "last" } }, { createdAt: "desc" }],
    take: 500,
  });
}

function data(input: ContentInput, tz: string) {
  return {
    title: input.title,
    platform: input.platform,
    format: input.format,
    campaign: input.campaign,
    scheduledAt: input.scheduledAt ? zonedInputToDate(input.scheduledAt, tz) : null,
    status: input.status,
    caption: input.caption,
    hashtags: input.hashtags,
    notes: input.notes,
  };
}

export async function createContent(workspaceId: string, tz: string, input: ContentInput, db: Db = prisma) {
  return db.contentItem.create({ data: { workspaceId, ...data(input, tz) } });
}

export async function updateContent(workspaceId: string, tz: string, id: string, input: ContentInput, db: Db = prisma) {
  const exists = await db.contentItem.count({ where: { id, workspaceId } });
  if (!exists) throw new NotFoundError("Content item");
  return db.contentItem.update({ where: { id }, data: data(input, tz) });
}

export async function setContentStatus(workspaceId: string, id: string, status: ContentStatus, db: Db = prisma) {
  const { count } = await db.contentItem.updateMany({ where: { id, workspaceId }, data: { status } });
  if (!count) throw new NotFoundError("Content item");
}

export async function deleteContent(workspaceId: string, id: string, db: Db = prisma) {
  const { count } = await db.contentItem.deleteMany({ where: { id, workspaceId } });
  if (!count) throw new NotFoundError("Content item");
}

export async function contentCampaigns(workspaceId: string, db: Db = prisma) {
  const rows = await db.contentItem.findMany({
    where: { workspaceId, campaign: { not: null } },
    distinct: ["campaign"],
    select: { campaign: true },
  });
  return rows.map((r) => r.campaign!).filter(Boolean).sort();
}
