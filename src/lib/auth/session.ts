/**
 * Password-gate sessions. Works in both the Edge (middleware) and Node runtimes via Web Crypto.
 *
 * Auth is enabled when NEXUS_PASSWORD is set. A session is a signed token "<expiresAtMs>.<hmac>"
 * stored in an httpOnly cookie. The HMAC key derives from SESSION_SECRET (or the password itself),
 * so changing the password signs everyone out.
 */

export const SESSION_COOKIE = "nexus_session";
export const SESSION_TTL_MS = 30 * 24 * 60 * 60 * 1000;

export function authEnabled(): boolean {
  return !!process.env.NEXUS_PASSWORD;
}

const encoder = new TextEncoder();

function toBase64Url(bytes: ArrayBuffer): string {
  let bin = "";
  for (const b of new Uint8Array(bytes)) bin += String.fromCharCode(b);
  return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

async function hmacKey(secret: string) {
  return crypto.subtle.importKey("raw", encoder.encode(`nexus-session-v1:${secret}`), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
}

function signingSecret(): string {
  return process.env.SESSION_SECRET || process.env.NEXUS_PASSWORD || "";
}

async function sign(payload: string, secret: string) {
  return toBase64Url(await crypto.subtle.sign("HMAC", await hmacKey(secret), encoder.encode(payload)));
}

/** Constant-time string comparison (both values are fixed-length digests here). */
export function safeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

export async function createSessionToken(now = Date.now(), secret = signingSecret()): Promise<string> {
  const exp = String(now + SESSION_TTL_MS);
  return `${exp}.${await sign(exp, secret)}`;
}

export async function verifySessionToken(token: string | undefined | null, now = Date.now(), secret = signingSecret()): Promise<boolean> {
  if (!token || !secret) return false;
  const dot = token.indexOf(".");
  if (dot <= 0) return false;
  const exp = token.slice(0, dot);
  const sig = token.slice(dot + 1);
  if (!/^\d{10,16}$/.test(exp) || Number(exp) <= now) return false;
  return safeEqual(sig, await sign(exp, secret));
}

/** Compares a submitted password with NEXUS_PASSWORD by hashing both, so timing does not depend on content or length. */
export async function passwordMatches(input: string, expected = process.env.NEXUS_PASSWORD ?? ""): Promise<boolean> {
  if (!expected) return false;
  const [a, b] = await Promise.all([crypto.subtle.digest("SHA-256", encoder.encode(input)), crypto.subtle.digest("SHA-256", encoder.encode(expected))]);
  return safeEqual(toBase64Url(a), toBase64Url(b));
}

/** Only allow redirects to same-origin paths after sign-in. */
export function safeNextPath(next: string | null | undefined): string {
  if (!next || !next.startsWith("/") || next.startsWith("//") || next.startsWith("/\\") || next.startsWith("/login")) return "/";
  return next;
}
