import { describe, expect, it } from "vitest";
import {
  checkTitle,
  isDueDate,
  TITLE_REQUIRED,
  TITLE_TOO_LONG,
} from "@/lib/tasks/validate";

describe("checkTitle", () => {
  it("trims a valid title", () => {
    expect(checkTitle("  Buy milk  ")).toEqual({ ok: true, title: "Buy milk" });
  });
  it("rejects empty and whitespace-only", () => {
    expect(checkTitle("")).toEqual({ ok: false, error: TITLE_REQUIRED });
    expect(checkTitle("   ")).toEqual({ ok: false, error: TITLE_REQUIRED });
  });
  it("accepts exactly 200 characters, rejects 201", () => {
    expect(checkTitle("a".repeat(200)).ok).toBe(true);
    expect(checkTitle("a".repeat(201))).toEqual({ ok: false, error: TITLE_TOO_LONG });
  });
  it("counts code points, not UTF-16 units", () => {
    expect(checkTitle("😀".repeat(200)).ok).toBe(true);
    expect(checkTitle("😀".repeat(201)).ok).toBe(false);
  });
});

describe("isDueDate", () => {
  it("matches YYYY-MM-DD only", () => {
    expect(isDueDate("2026-01-31")).toBe(true);
    expect(isDueDate("2026-1-31")).toBe(false);
    expect(isDueDate("")).toBe(false);
    expect(isDueDate("2026-01-31T00:00")).toBe(false);
  });
});
