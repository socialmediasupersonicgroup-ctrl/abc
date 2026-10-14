import { afterAll, describe, expect, it } from "vitest";
import { prisma } from "@/lib/db";
import { invoiceSchema, paymentSchema } from "@/lib/validation";
import { createCustomer, appendCustomerNote } from "@/lib/services/customers";
import { createProject, getProject } from "@/lib/services/projects";
import { createTask, setTaskStatus } from "@/lib/services/tasks";
import { createTransaction, listTransactions } from "@/lib/services/transactions";
import { createInvoice, getInvoice, invoiceSummary, listInvoices, nextInvoiceNumber, recordPayment, setInvoiceStatus, updateInvoice } from "@/lib/services/invoices";
import { createEvent } from "@/lib/services/events";
import { updateWorkspace } from "@/lib/services/workspaces";
import { getAnalytics } from "@/lib/services/analytics";
import { getOverview } from "@/lib/services/dashboard";
import { globalSearch } from "@/lib/services/search";
import { instantToKey } from "@/lib/dates";
import { customerInput, newWorkspace, projectInput, taskInput, txnInput } from "./helpers";

const TODAY = "2026-10-12";
afterAll(() => prisma.$disconnect());

const invoice = (customerId: string, over: Record<string, unknown> = {}) =>
  invoiceSchema.parse({
    number: "INV-0001",
    customerId,
    status: "SENT",
    issueDate: "2026-10-01",
    dueDate: "2026-10-31",
    discountType: "NONE",
    discountValue: "",
    taxRate: "18",
    taxLabel: "GST",
    items: [{ description: "Work", quantity: "1", unitPrice: "100000" }],
    ...over,
  });

const wsSettings = (over: Record<string, unknown> = {}) => ({
  name: "WS",
  currency: "INR" as const,
  timezone: "Asia/Kolkata",
  weekStartsOn: 1,
  invoicePrefix: "INV-",
  defaultTaxRate: 1800,
  ownerName: "",
  ownerEmail: "",
  ...over,
});

describe("large amounts", () => {
  it("stores and sums amounts beyond the 32-bit limit (₹50 crore)", async () => {
    const ws = await newWorkspace();
    await createTransaction(ws.id, txnInput({ type: "INCOME", category: "Sales", amount: 50_00_00_000_00 }));
    await createTransaction(ws.id, txnInput({ type: "INCOME", category: "Sales", amount: 3_00_00_000_00 }));
    const { summary, rows } = await listTransactions(ws.id, {});
    expect(rows[0].amount).toBeGreaterThan(2 ** 31);
    expect(summary.income).toBe(53_00_00_000_00);
  });
});

describe("invoices", () => {
  it("numbers invoices correctly with a year-style prefix", async () => {
    const ws = await newWorkspace();
    const c = await createCustomer(ws.id, customerInput());
    expect(await nextInvoiceNumber(ws.id, "INV-2026")).toBe("INV-20260001");
    await createInvoice(ws.id, "INR", invoice(c.id, { number: "INV-20260001" }));
    await createInvoice(ws.id, "INR", invoice(c.id, { number: "PO-123456789" }));
    expect(await nextInvoiceNumber(ws.id, "INV-2026")).toBe("INV-20260002");
  });

  it("keeps payment income linked to the invoice's current customer, project and number", async () => {
    const ws = await newWorkspace();
    const a = await createCustomer(ws.id, customerInput({ name: "A" }));
    const b = await createCustomer(ws.id, customerInput({ name: "B" }));
    const pb = await createProject(ws.id, projectInput({ customerId: b.id }));
    const inv = await createInvoice(ws.id, "INR", invoice(a.id));
    await recordPayment(ws.id, inv.id, paymentSchema.parse({ amount: "1000", date: TODAY }));
    await updateInvoice(ws.id, inv.id, invoice(b.id, { number: "INV-0100", projectId: pb.id }));
    const [txn] = (await listTransactions(ws.id, {})).rows;
    expect(txn).toMatchObject({ customerId: b.id, projectId: pb.id, description: "Payment for INV-0100" });
  });

  it("rejects billing a project to a different customer", async () => {
    const ws = await newWorkspace();
    const a = await createCustomer(ws.id, customerInput({ name: "A" }));
    const b = await createCustomer(ws.id, customerInput({ name: "B" }));
    const pa = await createProject(ws.id, projectInput({ customerId: a.id }));
    await expect(createInvoice(ws.id, "INR", invoice(b.id, { projectId: pa.id }))).rejects.toThrow(/different customer/);
  });

  it("settles zero-total invoices instead of leaving them overdue", async () => {
    const ws = await newWorkspace();
    const c = await createCustomer(ws.id, customerInput());
    const draft = await createInvoice(ws.id, "INR", invoice(c.id, { status: "DRAFT", dueDate: "2026-10-05", items: [{ description: "Free", quantity: "1", unitPrice: "0" }] }));
    await setInvoiceStatus(ws.id, draft.id, "SENT");
    const inv = await getInvoice(ws.id, draft.id, TODAY);
    expect(inv.status).toBe("PAID");
    expect(inv.effectiveStatus).toBe("PAID");
    expect(await listInvoices(ws.id, { status: "OVERDUE" }, TODAY)).toHaveLength(0);
  });

  it("summarises every invoice, not a capped list", async () => {
    const ws = await newWorkspace();
    const c = await createCustomer(ws.id, customerInput());
    await prisma.invoice.createMany({
      data: Array.from({ length: 305 }, (_, i) => ({
        workspaceId: ws.id,
        number: `BULK-${i}`,
        customerId: c.id,
        status: "SENT",
        issueDate: new Date(`2026-0${(i % 9) + 1}-01T00:00:00Z`),
        dueDate: new Date("2026-12-31T00:00:00Z"),
        total: 1000,
      })),
    });
    const s = await invoiceSummary(ws.id, TODAY);
    expect(s.issued).toBe(305);
    expect(s.outstanding).toBe(305_000);
    const o = await getOverview(ws.id, "month", TODAY, new Date(`${TODAY}T12:00:00Z`));
    expect(o.receivables.outstanding).toBe(s.outstanding);
  });
});

describe("large invoices", () => {
  it("accepts a full-balance payment above the per-field limit", async () => {
    const ws = await newWorkspace();
    const c = await createCustomer(ws.id, customerInput());
    const inv = await createInvoice(ws.id, "INR", invoice(c.id, { items: [{ description: "Plant", quantity: "2", unitPrice: "750000000" }] }));
    expect(inv.total).toBe(177_000_000_000);
    await recordPayment(ws.id, inv.id, paymentSchema.parse({ amount: "1770000000.00", date: TODAY }));
    expect((await getInvoice(ws.id, inv.id, TODAY)).status).toBe("PAID");
  });

  it("keeps invoice maths exact up to the total ceiling and rejects anything beyond it", async () => {
    const { calculateInvoiceTotals } = await import("@/lib/calc/invoice");
    const { MAX_TOTAL_MINOR } = await import("@/lib/money");
    // Largest subtotal whose taxed total still fits: every product stays below 2^53.
    const t = calculateInvoiceTotals({ items: [{ quantity: 1, unitPrice: 762_982_987_000 }], discountType: "PERCENT", discountValue: 3333, taxRateBps: 1800 });
    const exactTax = (BigInt(t.taxableAmount) * 1800n * 2n + 10000n) / 20000n;
    expect(BigInt(t.taxAmount)).toBe(exactTax);
    expect(t.total).toBeLessThanOrEqual(MAX_TOTAL_MINOR);
    const ws = await newWorkspace();
    const c = await createCustomer(ws.id, customerInput());
    await expect(createInvoice(ws.id, "INR", invoice(c.id, { items: [{ description: "Too big", quantity: "100", unitPrice: "1000000000" }] }))).rejects.toThrow(/too large/);
  });

  it("stays editable after its project moves to another customer", async () => {
    const ws = await newWorkspace();
    const a = await createCustomer(ws.id, customerInput({ name: "A" }));
    const b = await createCustomer(ws.id, customerInput({ name: "B" }));
    const p = await createProject(ws.id, projectInput({ customerId: a.id }));
    const inv = await createInvoice(ws.id, "INR", invoice(a.id, { projectId: p.id }));
    await prisma.project.update({ where: { id: p.id }, data: { customerId: b.id } });
    await expect(updateInvoice(ws.id, inv.id, invoice(a.id, { projectId: p.id, notes: "Updated" }))).resolves.toBeTruthy();
  });

  it("never raises an overdue alert for an invoice with nothing left to pay", async () => {
    const { getAlerts } = await import("@/lib/services/notifications");
    const ws = await newWorkspace();
    const c = await createCustomer(ws.id, customerInput());
    // A legacy row (stored SENT with a zero total), as written by older versions.
    await prisma.invoice.create({ data: { workspaceId: ws.id, number: "LEG-1", customerId: c.id, status: "SENT", issueDate: new Date("2026-09-01T00:00:00Z"), dueDate: new Date("2026-09-15T00:00:00Z"), total: 0 } });
    const alerts = await getAlerts(ws.id, TODAY, new Date(`${TODAY}T12:00:00Z`), "INR");
    expect(alerts.filter((x) => x.kind === "invoice")).toHaveLength(0);
  });
});

describe("projects & customers", () => {
  it("counts every linked expense toward the budget", async () => {
    const ws = await newWorkspace();
    const p = await createProject(ws.id, projectInput({ budget: 30_000_00 }));
    for (let i = 0; i < 30; i++) await createTransaction(ws.id, txnInput({ amount: 1_000_00, projectId: p.id }));
    expect((await getProject(ws.id, p.id)).spent).toBe(30_000_00);
  });

  it("refuses to grow customer notes beyond the editable limit", async () => {
    const ws = await newWorkspace();
    const c = await createCustomer(ws.id, customerInput());
    const chunk = "x".repeat(2000);
    let error: unknown = null;
    for (let i = 0; i < 30 && !error; i++) {
      try {
        await appendCustomerNote(ws.id, c.id, chunk, "1 Oct 2026");
      } catch (e) {
        error = e;
      }
    }
    expect(String(error)).toMatch(/notes are full/);
    const saved = await prisma.customer.findUniqueOrThrow({ where: { id: c.id } });
    expect(saved.notes!.length).toBeLessThanOrEqual(50_000);
  });
});

describe("workspace settings", () => {
  it("locks the currency once amounts exist", async () => {
    const ws = await newWorkspace();
    await updateWorkspace(ws.id, wsSettings({ currency: "USD" }));
    await createTransaction(ws.id, txnInput());
    await expect(updateWorkspace(ws.id, wsSettings({ currency: "EUR" }))).rejects.toThrow(/currency can't be changed/);
    await expect(updateWorkspace(ws.id, wsSettings({ currency: "USD", name: "Renamed" }))).resolves.toBeTruthy();
  });

  it("keeps all-day events on the same dates when the time zone changes", async () => {
    const ws = await newWorkspace();
    const e = await createEvent(ws.id, "Asia/Kolkata", {
      title: "Holiday",
      description: null,
      location: null,
      allDay: true,
      start: "2026-10-20T00:00",
      end: "2026-10-20T00:00",
      taskId: null,
      projectId: null,
      customerId: null,
    });
    await updateWorkspace(ws.id, wsSettings({ timezone: "Europe/London" }));
    const moved = await prisma.event.findUniqueOrThrow({ where: { id: e.id } });
    expect(instantToKey(moved.startAt, "Europe/London")).toBe("2026-10-20");
    expect(instantToKey(new Date(moved.endAt.getTime() - 1), "Europe/London")).toBe("2026-10-20");
  });
});

describe("time zones in analytics", () => {
  it("buckets completed tasks by the workspace's local month", async () => {
    const ws = await newWorkspace();
    const t = await createTask(ws.id, taskInput());
    await setTaskStatus(ws.id, t.id, "DONE");
    // 1 Oct 03:00 in Kolkata is still 30 Sep in UTC.
    await prisma.task.update({ where: { id: t.id }, data: { completedAt: new Date("2026-09-30T21:30:00Z") } });
    const a = await getAnalytics(ws.id, { from: "2026-10-01", to: "2026-10-31" }, TODAY, "Asia/Kolkata");
    expect(a.tasksCompletedTotal).toBe(1);
    expect(a.taskSeries.find((m) => m.key === "2026-10")?.completed).toBe(1);
  });
});

describe("search", () => {
  it("does not treat % and _ as wildcards, in lists, totals or the command palette", async () => {
    const ws = await newWorkspace();
    const { listTasks } = await import("@/lib/services/tasks");
    await createTask(ws.id, taskInput({ title: "Probe task" }));
    await createTask(ws.id, taskInput({ title: "Offer 50% discount" }));
    // Newer decoys that contain the literal segment "50" but not "50%".
    for (let i = 0; i < 6; i++) await createTask(ws.id, taskInput({ title: `Order 50 units batch ${i}` }));

    expect((await globalSearch(ws.id, "50%", "INR")).map((h) => h.title)).toEqual(["Offer 50% discount"]);
    expect(await globalSearch(ws.id, "_", "INR")).toHaveLength(0);
    expect((await listTasks(ws.id, { q: "50%" })).map((t) => t.title)).toEqual(["Offer 50% discount"]);
    expect(await listTasks(ws.id, { q: "_" })).toHaveLength(0);
    // Plain queries are unchanged.
    expect(await listTasks(ws.id, { q: "units" })).toHaveLength(6);

    await createTransaction(ws.id, txnInput({ description: "Annual 50% off promo", amount: 1000 }));
    await createTransaction(ws.id, txnInput({ description: "Office rent", amount: 5_000_000 }));
    const filtered = await listTransactions(ws.id, { q: "50% off" });
    expect(filtered.rows.map((r) => r.description)).toEqual(["Annual 50% off promo"]);
    expect(filtered.summary.expense).toBe(1000);
  });

  it("matches wildcard characters in related fields", async () => {
    const ws = await newWorkspace();
    const c = await createCustomer(ws.id, customerInput({ name: "Acme_Industries" }));
    await createCustomer(ws.id, customerInput({ name: "AcmeXIndustries" }));
    await createInvoice(ws.id, "INR", invoice(c.id, { number: "INV_2026_0042" }));
    await createInvoice(ws.id, "INR", invoice(c.id, { number: "INVX2026X0042" }));
    expect((await listInvoices(ws.id, { q: "INV_2026_0042" }, TODAY)).map((i) => i.number)).toEqual(["INV_2026_0042"]);
    expect((await listInvoices(ws.id, { q: "acme_ind" }, TODAY)).length).toBe(2);
  });
});
