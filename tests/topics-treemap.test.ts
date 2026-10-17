import { describe, expect, it } from "vitest";
import { squarify } from "@/lib/topics/treemap";

const items = [34, 21, 13, 8, 8, 5, 3, 2, 1].map((value, i) => ({ item: `t${i}`, value }));

describe("squarify", () => {
  const rects = squarify(items, 100, 54);

  it("returns one rect per item inside the box", () => {
    expect(rects).toHaveLength(items.length);
    for (const r of rects) {
      expect(r.x).toBeGreaterThanOrEqual(-1e-9);
      expect(r.y).toBeGreaterThanOrEqual(-1e-9);
      expect(r.x + r.w).toBeLessThanOrEqual(100 + 1e-9);
      expect(r.y + r.h).toBeLessThanOrEqual(54 + 1e-9);
    }
  });

  it("makes areas proportional to values and fills the box", () => {
    const total = items.reduce((a, i) => a + i.value, 0);
    let area = 0;
    for (const r of rects) {
      const value = items.find((i) => i.item === r.item)!.value;
      expect((r.w * r.h) / (100 * 54)).toBeCloseTo(value / total, 6);
      area += r.w * r.h;
    }
    expect(area).toBeCloseTo(100 * 54, 6);
  });

  it("has no overlaps", () => {
    for (const [i, a] of rects.entries()) {
      for (const b of rects.slice(i + 1)) {
        const ox = Math.min(a.x + a.w, b.x + b.w) - Math.max(a.x, b.x);
        const oy = Math.min(a.y + a.h, b.y + b.h) - Math.max(a.y, b.y);
        expect(ox > 1e-9 && oy > 1e-9).toBe(false);
      }
    }
  });

  it("is deterministic", () => {
    expect(squarify(items, 100, 54)).toEqual(rects);
  });

  it("gives zero-value items a minimum tile", () => {
    const out = squarify(
      [
        { item: "a", value: 50 },
        { item: "b", value: 0 },
      ],
      100,
      40,
    );
    const b = out.find((r) => r.item === "b")!;
    expect(b.w * b.h).toBeGreaterThan(0);
  });

  it("handles all-zero and empty input", () => {
    expect(squarify([], 100, 40)).toEqual([]);
    const out = squarify(
      [
        { item: "a", value: 0 },
        { item: "b", value: 0 },
      ],
      100,
      40,
    );
    expect(out.reduce((n, r) => n + r.w * r.h, 0)).toBeCloseTo(4000, 6);
  });
});
