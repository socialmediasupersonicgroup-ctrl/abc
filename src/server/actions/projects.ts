"use server";

import { z } from "zod";
import { projectSchema, type ProjectFormValues } from "@/lib/validation";
import * as projects from "@/lib/services/projects";
import { getContext } from "@/server/workspace";
import { assertId, parseInput, runAction } from "@/server/action-utils";

const initialTasksSchema = z.array(z.string().trim().min(1).max(200)).max(50, "Add at most 50 tasks at once");

export async function createProjectAction(values: ProjectFormValues, initialTasks: string[] = []) {
  return runAction(async () => {
    const { workspaceId } = await getContext();
    const titles = parseInput(initialTasksSchema, initialTasks.map((t) => t.trim()).filter(Boolean));
    const p = await projects.createProjectWithTasks(workspaceId, parseInput(projectSchema, values), titles);
    return { id: p.id };
  }, "Project created");
}

export async function updateProjectAction(id: string, values: ProjectFormValues) {
  return runAction(async () => {
    const { workspaceId } = await getContext();
    await projects.updateProject(workspaceId, assertId(id), parseInput(projectSchema, values));
    return { id };
  }, "Project updated");
}

export async function deleteProjectAction(id: string) {
  return runAction(async () => {
    const { workspaceId } = await getContext();
    await projects.deleteProject(workspaceId, assertId(id));
  }, "Project deleted");
}
