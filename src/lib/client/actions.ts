"use client";

import { toast } from "sonner";
import type { FieldValues, Path, UseFormSetError } from "react-hook-form";
import type { ActionResult } from "@/server/action-utils";

/**
 * Awaits a server action, reports the outcome with a toast and maps field errors onto a form.
 * Returns the action's data on success, or null on failure.
 */
export async function runClientAction<T, F extends FieldValues = FieldValues>(
  promise: Promise<ActionResult<T>>,
  opts: { success?: string | false; setError?: UseFormSetError<F> } = {},
): Promise<{ data: T | undefined } | null> {
  let result: ActionResult<T>;
  try {
    result = await promise;
  } catch {
    toast.error("Could not reach the server. Check that NEXUS is running and try again.");
    return null;
  }
  if (!result.ok) {
    if (opts.setError && result.fieldErrors) {
      for (const [key, message] of Object.entries(result.fieldErrors)) {
        opts.setError(key as Path<F>, { type: "server", message });
      }
    }
    toast.error(result.error);
    return null;
  }
  if (opts.success !== false) {
    const msg = opts.success ?? result.message;
    if (msg) toast.success(msg);
  }
  return { data: result.data };
}
