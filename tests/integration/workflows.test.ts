import { afterAll, describe, expect, it } from "vitest";
import { PrismaClient } from "@prisma/client";
import { prisma } from "@/lib/db";
import { invoiceSchema, paymentSchema } from "@/lib/validation";
import { createTask, deleteTask, getTask, listTasks, setTaskStatus, updateTask } from "@/lib/services/tasks";
import { createProject, createProjectWithTasks, deleteProject, getProject, listProjects } from "@/lib/services/projects";
import { createCustomer, deleteCustomer, getCustomer, listCustomers } from "@/lib/services/customers";
import { createTransaction, deleteTransaction, listTransactions, updateTransaction } from "@/lib/services/transactions";
import { createInvoice, deleteInvoice, deletePayment, getInvoice, listInvoices, recordPayment, updateInvoice } from "@/lib/services/invoices";
import { getOverview } from "@/lib/services/dashboard";
import { globalSearch } from "@/lib/services/search";
import { createEvent, listEvents } from "@/lib/services/events";
import { createNote, listNotes, setNoteFlags, updateNote } from "@/lib/services/notes";
import { clearWorkspaceData, workspaceStats } from "@/lib/services/workspaces";
import { seedDemoData } from "@/lib/demo-data";
import { AppError } from "@/lib/services/errors";
import { customerInput, newWorkspace, projectInput, taskInput, txnInput } from "./helpers";

const TODAY = "2026-10-12";

afterAll(() => prisma.$disconnect());

describe("tasks", () => {
  it("creates, edits, completes and deletes a task", async () => {
    const ws = await newWorkspace();
    const t = await createTask(ws.id, taskInput({ title: "Draft brief", tags: "Design, client", dueDate: "2026-10-20" }));
    expect(t.tags.map((x) => x.name).sort()).toEqual(["client", "design"]);
    expect(t.completedAt).toBeNull();

    const edited = await updateTask(ws.id, t.id, taskInput({ title: "Draft final brief", priority: "URGENT", tags: "design" }));
    expect(edited.title).toBe("Draft final brief");
    expect(edited.tags.map((x) => x.name)).toEqual(["design"]);
    // The orphaned "client" tag is pruned.
    expect(await prisma.tag.count({ where: { workspaceId: ws.id } })).toBe(1);

    await setTaskStatus(ws.id, t.id, "DONE");
    const done = await getTask(ws.id, t.id);
    expect(done.status).toBe("DONE");
    expect(done.completedAt).toBeInstanceOf(Date);

    await setTaskStatus(ws.id, t.id, "IN_PROGRESS");
    expect((await getTask(ws.id, t.id)).completedAt).toBeNull();

    await deleteTask(ws.id, t.id);
    await expect(getTask(ws.id, t.id)).rejects.toThrow(AppError);
  });

  it("filters and searches tasks", async () => {
    const ws = await newWorkspace();
    await createTask(ws.id, taskInput({ title: "Pay GST", priority: "URGENT", dueDate: "2026-10-01", tags: "finance" }));
    await createTask(ws.id, taskInput({ title: "Write blog", priority: "LOW", dueDate: "2026-10-15" }));
    await createTask(ws.id, taskInput({ title: "Old done", status: "DONE", dueDate: "2026-09-01" }));

    expect((await listTasks(ws.id, { q: "gst" }, TODAY)).map((t) => t.title)).toEqual(["Pay GST"]);
    expect((await listTasks(ws.id, { priority: "LOW" }, TODAY)).map((t) => t.title)).toEqual(["Write blog"]);
    expect((await listTasks(ws.id, { due: "overdue" }, TODAY)).map((t) => t.title)).toEqual(["Pay GST"]);
    expect((await listTasks(ws.id, { due: "week" }, TODAY)).map((t) => t.title)).toEqual(["Write blog"]);
    expect((await listTasks(ws.id, { tag: "finance" }, TODAY)).length).toBe(1);
    expect((await listTasks(ws.id, { status: "DONE" }, TODAY)).length).toBe(1);
  });

  it("rejects links to records in another workspace", async () => {
    const a = await newWorkspace("A");
    const b = await newWorkspace("B");
    const foreign = await createProject(b.id, projectInput());
    await expect(createTask(a.id, taskInput({ projectId: foreign.id }))).rejects.toThrow(/no longer exists/);
  });
});

describe("projects", () => {
  it("links tasks and calculates progress from completion", async () => {
    const ws = await newWorkspace();
    const p = await createProjectWithTasks(ws.id, projectInput({ name: "Website" }), ["Brief", "Design", "Build", "Launch"]);
    let detail = await getProject(ws.id, p.id);
    expect(detail.tasks).toHaveLength(4);
    expect(detail.progress).toMatchObject({ value: 0, source: "tasks" });

    await setTaskStatus(ws.id, detail.tasks[0].id, "DONE");
    await createTask(ws.id, taskInput({ title: "QA", projectId: p.id, status: "DONE" }));
    detail = await getProject(ws.id, p.id);
    expect(detail.progress).toMatchObject({ value: 40, done: 2, total: 5 });

    const listed = await listProjects(ws.id, {});
    expect(listed[0].progress.value).toBe(40);
  });

  it("keeps tasks when a project is deleted", async () => {
    const ws = await newWorkspace();
    const p = await createProjectWithTasks(ws.id, projectInput(), ["Keep me"]);
    await deleteProject(ws.id, p.id);
    const tasks = await listTasks(ws.id);
    expect(tasks).toHaveLength(1);
    expect(tasks[0].projectId).toBeNull();
  });
});

describe("customers, invoices and payments", () => {
  async function setup() {
    const ws = await newWorkspace();
    const c = await createCustomer(ws.id, customerInput({ name: "Lumen Retail", email: "a@lumen.example" }));
    const input = invoiceSchema.parse({
      number: "INV-0001",
      customerId: c.id,
      status: "SENT",
      issueDate: "2026-10-01",
      dueDate: "2026-10-31",
      discountType: "PERCENT",
      discountValue: "10",
      taxRate: "18",
      taxLabel: "GST",
      items: [
        { description: "Design", quantity: "2", unitPrice: "25000" },
        { description: "Hosting", quantity: "1.5", unitPrice: "999.99" },
      ],
    });
    const inv = await createInvoice(ws.id, "INR", input);
    return { ws, c, inv, input };
  }

  it("calculates and stores invoice totals", async () => {
    const { inv } = await setup();
    // 2×25000 + round(1.5×999.99=1499.985)=1499.99 → 51499.99; −10% (5150.00) → 46349.99; GST 18% = 8342.9982 → 8343.00
    expect(inv.subtotal).toBe(5149999);
    expect(inv.discountAmount).toBe(515000);
    expect(inv.taxAmount).toBe(834300);
    expect(inv.total).toBe(5469299);
  });

  it("records payments, updates balances and counts revenue once", async () => {
    const { ws, c, inv } = await setup();
    const p1 = await recordPayment(ws.id, inv.id, paymentSchema.parse({ amount: "20000", date: "2026-10-05", method: "UPI" }));
    let detail = await getInvoice(ws.id, inv.id, TODAY);
    expect(detail.amountPaid).toBe(2000000);
    expect(detail.balance).toBe(5469299 - 2000000);
    expect(detail.effectiveStatus).toBe("SENT");

    // The payment created exactly one linked income transaction.
    const txns = await listTransactions(ws.id, {});
    expect(txns.rows).toHaveLength(1);
    expect(txns.rows[0]).toMatchObject({ type: "INCOME", amount: 2000000, paymentId: p1.id, customerId: c.id });
    expect(txns.summary.income).toBe(2000000);

    // Overpayment is rejected.
    await expect(recordPayment(ws.id, inv.id, paymentSchema.parse({ amount: "999999", date: TODAY }))).rejects.toThrow(/exceeds the outstanding balance/);

    // Paying the remainder marks it paid.
    await recordPayment(ws.id, inv.id, { amount: detail.balance, date: TODAY, method: null, reference: null, notes: null });
    detail = await getInvoice(ws.id, inv.id, TODAY);
    expect(detail.status).toBe("PAID");
    expect(detail.effectiveStatus).toBe("PAID");
    expect(detail.balance).toBe(0);

    // Dashboard: revenue equals payments (no double counting with invoice totals), nothing outstanding.
    const o = await getOverview(ws.id, "month", TODAY, new Date(`${TODAY}T12:00:00Z`));
    expect(o.finance.revenue).toBe(5469299);
    expect(o.receivables.outstanding).toBe(0);

    // Linked transactions cannot be edited or deleted directly.
    await expect(deleteTransaction(ws.id, txns.rows[0].id)).rejects.toThrow(/invoice payment/);

    // Removing a payment removes its transaction and reopens the invoice.
    await deletePayment(ws.id, p1.id);
    detail = await getInvoice(ws.id, inv.id, TODAY);
    expect(detail.status).toBe("SENT");
    expect(detail.amountPaid).toBe(5469299 - 2000000);
    expect((await listTransactions(ws.id, {})).rows).toHaveLength(1);
  });

  it("protects financial history", async () => {
    const { ws, c, inv, input } = await setup();
    await recordPayment(ws.id, inv.id, { amount: 100000, date: TODAY, method: null, reference: null, notes: null });
    await expect(deleteCustomer(ws.id, c.id)).rejects.toThrow(/invoice/);
    await expect(deleteInvoice(ws.id, inv.id)).rejects.toThrow(/payments/);
    await expect(updateInvoice(ws.id, inv.id, { ...input, items: [{ description: "Tiny", quantity: 1, unitPrice: 100 }] })).rejects.toThrow(/less than/);
    await expect(updateInvoice(ws.id, inv.id, { ...input, status: "CANCELLED" })).rejects.toThrow(/payments/);
  });

  it("rejects duplicate invoice numbers and payments on drafts", async () => {
    const { ws, input } = await setup();
    await expect(createInvoice(ws.id, "INR", input)).rejects.toThrow(/already in use/);
    const draft = await createInvoice(ws.id, "INR", { ...input, number: "INV-0002", status: "DRAFT" });
    await expect(recordPayment(ws.id, draft.id, { amount: 100, date: TODAY, method: null, reference: null, notes: null })).rejects.toThrow(/Sent/);
  });

  it("derives overdue status and filters by it", async () => {
    const { ws, input } = await setup();
    await createInvoice(ws.id, "INR", { ...input, number: "INV-0009", issueDate: "2026-09-01", dueDate: "2026-09-15" });
    const overdue = await listInvoices(ws.id, { status: "OVERDUE" }, TODAY);
    expect(overdue.map((i) => i.number)).toEqual(["INV-0009"]);
    expect(overdue[0].effectiveStatus).toBe("OVERDUE");
    const byCustomer = await listInvoices(ws.id, { q: "lumen" }, TODAY);
    expect(byCustomer).toHaveLength(2);
  });

  it("shows invoices on the customer and supports CRM search", async () => {
    const { ws, c } = await setup();
    await createCustomer(ws.id, customerInput({ name: "Other Co", status: "LEAD" }));
    const detail = await getCustomer(ws.id, c.id);
    expect(detail.invoices).toHaveLength(1);
    expect((await listCustomers(ws.id, { q: "lumen" })).map((x) => x.name)).toEqual(["Lumen Retail"]);
    expect((await listCustomers(ws.id, { status: "LEAD" })).map((x) => x.name)).toEqual(["Other Co"]);
  });
});

describe("transactions & dashboard", () => {
  it("summaries reflect type, category and date filters", async () => {
    const ws = await newWorkspace();
    await createTransaction(ws.id, txnInput({ type: "INCOME", category: "Sales", amount: 500000, date: "2026-10-03", description: "Order 1" }));
    const e = await createTransaction(ws.id, txnInput({ amount: 120000, date: "2026-10-04", description: "Laptop", category: "Equipment" }));
    await createTransaction(ws.id, txnInput({ amount: 50000, date: "2026-09-04", description: "Ads" }));

    expect((await listTransactions(ws.id, {})).summary).toMatchObject({ income: 500000, expense: 170000, net: 330000 });
    expect((await listTransactions(ws.id, { type: "EXPENSE" })).summary.expense).toBe(170000);
    expect((await listTransactions(ws.id, { from: "2026-10-01", to: "2026-10-31" })).summary).toMatchObject({ income: 500000, expense: 120000 });
    expect((await listTransactions(ws.id, { q: "laptop" })).rows.map((r) => r.description)).toEqual(["Laptop"]);
    expect((await listTransactions(ws.id, { category: "Equipment" })).total).toBe(1);

    await updateTransaction(ws.id, e.id, txnInput({ amount: 100000, date: "2026-10-04", description: "Laptop", category: "Equipment" }));
    expect((await listTransactions(ws.id, {})).summary.expense).toBe(150000);
  });

  it("dashboard metrics update after data changes", async () => {
    const ws = await newWorkspace();
    const now = new Date(`${TODAY}T12:00:00Z`);
    let o = await getOverview(ws.id, "month", TODAY, now);
    expect(o.isEmpty).toBe(true);
    expect(o.finance).toMatchObject({ revenue: 0, expenses: 0, net: 0, revenueChange: null });

    await createTransaction(ws.id, txnInput({ type: "INCOME", category: "Sales", amount: 300000, date: "2026-10-02" }));
    await createTransaction(ws.id, txnInput({ amount: 100000, date: "2026-10-03" }));
    const t = await createTask(ws.id, taskInput({ dueDate: "2026-10-01" }));
    await createProject(ws.id, projectInput({ status: "ACTIVE" }));
    await createCustomer(ws.id, customerInput());

    o = await getOverview(ws.id, "month", TODAY, now);
    expect(o.isEmpty).toBe(false);
    expect(o.finance).toMatchObject({ revenue: 300000, expenses: 100000, net: 200000 });
    // No previous-period data → no invented comparison.
    expect(o.finance.revenueChange).toBeNull();
    expect(o.tasks).toMatchObject({ open: 1, overdue: 1 });
    expect(o.projects.active).toBe(1);
    expect(o.customers.total).toBe(1);

    await createTransaction(ws.id, txnInput({ type: "INCOME", category: "Sales", amount: 150000, date: "2026-09-05" }));
    await setTaskStatus(ws.id, t.id, "DONE");
    o = await getOverview(ws.id, "month", TODAY, now);
    expect(o.finance.revenueChange).toBe(100);
    expect(o.tasks).toMatchObject({ open: 0, overdue: 0 });
    expect(o.series.at(-1)).toMatchObject({ income: 300000, expense: 100000 });
  });
});

describe("search, events, notes", () => {
  it("global search groups results across modules and stays inside the workspace", async () => {
    const ws = await newWorkspace();
    const other = await newWorkspace();
    await createTask(ws.id, taskInput({ title: "Nebula launch checklist" }));
    await createCustomer(ws.id, customerInput({ name: "Nebula Labs" }));
    await createNote(ws.id, { title: "Nebula notes", content: "", pinned: false, tags: null, taskId: null, projectId: null, customerId: null });
    await createTask(other.id, taskInput({ title: "Nebula secret" }));
    const hits = await globalSearch(ws.id, "nebula", "INR");
    expect(hits.map((h) => h.type).sort()).toEqual(["customer", "note", "task"]);
    expect(hits.some((h) => h.title === "Nebula secret")).toBe(false);
  });

  it("stores events in UTC and finds them by overlapping range", async () => {
    const ws = await newWorkspace();
    const e = await createEvent(ws.id, "Asia/Kolkata", {
      title: "Review",
      description: null,
      location: null,
      allDay: false,
      start: "2026-10-12T23:30",
      end: "2026-10-13T00:30",
      taskId: null,
      projectId: null,
      customerId: null,
    });
    expect(e.startAt.toISOString()).toBe("2026-10-12T18:00:00.000Z");
    const found = await listEvents(ws.id, new Date("2026-10-12T18:30:00Z"), new Date("2026-10-13T18:30:00Z"));
    expect(found.map((x) => x.id)).toEqual([e.id]);
    await expect(
      createEvent(ws.id, "Asia/Kolkata", { title: "Bad", description: null, location: null, allDay: false, start: "2026-10-12T10:00", end: "2026-10-12T09:00", taskId: null, projectId: null, customerId: null }),
    ).rejects.toThrow(/after the start/);
  });

  it("notes can be edited, pinned and archived", async () => {
    const ws = await newWorkspace();
    const n = await createNote(ws.id, { title: "Process", content: "Step 1", pinned: false, tags: "ops", taskId: null, projectId: null, customerId: null });
    await updateNote(ws.id, n.id, { title: "Process v2", content: "Step 1\nStep 2", pinned: true, tags: "ops, sop", taskId: null, projectId: null, customerId: null });
    let list = await listNotes(ws.id, { view: "pinned" });
    expect(list.map((x) => x.title)).toEqual(["Process v2"]);
    expect(list[0].tags.map((t) => t.name)).toEqual(["ops", "sop"]);
    await setNoteFlags(ws.id, n.id, { archived: true });
    expect(await listNotes(ws.id, {})).toHaveLength(0);
    list = await listNotes(ws.id, { view: "archived" });
    expect(list).toHaveLength(1);
    expect((await listNotes(ws.id, { view: "archived", q: "step 2" })).length).toBe(1);
  });
});

describe("workspace data", () => {
  it("seeds consistent demo data and can clear it", async () => {
    const ws = await prisma.workspace.create({ data: { name: "Demo", isDemo: true } });
    await seedDemoData(prisma, ws.id);
    const stats = await workspaceStats(ws.id);
    expect(stats.invoices).toBeGreaterThan(0);
    // Every payment has exactly one linked income transaction.
    const payments = await prisma.payment.findMany({ where: { invoice: { workspaceId: ws.id } }, include: { transaction: true } });
    expect(payments.length).toBeGreaterThan(0);
    expect(payments.every((p) => p.transaction?.amount === p.amount && p.transaction.type === "INCOME")).toBe(true);
    // Stored paid amounts match payments.
    const invoices = await prisma.invoice.findMany({ where: { workspaceId: ws.id }, include: { payments: true } });
    for (const inv of invoices) expect(inv.amountPaid).toBe(inv.payments.reduce((s, p) => s + p.amount, 0));

    await clearWorkspaceData(ws.id);
    expect(Object.values(await workspaceStats(ws.id)).every((v) => v === 0)).toBe(true);
  });

  it("data persists across client restarts", async () => {
    const ws = await newWorkspace();
    await createTask(ws.id, taskInput({ title: "Survives restart" }));
    await prisma.$disconnect();
    const fresh = new PrismaClient();
    try {
      const found = await fresh.task.findFirst({ where: { workspaceId: ws.id } });
      expect(found?.title).toBe("Survives restart");
    } finally {
      await fresh.$disconnect();
    }
  });
});
