import "server-only";
import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import { authEnabled, createSessionToken, SESSION_COOKIE, SESSION_TTL_MS, verifySessionToken } from "@/lib/auth/session";

/** Defence in depth: every page and server action resolves the workspace through this check, not only middleware. */
export async function requireAuth() {
  if (!authEnabled()) return;
  const store = await cookies();
  if (!(await verifySessionToken(store.get(SESSION_COOKIE)?.value))) redirect("/login");
}

export async function isSignedIn() {
  if (!authEnabled()) return true;
  const store = await cookies();
  return verifySessionToken(store.get(SESSION_COOKIE)?.value);
}

async function isHttps() {
  const h = await headers();
  return h.get("x-forwarded-proto")?.split(",")[0].trim() === "https";
}

export async function startSession() {
  const store = await cookies();
  store.set(SESSION_COOKIE, await createSessionToken(), {
    httpOnly: true,
    sameSite: "lax",
    secure: await isHttps(),
    path: "/",
    maxAge: Math.floor(SESSION_TTL_MS / 1000),
  });
}

export async function endSession() {
  const store = await cookies();
  store.delete(SESSION_COOKIE);
}
