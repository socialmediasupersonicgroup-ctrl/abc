"use server";

import { noteSchema, type NoteFormValues } from "@/lib/validation";
import * as notes from "@/lib/services/notes";
import { getContext } from "@/server/workspace";
import { assertId, parseInput, runAction } from "@/server/action-utils";

export async function createNoteAction(values: NoteFormValues) {
  return runAction(async () => {
    const { workspaceId } = await getContext();
    const n = await notes.createNote(workspaceId, parseInput(noteSchema, values));
    return { id: n.id, updatedAt: n.updatedAt.toISOString() };
  });
}

export async function updateNoteAction(id: string, values: NoteFormValues) {
  return runAction(async () => {
    const { workspaceId } = await getContext();
    const n = await notes.updateNote(workspaceId, assertId(id), parseInput(noteSchema, values));
    return { id: n.id, updatedAt: n.updatedAt.toISOString() };
  });
}

export async function setNoteFlagsAction(id: string, flags: { pinned?: boolean; archived?: boolean }) {
  return runAction(async () => {
    const { workspaceId } = await getContext();
    const clean: { pinned?: boolean; archived?: boolean } = {};
    if (typeof flags.pinned === "boolean") clean.pinned = flags.pinned;
    if (typeof flags.archived === "boolean") clean.archived = flags.archived;
    await notes.setNoteFlags(workspaceId, assertId(id), clean);
  });
}

export async function deleteNoteAction(id: string) {
  return runAction(async () => {
    const { workspaceId } = await getContext();
    await notes.deleteNote(workspaceId, assertId(id));
  }, "Note deleted");
}
