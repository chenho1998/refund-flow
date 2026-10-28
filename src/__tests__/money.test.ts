import { describe, it, expect } from "vitest";
import { toMinorUnits, fromMinorUnits, formatMYR } from "../domain/money";

describe("toMinorUnits", () => {
  it("converts standard MYR price to sen", () => {
    expect(toMinorUnits(13.9)).toBe(1390);
    expect(toMinorUnits(2.0)).toBe(200);
    expect(toMinorUnits(5.0)).toBe(500);
    expect(toMinorUnits(1.5)).toBe(150);
    expect(toMinorUnits(1.0)).toBe(100);
    expect(toMinorUnits(7.9)).toBe(790);
    expect(toMinorUnits(11.9)).toBe(1190);
  });

  it("handles zero", () => {
    expect(toMinorUnits(0)).toBe(0);
  });

  it("handles floating-point imprecision correctly", () => {
    // 0.1 + 0.2 = 0.30000000000000004 in JS — must round to 30
    expect(toMinorUnits(0.1 + 0.2)).toBe(30);
  });
});

describe("fromMinorUnits", () => {
  it("converts sen back to MYR", () => {
    expect(fromMinorUnits(1390)).toBe(13.9);
    expect(fromMinorUnits(0)).toBe(0);
    expect(fromMinorUnits(500)).toBe(5);
  });
});

describe("formatMYR", () => {
  it("formats sen as a currency string containing the numeric value", () => {
    const result = formatMYR(1390);
    // Intl may render as "MYR 13.90" or "RM 13.90" depending on locale
    expect(result).toContain("13.90");
    // Must contain some currency indicator
    expect(result.match(/MYR|RM/)).toBeTruthy();
  });

  it("formats zero", () => {
    const result = formatMYR(0);
    expect(result).toContain("0.00");
  });

  it("is based on MYR currency", () => {
    // Verify the Intl formatter uses MYR regardless of symbol
    const myrFormatter = new Intl.NumberFormat("en-MY", {
      style: "currency",
      currency: "MYR",
    });
    expect(formatMYR(500)).toBe(myrFormatter.format(5.0));
  });
});
