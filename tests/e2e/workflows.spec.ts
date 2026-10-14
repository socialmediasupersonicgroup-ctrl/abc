import { expect, test, type Page } from "@playwright/test";

/** Navigates and waits until the client has hydrated, so form input isn't reset by hydration. */
async function open(page: Page, path: string) {
  await page.goto(path);
  await page.waitForLoadState("networkidle");
}

test.describe.configure({ mode: "serial" });

async function quickCreate(page: Page, item: string) {
  await page.getByTestId("quick-create").click();
  await page.getByRole("menuitem", { name: item, exact: true }).click();
}

test("empty workspace shows onboarding instead of fake numbers", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByText("Getting started")).toBeVisible();
  await expect(page.getByText(/nothing here is estimated or invented/)).toBeVisible();
  await expect(page.getByTestId("metric-revenue")).toHaveCount(0);
});

test("customer can be created", async ({ page }) => {
  await open(page, "/customers");
  await quickCreate(page, "Customer");
  const dialog = page.getByRole("dialog");
  await dialog.getByLabel("Full name").fill("Asha Verma");
  await dialog.getByLabel("Company").fill("Verma Textiles");
  await dialog.getByLabel("Email").fill("not-an-email");
  await dialog.getByRole("button", { name: "Add customer" }).click();
  await expect(dialog.getByText("Enter a valid email address")).toBeVisible();
  await dialog.getByLabel("Email").fill("asha@verma.example");
  await dialog.getByLabel(/Potential deal value/).fill("250000");
  await dialog.getByRole("button", { name: "Add customer" }).click();
  await expect(page).toHaveURL(/\/customers\/[a-z0-9]+$/);
  await expect(page.getByRole("heading", { name: "Asha Verma" })).toBeVisible();
  await expect(page.getByText("₹2,50,000.00").first()).toBeVisible();
});

test("project is created with tasks and progress follows completion", async ({ page }) => {
  await open(page, "/projects");
  await page.getByRole("button", { name: "New project" }).first().click();
  const dialog = page.getByRole("dialog");
  await dialog.getByLabel("Project name").fill("Store redesign");
  await dialog.getByLabel("Customer").selectOption({ label: "Asha Verma" });
  await dialog.getByLabel("Initial tasks").fill("Wireframes\nVisual design\nBuild\nLaunch");
  await dialog.getByRole("button", { name: "Create project" }).click();
  await expect(page).toHaveURL(/\/projects\/[a-z0-9]+$/);
  await expect(page.getByRole("heading", { name: "Store redesign" })).toBeVisible();
  await expect(page.getByText("Calculated: 0 of 4 tasks completed")).toBeVisible();

  // Add a task inline without leaving the project.
  await page.getByLabel("New task title").fill("QA pass");
  await page.getByRole("button", { name: "Add", exact: true }).click();
  await expect(page.getByText("Calculated: 0 of 5 tasks completed")).toBeVisible();

  await page.getByRole("button", { name: "Complete “Wireframes”" }).click();
  await expect(page.getByText("Calculated: 1 of 5 tasks completed")).toBeVisible();
  await expect(page.getByText("20%").first()).toBeVisible();
});

test("task can be created, edited, completed, filtered and deleted", async ({ page }) => {
  await open(page, "/tasks");
  await page.getByRole("button", { name: "New task" }).first().click();
  let dialog = page.getByRole("dialog");
  await dialog.getByRole("button", { name: "Create task" }).click();
  await expect(dialog.getByText("Title is required")).toBeVisible();
  await dialog.getByLabel("Title").fill("Send GST documents");
  await dialog.getByLabel("Priority").selectOption("URGENT");
  await dialog.getByLabel("Due date").fill("2020-01-01");
  await dialog.getByLabel("Tags").fill("finance");
  await dialog.getByRole("button", { name: "Create task" }).click();
  await expect(dialog).toBeHidden();

  const row = page.getByTestId("task-row").filter({ hasText: "Send GST documents" });
  await expect(row).toBeVisible();
  await expect(row.getByText(/overdue/).filter({ visible: true })).toBeVisible();

  // Edit
  await row.getByRole("button", { name: /^Send GST documents/ }).click();
  dialog = page.getByRole("dialog");
  await dialog.getByLabel("Title").fill("Send GST documents to CA");
  await dialog.getByRole("button", { name: "Save changes" }).click();
  await expect(page.getByTestId("task-row").filter({ hasText: "Send GST documents to CA" })).toBeVisible();

  // Search & filter
  await page.getByLabel("Search tasks…").fill("GST");
  await expect(page).toHaveURL(/q=GST/);
  await expect(page.getByTestId("task-row")).toHaveCount(1);
  await page.getByLabel("Search tasks…").fill("");
  await page.getByLabel("Due", { exact: true }).selectOption("overdue");
  await expect(page.getByTestId("task-row")).toHaveCount(1);
  await page.getByRole("button", { name: "Clear" }).click();

  // Complete
  await page.getByRole("button", { name: "Mark “Send GST documents to CA” as done" }).click();
  await expect(page.getByRole("button", { name: "Mark “Send GST documents to CA” as not done" })).toBeVisible();

  // Board view status change persists
  await page.getByRole("radio", { name: "Board" }).click();
  await expect(page.getByRole("region", { name: "Completed" }).getByText("Send GST documents to CA")).toBeVisible();

  // Delete
  await page.getByRole("radio", { name: "List" }).click();
  await page.getByTestId("task-row").filter({ hasText: "Send GST documents to CA" }).getByRole("button", { name: /^Send GST documents to CA/ }).click();
  await page.getByRole("dialog").getByRole("button", { name: "Delete" }).click();
  await page.getByRole("dialog", { name: "Delete this task?" }).getByRole("button", { name: "Delete" }).click();
  await expect(page.getByTestId("task-row").filter({ hasText: "Send GST documents to CA" })).toHaveCount(0);
});

test("invoice totals, payments and financial summaries stay consistent", async ({ page }) => {
  await open(page, "/finance/invoices/new");
  await page.getByRole("combobox", { name: "Customer" }).selectOption({ label: "Asha Verma — Verma Textiles" });
  await page.getByLabel("Line 1 description").fill("Design sprint");
  await page.getByLabel("Line 1 quantity").fill("2");
  await page.getByLabel("Line 1 unit price").fill("25000");
  await page.getByRole("button", { name: "Add line" }).click();
  await page.getByLabel("Line 2 description").fill("Hosting setup");
  await page.getByLabel("Line 2 quantity").fill("1.5");
  await page.getByLabel("Line 2 unit price").fill("999.99");
  await page.getByLabel("Discount", { exact: true }).selectOption("PERCENT");
  await page.getByLabel("Discount %").fill("10");
  await page.getByRole("combobox", { name: "Status" }).selectOption("SENT");
  // 51,499.99 − 10% = 46,349.99; + 18% GST (8,343.00) = 54,692.99
  await expect(page.getByTestId("invoice-total-preview")).toHaveText("₹54,692.99");
  await page.getByRole("button", { name: "Create invoice" }).click();

  await expect(page).toHaveURL(/\/finance\/invoices\/(?!new)[a-z0-9]{20,}$/);
  await expect(page.getByTestId("invoice-total")).toHaveText("₹54,692.99");
  await expect(page.getByTestId("invoice-balance")).toHaveText("₹54,692.99");

  await page.getByTestId("record-payment").click();
  const dialog = page.getByRole("dialog");
  await dialog.getByLabel(/Amount/).fill("20000");
  await dialog.getByRole("button", { name: "Record payment" }).click();
  await expect(page.getByTestId("invoice-balance")).toHaveText("₹34,692.99");
  await expect(page.getByTestId("payment-row")).toHaveCount(1);

  // The payment shows up once in Finance as income.
  await page.goto("/finance");
  await expect(page.getByTestId("transaction-row").filter({ hasText: "Payment for INV-0001" })).toHaveCount(1);
  await expect(page.getByTestId("sum-income")).toHaveText("₹20,000.00");

  // Invoice summary
  await page.goto("/finance/invoices");
  await expect(page.getByTestId("inv-collected")).toHaveText("₹20,000.00");
  await expect(page.getByTestId("inv-outstanding")).toHaveText("₹34,692.99");
});

test("invoice preview follows line edits made last", async ({ page }) => {
  await open(page, "/finance/invoices/new");
  await page.getByLabel("Line 1 unit price").fill("1000");
  await expect(page.getByTestId("invoice-total-preview")).toHaveText("₹1,180.00");
  // Editing quantity after everything else must still update the totals.
  await page.getByLabel("Line 1 quantity").fill("3");
  await expect(page.getByTestId("invoice-total-preview")).toHaveText("₹3,540.00");
});

test("search box keeps text typed after a pause", async ({ page }) => {
  await open(page, "/customers");
  const box = page.getByLabel("Search name, company, email, phone…");
  await box.pressSequentially("Asha ");
  await expect(page).toHaveURL(/q=Asha/);
  await page.waitForTimeout(500);
  await box.pressSequentially("Verma");
  await expect(box).toHaveValue("Asha Verma");
  await expect(page).toHaveURL(/q=Asha\+Verma|q=Asha%20Verma/);
  await expect(page.getByTestId("customer-row")).toHaveCount(1);
});

test("analytics date inputs show the range in use and apply picked dates", async ({ page }) => {
  await open(page, "/analytics");
  const from = page.getByLabel("From", { exact: true });
  const to = page.getByLabel("To", { exact: true });
  await expect(from).not.toHaveValue("");
  await expect(to).not.toHaveValue("");
  // Choosing a complete date applies it without needing to blur the field.
  await from.fill("2026-01-01");
  await expect(page).toHaveURL(/from=2026-01-01/);
  await expect(page.getByText(/1 Jan 2026 –/)).toBeVisible();
});

test("filter and period changes always navigate (no dropped soft navigations)", async ({ page }) => {
  // Regression: a route-group loading.tsx made Next drop roughly half of same-page search-param navigations in production.
  for (let i = 0; i < 4; i++) {
    await open(page, "/");
    await page.getByLabel("Reporting period").selectOption(i % 2 ? "quarter" : "year");
    await expect(page).toHaveURL(new RegExp(`period=${i % 2 ? "quarter" : "year"}`));
    await open(page, "/customers");
    await page.getByLabel("Status", { exact: true }).selectOption("LEAD");
    await expect(page).toHaveURL(/status=LEAD/);
  }
});

test("expense transaction updates finance and dashboard", async ({ page }) => {
  await open(page, "/finance");
  await page.getByRole("button", { name: "Expense" }).click();
  const dialog = page.getByRole("dialog");
  await dialog.getByLabel("Description").fill("Figma subscription");
  await dialog.getByLabel(/Amount/).fill("1500.50");
  await dialog.getByRole("button", { name: "Record transaction" }).click();
  await expect(dialog).toBeHidden();
  await expect(page.getByTestId("sum-expense")).toHaveText("₹1,500.50");
  await expect(page.getByTestId("sum-net")).toHaveText("₹18,499.50");

  await page.getByLabel("Type").selectOption("EXPENSE");
  await expect(page.getByTestId("transaction-row")).toHaveCount(1);

  await page.goto("/");
  await expect(page.getByTestId("metric-revenue")).toHaveText("₹20,000.00");
  await expect(page.getByTestId("metric-expenses")).toHaveText("₹1,500.50");
  await expect(page.getByTestId("metric-net")).toHaveText("₹18,499.50");
  await expect(page.getByTestId("metric-outstanding")).toHaveText("₹34,692.99");
});

test("command palette searches records", async ({ page }) => {
  await page.goto("/");
  await page.keyboard.press("Control+k");
  const input = page.getByPlaceholder("Search tasks, customers, invoices, notes…");
  await expect(input).toBeVisible();
  await input.fill("verma");
  await expect(page.getByRole("option", { name: /^Asha Verma/ })).toBeVisible();
  // Results are grouped by type; the invoice for this customer matches too.
  await expect(page.getByRole("option", { name: /^INV-0001 ·/ })).toBeVisible();
  // The invoice payment is found through its customer too.
  await expect(page.getByRole("option", { name: /Payment for INV-0001/ })).toBeVisible();
  await page.getByRole("option", { name: /^Asha Verma/ }).click();
  await expect(page).toHaveURL(/\/customers\/[a-z0-9]+$/);
});

test("data persists across reloads", async ({ page }) => {
  await page.goto("/projects");
  await page.reload();
  await expect(page.getByTestId("project-card").filter({ hasText: "Store redesign" })).toBeVisible();
});

test("theme switching works", async ({ page }) => {
  await page.goto("/");
  await page.getByTestId("theme-toggle").click();
  await page.getByRole("menuitemradio", { name: "Dark" }).click();
  await expect(page.locator("html")).toHaveClass(/dark/);
  await page.reload();
  await expect(page.locator("html")).toHaveClass(/dark/);
  await page.getByTestId("theme-toggle").click();
  await page.getByRole("menuitemradio", { name: "Light" }).click();
  await expect(page.locator("html")).not.toHaveClass(/dark/);
});

test("mobile navigation works", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/");
  await page.getByTestId("mobile-nav").click();
  await page.getByRole("dialog").getByRole("link", { name: "Tasks" }).click();
  await expect(page).toHaveURL(/\/tasks$/);
  await expect(page.getByRole("heading", { name: "Tasks" })).toBeVisible();
  for (const path of ["/", "/tasks", "/tasks?view=board", "/projects", "/customers", "/finance", "/finance/invoices", "/calendar", "/content", "/notes", "/analytics", "/settings"]) {
    await open(page, path);
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
    expect(overflow, `horizontal overflow on ${path}`).toBeLessThanOrEqual(0);
  }
});
