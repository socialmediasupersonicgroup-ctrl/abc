"use server";

import { z } from "zod";
import { TASK_STATUS } from "@/lib/constants";
import { taskSchema, type TaskFormValues } from "@/lib/validation";
import * as tasks from "@/lib/services/tasks";
import { getContext } from "@/server/workspace";
import { assertId, parseInput, runAction } from "@/server/action-utils";

export async function createTaskAction(values: TaskFormValues) {
  return runAction(async () => {
    const { workspaceId } = await getContext();
    const task = await tasks.createTask(workspaceId, parseInput(taskSchema, values));
    return { id: task.id };
  }, "Task created");
}

export async function updateTaskAction(id: string, values: TaskFormValues) {
  return runAction(async () => {
    const { workspaceId } = await getContext();
    await tasks.updateTask(workspaceId, assertId(id), parseInput(taskSchema, values));
    return { id };
  }, "Task updated");
}

export async function setTaskStatusAction(id: string, status: string) {
  return runAction(async () => {
    const { workspaceId } = await getContext();
    await tasks.setTaskStatus(workspaceId, assertId(id), parseInput(z.enum(TASK_STATUS.values), status));
  }, "Status updated");
}

export async function deleteTaskAction(id: string) {
  return runAction(async () => {
    const { workspaceId } = await getContext();
    await tasks.deleteTask(workspaceId, assertId(id));
  }, "Task deleted");
}
