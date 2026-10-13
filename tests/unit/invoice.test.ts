import { describe, expect, it } from "vitest";
import { calculateInvoiceTotals, effectiveInvoiceStatus, invoiceBalance, lineTotal, statusAfterPayment } from "@/lib/calc/invoice";

describe("invoice totals", () => {
  it("calculates subtotal, tax and total", () => {
    const t = calculateInvoiceTotals({
      items: [
        { quantity: 2, unitPrice: 150000 },
        { quantity: 1, unitPrice: 99900 },
      ],
      discountType: "NONE",
      discountValue: 0,
      taxRateBps: 1800,
    });
    expect(t.subtotal).toBe(399900);
    expect(t.taxAmount).toBe(71982);
    expect(t.total).toBe(471882);
  });

  it("applies percentage discounts before tax", () => {
    const t = calculateInvoiceTotals({ items: [{ quantity: 1, unitPrice: 100000 }], discountType: "PERCENT", discountValue: 1000, taxRateBps: 1800 });
    expect(t.discountAmount).toBe(10000);
    expect(t.taxableAmount).toBe(90000);
    expect(t.taxAmount).toBe(16200);
    expect(t.total).toBe(106200);
  });

  it("caps fixed discounts at the subtotal", () => {
    const t = calculateInvoiceTotals({ items: [{ quantity: 1, unitPrice: 5000 }], discountType: "FIXED", discountValue: 999999, taxRateBps: 1800 });
    expect(t.discountAmount).toBe(5000);
    expect(t.total).toBe(0);
  });

  it("rounds each line and the tax half away from zero", () => {
    // 1.5 × ₹0.33 = ₹0.495 → ₹0.50
    expect(lineTotal(1.5, 33)).toBe(50);
    // 3 × ₹33.33 = ₹99.99; 18% = ₹17.9982 → ₹18.00
    const t = calculateInvoiceTotals({ items: [{ quantity: 3, unitPrice: 3333 }], discountType: "NONE", discountValue: 0, taxRateBps: 1800 });
    expect(t.subtotal).toBe(9999);
    expect(t.taxAmount).toBe(1800);
    expect(t.total).toBe(11799);
  });

  it("handles fractional quantities exactly", () => {
    expect(lineTotal(0.1, 30)).toBe(3);
    expect(lineTotal(1.15, 10000)).toBe(11500);
    expect(lineTotal(2.25, 199)).toBe(448); // 447.75 → 448
  });

  it("supports fractional tax rates", () => {
    const t = calculateInvoiceTotals({ items: [{ quantity: 1, unitPrice: 10000 }], discountType: "NONE", discountValue: 0, taxRateBps: 1250 });
    expect(t.taxAmount).toBe(1250);
  });
});

describe("invoice status", () => {
  const base = { total: 10000, amountPaid: 0, dueDate: new Date("2026-10-10T00:00:00Z") };
  it("derives overdue from due date", () => {
    expect(effectiveInvoiceStatus({ ...base, status: "SENT" }, "2026-10-11")).toBe("OVERDUE");
    expect(effectiveInvoiceStatus({ ...base, status: "SENT" }, "2026-10-10")).toBe("SENT");
  });
  it("derives paid from payments", () => {
    expect(effectiveInvoiceStatus({ ...base, status: "SENT", amountPaid: 10000 }, "2026-12-01")).toBe("PAID");
  });
  it("leaves drafts and cancelled alone", () => {
    expect(effectiveInvoiceStatus({ ...base, status: "DRAFT" }, "2027-01-01")).toBe("DRAFT");
    expect(effectiveInvoiceStatus({ ...base, status: "CANCELLED" }, "2027-01-01")).toBe("CANCELLED");
  });
  it("updates stored status after payments", () => {
    expect(statusAfterPayment("SENT", 10000, 10000)).toBe("PAID");
    expect(statusAfterPayment("PAID", 10000, 5000)).toBe("SENT");
    // OVERDUE is never stored; it is derived from the due date.
    expect(statusAfterPayment("OVERDUE", 10000, 5000)).toBe("SENT");
    expect(statusAfterPayment("DRAFT", 0, 0)).toBe("DRAFT");
    expect(statusAfterPayment("SENT", 0, 0)).toBe("PAID");
  });
  it("never reports a negative balance", () => {
    expect(invoiceBalance(10000, 4000)).toBe(6000);
    expect(invoiceBalance(10000, 12000)).toBe(0);
  });
});
