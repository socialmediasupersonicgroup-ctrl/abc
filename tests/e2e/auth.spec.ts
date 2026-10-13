import { expect, test } from "@playwright/test";
import { E2E_PASSWORD } from "../../playwright.config";

test("pages and actions are locked until the owner signs in", async ({ page, request }) => {
  // Health check stays public for the hosting platform.
  expect((await request.get("/api/health")).status()).toBe(200);
  // Server actions without a session are refused.
  expect((await request.post("/", { headers: { "Next-Action": "x" }, data: "" })).status()).toBe(401);

  await page.goto("/finance?type=INCOME");
  await expect(page).toHaveURL(/\/login\?next=%2Ffinance%3Ftype%3DINCOME$/);
  await page.waitForLoadState("networkidle");

  await page.getByLabel("Password").fill("wrong-password");
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page.getByText("Incorrect password.")).toBeVisible();

  await page.getByLabel("Password").fill(E2E_PASSWORD);
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page).toHaveURL(/\/finance\?type=INCOME$/);
  await expect(page.getByRole("heading", { name: "Finance" })).toBeVisible();

  const cookie = (await page.context().cookies()).find((c) => c.name === "nexus_session");
  expect(cookie?.httpOnly).toBe(true);

  await page.getByRole("button", { name: "Account menu" }).click();
  await page.getByRole("menuitem", { name: "Sign out" }).click();
  await expect(page).toHaveURL(/\/login/);
  await page.goto("/");
  await expect(page).toHaveURL(/\/login/);
});

test("a forged session cookie is rejected", async ({ page, context }) => {
  await context.addCookies([{ name: "nexus_session", value: "9999999999999.forged", url: "http://localhost:3101" }]);
  await page.goto("/");
  await expect(page).toHaveURL(/\/login/);
});
