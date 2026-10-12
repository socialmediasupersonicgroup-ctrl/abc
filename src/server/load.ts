import "server-only";
import { notFound } from "next/navigation";
import { NotFoundError } from "@/lib/services/errors";

/** Converts a service NotFoundError into Next's 404 page. */
export async function orNotFound<T>(promise: Promise<T>): Promise<T> {
  try {
    return await promise;
  } catch (err) {
    if (err instanceof NotFoundError) notFound();
    throw err;
  }
}

export function str(value: string | string[] | undefined): string {
  return typeof value === "string" ? value : "";
}

export type SearchParams = Promise<Record<string, string | string[] | undefined>>;
