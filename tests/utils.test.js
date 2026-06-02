import { describe, it, expect } from "vitest";
import Utils from "../js/utils.js";

describe("normalizeString", () => {
  it("lowercases, strips accents and trims", () => {
    expect(Utils.normalizeString("  Crème Fraîche ")).toBe("creme fraiche");
    expect(Utils.normalizeString("ŒUF")).toBe("œuf".normalize("NFD").replace(/[̀-ͯ]/g, ""));
  });
  it("handles null/undefined", () => {
    expect(Utils.normalizeString(null)).toBe("");
    expect(Utils.normalizeString(undefined)).toBe("");
  });
});

describe("escapeHTML", () => {
  it("escapes HTML-significant characters", () => {
    expect(Utils.escapeHTML('<img src=x onerror="a">')).toBe(
      "&lt;img src=x onerror=&quot;a&quot;&gt;"
    );
    expect(Utils.escapeHTML("a & b")).toBe("a &amp; b");
  });
  it("coerces null to empty string", () => {
    expect(Utils.escapeHTML(null)).toBe("");
  });
});

describe("nutrition calculations", () => {
  it("computes Mifflin-St Jeor BMR", () => {
    // M: 10*75 + 6.25*180 - 5*30 + 5 = 1730
    expect(Utils.calculateBMR(75, 180, 30, "M")).toBe(1730);
    // F: same - 161 - 5 ... base 1725, F => 1725 - 161 = 1564
    expect(Utils.calculateBMR(75, 180, 30, "F")).toBe(1564);
  });
  it("applies activity multiplier for TDEE", () => {
    expect(Utils.calculateTDEE(2000, "Modéré")).toBe(3100);
    expect(Utils.calculateTDEE(2000, "Sédentaire")).toBe(2400);
  });
  it("applies objective offset", () => {
    expect(Utils.calculateObjectiveCalories(2000, "Perte modérée")).toBe(1500);
    expect(Utils.calculateObjectiveCalories(2000, "Maintien")).toBe(2000);
  });
});

describe("expiry helpers", () => {
  it("flags past dates as expired", () => {
    expect(Utils.isExpired("2000-01-01")).toBe(true);
  });
});
