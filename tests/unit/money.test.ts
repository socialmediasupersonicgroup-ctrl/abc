import { describe, expect, it } from "vitest";
import { divRound, formatBps, formatMoney, formatMoneyCompact, minorToInput, parseMoney, parsePercentToBps } from "@/lib/money";

describe("parseMoney", () => {
  it("parses plain and grouped amounts into minor units", () => {
    expect(parseMoney("1234.56")).toBe(123456);
    expect(parseMoney("1,23,456.7")).toBe(12345670);
    expect(parseMoney("₹ 99")).toBe(9900);
    expect(parseMoney("0.05")).toBe(5);
    expect(parseMoney(42)).toBe(4200);
  });
  it("avoids floating point drift", () => {
    expect(parseMoney("0.1")! + parseMoney("0.2")!).toBe(30);
    expect(parseMoney("19.99")).toBe(1999);
    expect(parseMoney("1.005")).toBeNull();
  });
  it("rejects invalid input", () => {
    expect(parseMoney("abc")).toBeNull();
    expect(parseMoney("1.2.3")).toBeNull();
    expect(parseMoney("")).toBeNull();
    expect(parseMoney(null)).toBeNull();
  });
});

describe("formatting", () => {
  it("formats INR with Indian digit grouping", () => {
    expect(formatMoney(12345678, "INR")).toBe("₹1,23,456.78");
    expect(formatMoney(0, "INR")).toBe("₹0.00");
  });
  it("formats other currencies", () => {
    expect(formatMoney(123456, "USD")).toBe("$1,234.56");
  });
  it("produces compact labels deterministically", () => {
    expect(formatMoneyCompact(12_50_000_00, "INR")).toBe("₹12.5L");
    expect(formatMoneyCompact(3_00_00_000_00, "INR")).toBe("₹3Cr");
    expect(formatMoneyCompact(4_500_00, "INR")).toBe("₹4.5K");
    expect(formatMoneyCompact(-2_000_000_00, "USD")).toBe("-$2M");
  });
  it("round-trips input values", () => {
    expect(minorToInput(123405)).toBe("1234.05");
    expect(minorToInput(-50)).toBe("-0.50");
  });
  it("handles basis points", () => {
    expect(parsePercentToBps("18")).toBe(1800);
    expect(parsePercentToBps("12.5")).toBe(1250);
    expect(parsePercentToBps("abc")).toBeNull();
    expect(formatBps(1800)).toBe("18%");
    expect(formatBps(1250)).toBe("12.5%");
  });
});

describe("divRound", () => {
  it("rounds half away from zero", () => {
    expect(divRound(5, 10)).toBe(1);
    expect(divRound(4, 10)).toBe(0);
    expect(divRound(15, 10)).toBe(2);
    expect(divRound(-15, 10)).toBe(-2);
    expect(divRound(25, 10)).toBe(3);
  });
});
