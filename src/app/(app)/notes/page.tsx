import { getContext } from "@/server/workspace";
import { listNotes, getNote, noteTags } from "@/lib/services/notes";
import { NotFoundError } from "@/lib/services/errors";
import { str, type SearchParams } from "@/server/load";
import { PageHeader } from "@/components/ui/misc";
import { NotesView } from "@/components/notes/notes-view";

export const metadata = { title: "Notes" };

export default async function NotesPage({ searchParams }: { searchParams: SearchParams }) {
  const sp = await searchParams;
  const { workspaceId } = await getContext();
  const view = (["pinned", "archived"] as const).find((v) => v === str(sp.view)) ?? "active";
  const selectedId = str(sp.note);
  const [notes, selected, tags] = await Promise.all([
    listNotes(workspaceId, { q: str(sp.q), tag: str(sp.tag), view }),
    selectedId
      ? getNote(workspaceId, selectedId).catch((e) => {
          if (e instanceof NotFoundError) return null;
          throw e;
        })
      : Promise.resolve(null),
    noteTags(workspaceId),
  ]);
  return (
    <>
      <PageHeader title="Notes" description="Your knowledge base — processes, meeting notes and ideas. Changes save automatically." />
      <NotesView notes={notes} selected={selected} tags={tags.map((t) => t.name)} view={view} />
    </>
  );
}
