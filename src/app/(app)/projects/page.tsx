import { getContext } from "@/server/workspace";
import { listProjects } from "@/lib/services/projects";
import { str, type SearchParams } from "@/server/load";
import { PageHeader } from "@/components/ui/misc";
import { NewButton } from "@/components/shared/new-button";
import { ProjectsView } from "@/components/projects/projects-view";
import { deadlineState } from "@/components/projects/project-bits";

export const metadata = { title: "Projects" };

export default async function ProjectsPage({ searchParams }: { searchParams: SearchParams }) {
  const sp = await searchParams;
  const { workspaceId, today } = await getContext();
  const projects = await listProjects(workspaceId, {
    q: str(sp.q),
    status: str(sp.status),
    priority: str(sp.priority),
    customerId: str(sp.customerId),
    sort: str(sp.sort),
  });
  const overdue = projects.filter((p) => deadlineState(p.status, p.dueDate, today)?.tone === "overdue").length;
  const soon = projects.filter((p) => deadlineState(p.status, p.dueDate, today)?.tone === "soon").length;
  return (
    <>
      <PageHeader
        title="Projects"
        description={`${projects.length} project${projects.length === 1 ? "" : "s"}${overdue ? ` · ${overdue} overdue` : ""}${soon ? ` · ${soon} due within 7 days` : ""}`}
        actions={<NewButton kind="project" label="New project" />}
      />
      <ProjectsView projects={projects} view={str(sp.view) === "table" ? "table" : "cards"} />
    </>
  );
}
