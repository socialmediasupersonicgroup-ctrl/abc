import { describe, expect, it } from "vitest";
import { createSessionToken, passwordMatches, safeNextPath, SESSION_TTL_MS, verifySessionToken } from "@/lib/auth/session";

const SECRET = "correct horse battery staple";

describe("session tokens", () => {
  it("verifies a freshly signed token", async () => {
    const now = 1_800_000_000_000;
    const token = await createSessionToken(now, SECRET);
    expect(await verifySessionToken(token, now + 1000, SECRET)).toBe(true);
  });
  it("rejects expired, tampered, foreign and malformed tokens", async () => {
    const now = 1_800_000_000_000;
    const token = await createSessionToken(now, SECRET);
    expect(await verifySessionToken(token, now + SESSION_TTL_MS + 1, SECRET)).toBe(false);
    const [exp, sig] = token.split(".");
    expect(await verifySessionToken(`${Number(exp) + 1000}.${sig}`, now, SECRET)).toBe(false);
    expect(await verifySessionToken(token, now, "another secret")).toBe(false);
    expect(await verifySessionToken("garbage", now, SECRET)).toBe(false);
    expect(await verifySessionToken("", now, SECRET)).toBe(false);
    expect(await verifySessionToken(undefined, now, SECRET)).toBe(false);
    expect(await verifySessionToken(token, now, "")).toBe(false);
  });
});

describe("password check", () => {
  it("matches only the exact password", async () => {
    expect(await passwordMatches("Test-Pass-123", "Test-Pass-123")).toBe(true);
    expect(await passwordMatches("test-pass-123", "Test-Pass-123")).toBe(false);
    expect(await passwordMatches("", "Test-Pass-123")).toBe(false);
    expect(await passwordMatches("anything", "")).toBe(false);
  });
});

describe("post-login redirect", () => {
  it("only allows same-origin paths", () => {
    expect(safeNextPath("/tasks?view=board")).toBe("/tasks?view=board");
    expect(safeNextPath("https://evil.example")).toBe("/");
    expect(safeNextPath("//evil.example")).toBe("/");
    expect(safeNextPath("/\\evil.example")).toBe("/");
    expect(safeNextPath("/login")).toBe("/");
    expect(safeNextPath(undefined)).toBe("/");
  });
});
