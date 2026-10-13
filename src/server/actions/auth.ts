"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { authEnabled, passwordMatches, safeNextPath } from "@/lib/auth/session";
import { endSession, startSession } from "@/server/auth";

// Simple in-memory brute-force protection: 5 failed attempts per client per 15 minutes.
const WINDOW_MS = 15 * 60 * 1000;
const MAX_FAILURES = 5;
const failures = new Map<string, { count: number; resetAt: number }>();

async function clientKey() {
  const h = await headers();
  return h.get("x-forwarded-for")?.split(",")[0].trim() || h.get("x-real-ip") || "local";
}

export type LoginState = { error?: string };

export async function loginAction(_prev: LoginState, formData: FormData): Promise<LoginState> {
  if (!authEnabled()) redirect("/");
  const key = await clientKey();
  const now = Date.now();
  const entry = failures.get(key);
  if (entry && entry.resetAt > now && entry.count >= MAX_FAILURES) {
    return { error: "Too many attempts. Try again in a few minutes." };
  }

  const password = formData.get("password");
  if (typeof password !== "string" || password.length === 0 || password.length > 256 || !(await passwordMatches(password))) {
    const current = entry && entry.resetAt > now ? entry : { count: 0, resetAt: now + WINDOW_MS };
    current.count++;
    failures.set(key, current);
    await new Promise((r) => setTimeout(r, 400));
    return { error: "Incorrect password." };
  }

  failures.delete(key);
  await startSession();
  const next = formData.get("next");
  redirect(safeNextPath(typeof next === "string" ? next : "/"));
}

export async function logoutAction() {
  await endSession();
  redirect(authEnabled() ? "/login" : "/");
}
