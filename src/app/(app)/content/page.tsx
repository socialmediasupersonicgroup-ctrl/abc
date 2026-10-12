import { prisma } from "@/lib/db";
import { getContext } from "@/server/workspace";
import { contentCampaigns, listContent } from "@/lib/services/content";
import { str, type SearchParams } from "@/server/load";
import { PageHeader } from "@/components/ui/misc";
import { NewButton } from "@/components/shared/new-button";
import { ContentView } from "@/components/content/content-view";

export const metadata = { title: "Content Planner" };

export default async function ContentPage({ searchParams }: { searchParams: SearchParams }) {
  const sp = await searchParams;
  const { workspaceId } = await getContext();
  const selectedId = str(sp.item);
  const [items, campaigns, selected] = await Promise.all([
    listContent(workspaceId, { q: str(sp.q), status: str(sp.status), platform: str(sp.platform), campaign: str(sp.campaign) }),
    contentCampaigns(workspaceId),
    selectedId ? prisma.contentItem.findFirst({ where: { id: selectedId, workspaceId } }) : Promise.resolve(null),
  ]);
  const view = (["list", "calendar"] as const).find((v) => v === str(sp.view)) ?? "board";
  const published = items.filter((i) => i.status === "PUBLISHED").length;
  return (
    <>
      <PageHeader
        title="Content Planner"
        description={`${items.length} item${items.length === 1 ? "" : "s"} · ${published} published. Planning only — NEXUS doesn't post to social platforms.`}
        actions={<NewButton kind="content" label="New content" />}
      />
      <ContentView items={items} campaigns={campaigns} selected={selected} view={view} />
    </>
  );
}
