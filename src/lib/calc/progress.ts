export type ProgressSource = "tasks" | "manual" | "none";

export function taskCompletion(tasks: { status: string }[]) {
  const total = tasks.length;
  const done = tasks.filter((t) => t.status === "DONE").length;
  return { total, done, percent: total ? Math.round((done / total) * 100) : 0 };
}

/**
 * AUTO projects derive progress from linked task completion; MANUAL projects use the stored value.
 * An AUTO project with no tasks reports source "none" so the UI can say so instead of showing a fake 0%.
 */
export function projectProgress(
  project: { progressMode: string; manualProgress: number; status?: string },
  tasks: { status: string }[],
): { value: number; source: ProgressSource; done: number; total: number } {
  const { total, done, percent } = taskCompletion(tasks);
  if (project.progressMode === "MANUAL") {
    return { value: clamp(project.manualProgress), source: "manual", done, total };
  }
  if (total === 0) return { value: project.status === "COMPLETED" ? 100 : 0, source: "none", done, total };
  return { value: percent, source: "tasks", done, total };
}

function clamp(v: number) {
  return Math.max(0, Math.min(100, Math.round(v)));
}

export function isTaskOverdue(task: { status: string; dueDate: Date | null }, today: string) {
  return task.status !== "DONE" && !!task.dueDate && task.dueDate.toISOString().slice(0, 10) < today;
}
