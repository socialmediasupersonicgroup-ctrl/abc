import "server-only";
import { revalidatePath } from "next/cache";
import type { ZodType, ZodTypeDef } from "zod";
import { AppError } from "@/lib/services/errors";
import { requireAuth } from "@/server/auth";

export type ActionResult<T = undefined> =
  | { ok: true; data?: T; message?: string }
  | { ok: false; error: string; fieldErrors?: Record<string, string> };

export function parseInput<Out, In>(schema: ZodType<Out, ZodTypeDef, In>, input: unknown): Out {
  const result = schema.safeParse(input);
  if (!result.success) {
    const fieldErrors: Record<string, string> = {};
    for (const issue of result.error.issues) {
      const key = issue.path.join(".");
      if (key && !fieldErrors[key]) fieldErrors[key] = issue.message;
    }
    const first = result.error.issues[0]?.message ?? "Invalid input";
    throw new AppError(`Please fix the highlighted fields. ${first}`.trim(), fieldErrors);
  }
  return result.data;
}

export function assertId(id: unknown): string {
  if (typeof id !== "string" || !/^[a-z0-9]{10,40}$/i.test(id)) throw new AppError("Invalid record reference.");
  return id;
}

/** Runs a mutation, converts known errors into user-facing results and refreshes cached pages. */
export async function runAction<T>(fn: () => Promise<T>, message?: string): Promise<ActionResult<T>> {
  // Outside the try block: an unauthenticated call redirects to sign-in instead of being reported as an error.
  await requireAuth();
  try {
    const data = await fn();
    revalidatePath("/", "layout");
    return { ok: true, data, message };
  } catch (err) {
    if (err instanceof AppError) return { ok: false, error: err.message, fieldErrors: err.fieldErrors };
    console.error("[nexus] action failed", err);
    return { ok: false, error: "Something went wrong while saving. Please try again." };
  }
}
