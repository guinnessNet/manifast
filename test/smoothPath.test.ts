import { describe, it, expect } from "vitest";
import { smoothPath } from "../src/web/lib/smoothPath";

describe("smoothPath", () => {
  it("returns empty for fewer than 2 points", () => {
    expect(smoothPath([])).toBe("");
    expect(smoothPath([{ x: 1, y: 2 }])).toBe("");
  });

  it("draws a straight line (L) for exactly 2 points", () => {
    expect(smoothPath([{ x: 0, y: 0 }, { x: 10, y: 20 }])).toBe("M0,0 L10,20");
  });

  it("draws a cubic bezier chain (C) for 3+ points", () => {
    const d = smoothPath([{ x: 0, y: 0 }, { x: 10, y: 10 }, { x: 20, y: 0 }]);
    expect(d.startsWith("M0,0")).toBe(true);
    expect((d.match(/C/g) ?? []).length).toBe(2); // one C segment per gap
    expect(d).not.toContain("L");
  });

  it("preserves the first and last endpoints exactly", () => {
    const pts = [{ x: 3, y: 4 }, { x: 11, y: 9 }, { x: 25, y: 1 }, { x: 40, y: 7 }];
    const d = smoothPath(pts);
    expect(d.startsWith("M3,4")).toBe(true);
    expect(d.trimEnd().endsWith("40,7")).toBe(true);
  });
});
