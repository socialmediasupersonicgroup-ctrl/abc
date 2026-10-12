import { describe, expect, it } from "vitest";
import { customerSchema, eventSchema, invoiceSchema, projectSchema, taskSchema, transactionSchema } from "@/lib/validation";
import { relativeDue, zonedInputToDate, dateToZonedInput, todayKey } from "@/lib/dates";

const task = { title: "Write proposal", status: "TODO", priority: "HIGH", dueDate: "2026-10-20" } as const;

describe("task validation", () => {
  it("accepts a valid task and normalises empty fields", () => {
    const r = taskSchema.parse({ ...task, description: "", assignee: "", projectId: "", tags: "" });
    expect(r.description).toBeNull();
    expect(r.projectId).toBeNull();
  });
  it("requires a title", () => {
    expect(taskSchema.safeParse({ ...task, title: "   " }).success).toBe(false);
  });
  it("rejects invalid status and dates", () => {
    expect(taskSchema.safeParse({ ...task, status: "BLOCKED" }).success).toBe(false);
    expect(taskSchema.safeParse({ ...task, dueDate: "2026-13-45" }).success).toBe(false);
  });
});

describe("customer validation", () => {
  const c = { name: "Asha", status: "LEAD", dealValue: "" };
  it("validates email and phone", () => {
    expect(customerSchema.safeParse({ ...c, email: "not-an-email" }).success).toBe(false);
    expect(customerSchema.safeParse({ ...c, phone: "call me" }).success).toBe(false);
    const ok = customerSchema.parse({ ...c, email: "Asha@Example.com", phone: "+91 98765 43210" });
    expect(ok.email).toBe("asha@example.com");
  });
  it("parses deal value into minor units and rejects negatives", () => {
    expect(customerSchema.parse({ ...c, dealValue: "2,50,000.50" }).dealValue).toBe(25000050);
    expect(customerSchema.safeParse({ ...c, dealValue: "-5" }).success).toBe(false);
    expect(customerSchema.safeParse({ ...c, dealValue: "12.345" }).success).toBe(false);
  });
});

describe("transaction validation", () => {
  const t = { description: "Rent", amount: "18000", type: "EXPENSE", category: "Rent", date: "2026-10-01" };
  it("requires a positive amount", () => {
    expect(transactionSchema.parse(t).amount).toBe(1800000);
    expect(transactionSchema.safeParse({ ...t, amount: "0" }).success).toBe(false);
    expect(transactionSchema.safeParse({ ...t, amount: "" }).success).toBe(false);
  });
});

describe("project validation", () => {
  it("rejects a deadline before the start date", () => {
    const r = projectSchema.safeParse({ name: "X", status: "ACTIVE", priority: "LOW", startDate: "2026-10-10", dueDate: "2026-10-01", progressMode: "AUTO", manualProgress: 0, budget: "" });
    expect(r.success).toBe(false);
  });
  it("limits manual progress to 0–100", () => {
    const r = projectSchema.safeParse({ name: "X", status: "ACTIVE", priority: "LOW", progressMode: "MANUAL", manualProgress: 140, budget: "" });
    expect(r.success).toBe(false);
  });
});

describe("invoice validation", () => {
  const inv = {
    number: "INV-1",
    customerId: "c1",
    status: "DRAFT",
    issueDate: "2026-10-01",
    dueDate: "2026-10-15",
    discountType: "PERCENT",
    discountValue: "10",
    taxRate: "18",
    taxLabel: "GST",
    items: [{ description: "Design", quantity: "2", unitPrice: "1500.50" }],
  } as const;
  it("converts percentages and money", () => {
    const r = invoiceSchema.parse(inv);
    expect(r.discountValue).toBe(1000);
    expect(r.taxRateBps).toBe(1800);
    expect(r.items[0]).toEqual({ description: "Design", quantity: 2, unitPrice: 150050 });
  });
  it("rejects due date before issue date, missing items and bad quantities", () => {
    expect(invoiceSchema.safeParse({ ...inv, dueDate: "2026-09-01" }).success).toBe(false);
    expect(invoiceSchema.safeParse({ ...inv, items: [] }).success).toBe(false);
    expect(invoiceSchema.safeParse({ ...inv, items: [{ description: "x", quantity: "0", unitPrice: "1" }] }).success).toBe(false);
    expect(invoiceSchema.safeParse({ ...inv, discountValue: "150" }).success).toBe(false);
    expect(invoiceSchema.safeParse({ ...inv, customerId: "" }).success).toBe(false);
  });
});

describe("event validation & time zones", () => {
  const e = { title: "Call", allDay: false, start: "2026-10-12T10:00", end: "2026-10-12T09:00" };
  it("rejects an end before the start", () => {
    expect(eventSchema.safeParse(e).success).toBe(false);
    expect(eventSchema.safeParse({ ...e, end: "2026-10-12T11:00" }).success).toBe(true);
  });
  it("interprets wall-clock times in the workspace zone", () => {
    expect(zonedInputToDate("2026-10-12T10:00", "Asia/Kolkata")!.toISOString()).toBe("2026-10-12T04:30:00.000Z");
    expect(dateToZonedInput(new Date("2026-10-12T04:30:00Z"), "Asia/Kolkata")).toBe("2026-10-12T10:00");
  });
  it("computes today in the workspace zone, not UTC", () => {
    expect(todayKey("Asia/Kolkata", new Date("2026-10-11T20:00:00Z"))).toBe("2026-10-12");
    expect(todayKey("America/New_York", new Date("2026-10-12T02:00:00Z"))).toBe("2026-10-11");
  });
  it("describes due dates relative to today", () => {
    expect(relativeDue("2026-10-10", "2026-10-12")).toEqual({ label: "2d overdue", tone: "overdue" });
    expect(relativeDue("2026-10-12", "2026-10-12").tone).toBe("today");
    expect(relativeDue("2026-10-13", "2026-10-12").label).toBe("Tomorrow");
  });
});
