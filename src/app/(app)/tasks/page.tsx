import { getContext } from "@/server/workspace";
import { listTags, listTasks, getTask, type TaskFilters } from "@/lib/services/tasks";
import { str, type SearchParams } from "@/server/load";
import { PageHeader } from "@/components/ui/misc";
import { TasksView } from "@/components/tasks/tasks-view";
import { NewButton } from "@/components/shared/new-button";
import { NotFoundError } from "@/lib/services/errors";

export const metadata = { title: "Tasks" };

export default async function TasksPage({ searchParams }: { searchParams: SearchParams }) {
  const sp = await searchParams;
  const { workspaceId, today } = await getContext();
  const filters: TaskFilters = {
    q: str(sp.q),
    status: str(sp.status),
    priority: str(sp.priority),
    projectId: str(sp.projectId),
    customerId: str(sp.customerId),
    tag: str(sp.tag),
    due: str(sp.due) as TaskFilters["due"],
    sort: str(sp.sort) as TaskFilters["sort"],
  };
  const selectedId = str(sp.task);
  const [tasks, tags, selected] = await Promise.all([
    listTasks(workspaceId, filters, today),
    listTags(workspaceId),
    selectedId
      ? getTask(workspaceId, selectedId).catch((e) => {
          if (e instanceof NotFoundError) return null;
          throw e;
        })
      : Promise.resolve(null),
  ]);
  const open = tasks.filter((t) => t.status !== "DONE").length;

  return (
    <>
      <PageHeader
        title="Tasks"
        description={`${open} open · ${tasks.length - open} completed${filters.q || filters.status || filters.priority || filters.projectId || filters.due || filters.tag ? " (filtered)" : ""}`}
        actions={<NewButton kind="task" label="New task" />}
      />
      <TasksView tasks={tasks} tags={tags.map((t) => t.name)} selected={selected} view={str(sp.view) === "board" ? "board" : "list"} />
    </>
  );
}
