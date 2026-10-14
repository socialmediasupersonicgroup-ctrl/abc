import * as React from "react";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { formatMoneyCompact, parseMoney } from "@/lib/money";
import { addDaysToKey, isDateKey, isDateTimeLocal, plusOneHour } from "@/lib/dates";
import { effectiveInvoiceStatus } from "@/lib/calc/invoice";
import { safeAnchor, visibleRange } from "@/lib/calendar";
import { Markdown } from "@/components/notes/markdown";

describe("money input formats", () => {
  it("treats a single comma with 1–2 digits as a decimal comma", () => {
    expect(parseMoney("49,99")).toBe(4999);
    expect(parseMoney("1,5")).toBe(150);
    expect(parseMoney("1.234,56")).toBe(123456);
  });
  it("still accepts Indian and Western grouping, and rejects malformed grouping", () => {
    expect(parseMoney("1,23,456.78")).toBe(12345678);
    expect(parseMoney("1,234,567.89")).toBe(123456789);
    expect(parseMoney("12,345")).toBe(1234500);
    expect(parseMoney("1,2,3")).toBeNull();
    expect(parseMoney("12,3456")).toBeNull();
  });
  it("promotes compact labels at unit boundaries", () => {
    expect(formatMoneyCompact(99_950_00, "INR")).toBe("₹1L");
    expect(formatMoneyCompact(99_949_00, "INR")).toBe("₹99.9K");
    expect(formatMoneyCompact(999_500_00, "USD")).toBe("$1M");
    expect(formatMoneyCompact(999_49, "INR")).toBe("₹999");
  });
});

describe("dates", () => {
  it("rejects impossible calendar dates instead of rolling them over", () => {
    expect(isDateKey("2026-02-30")).toBe(false);
    expect(isDateKey("2026-04-31")).toBe(false);
    expect(isDateKey("2024-02-29")).toBe(true);
    expect(isDateKey("0002-01-01")).toBe(false);
    expect(isDateTimeLocal("2026-02-30T10:00")).toBe(false);
    expect(isDateTimeLocal("2026-02-28T24:00")).toBe(false);
    expect(isDateTimeLocal("2026-02-28T23:59")).toBe(true);
  });
  it("falls back to today for an invalid calendar anchor instead of crashing", () => {
    expect(safeAnchor("2026-02-30", "2026-10-12")).toBe("2026-10-12");
    expect(() => visibleRange("month", safeAnchor("2026-02-30", "2026-10-12"), 1)).not.toThrow();
  });
  it("adds an hour to wall-clock times across midnight", () => {
    expect(plusOneHour("2026-10-12T23:30")).toBe("2026-10-13T00:30");
    expect(plusOneHour("2026-12-31T23:00")).toBe("2027-01-01T00:00");
    expect(plusOneHour("2026-10-12T09:15")).toBe("2026-10-12T10:15");
  });
});

describe("day arithmetic is independent of the server's DST zone", () => {
  const original = process.env.TZ;
  beforeAll(() => {
    process.env.TZ = "America/New_York";
  });
  afterAll(() => {
    process.env.TZ = original;
  });
  it("never skips or repeats a day around DST changes", () => {
    expect(addDaysToKey("2026-03-08", 1)).toBe("2026-03-09");
    expect(addDaysToKey("2026-11-02", -1)).toBe("2026-11-01");
    expect(addDaysToKey("2026-03-29", 1)).toBe("2026-03-30");
    expect(addDaysToKey("2026-10-26", -1)).toBe("2026-10-25");
  });
  it("builds a 42-day month grid with distinct days", () => {
    const r = visibleRange("month", "2026-03-15", 1);
    const days = Array.from({ length: r.days }, (_, i) => addDaysToKey(r.from, i));
    expect(new Set(days).size).toBe(42);
  });
});

describe("invoice status edge cases", () => {
  it("treats an issued zero-total invoice as paid, never overdue", () => {
    expect(effectiveInvoiceStatus({ status: "SENT", total: 0, amountPaid: 0, dueDate: new Date("2026-01-01T00:00:00Z") }, "2026-10-12")).toBe("PAID");
  });
});

describe("markdown renderer", () => {
  it("terminates on line separators and unmatched heading-like lines", () => {
    const html = renderToStaticMarkup(<Markdown text={"# Agenda Q3 review\n#\tTabbed\nplain\r\nline"} />);
    expect(html).toContain("Agenda");
    expect(html).toContain("Q3 review");
  });
  it("never renders javascript: links", () => {
    const html = renderToStaticMarkup(<Markdown text={"[x](javascript:alert(1))"} />);
    expect(html).not.toContain("javascript:");
  });
});
