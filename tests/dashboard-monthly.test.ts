import { describe, expect, it } from "vitest";
import { monthlyTotals } from "@/lib/dashboard/monthly";
import type { ActivityDay } from "@/lib/dashboard/types";

const day = (d: string, counts: ActivityDay["counts"]): ActivityDay => ({
  day: d,
  counts,
  total: Object.values(counts).reduce((a, b) => a + (b ?? 0), 0),
});

describe("monthlyTotals", () => {
  const asOf = "2026-10-17";

  it("returns 12 months, oldest first, ending with asOf's month", () => {
    const rows = monthlyTotals([], asOf);
    expect(rows).toHaveLength(12);
    expect(rows[0]).toMatchObject({ month: "2025-11", label: "Nov", hint: "Nov 2025", total: 0 });
    expect(rows[11]).toMatchObject({ month: "2026-10", label: "Oct", hint: "Oct 2026" });
    expect(rows.every((r) => r.total === 0 && Object.keys(r.counts).length === 0)).toBe(true);
  });

  it("sums per platform and keeps empty months", () => {
    const rows = monthlyTotals(
      [
        day("2026-10-01", { codeforces: 2, leetcode: 1 }),
        day("2026-10-16", { leetcode: 4 }),
        day("2026-08-30", { atcoder: 3 }),
      ],
      asOf,
    );
    expect(rows[11]).toMatchObject({ counts: { codeforces: 2, leetcode: 5 }, total: 7 });
    expect(rows[9]).toMatchObject({ month: "2026-08", counts: { atcoder: 3 }, total: 3 });
    expect(rows[10]?.total).toBe(0);
  });

  it("ignores days outside the window or after asOf", () => {
    const rows = monthlyTotals(
      [day("2025-10-31", { codeforces: 9 }), day("2026-10-20", { codeforces: 9 })],
      asOf,
    );
    expect(rows.reduce((n, r) => n + r.total, 0)).toBe(0);
  });

  it("crosses a year boundary and honours a custom length", () => {
    const rows = monthlyTotals([day("2026-01-05", { leetcode: 1 })], "2026-02-10", 3);
    expect(rows.map((r) => r.month)).toEqual(["2025-12", "2026-01", "2026-02"]);
    expect(rows[1]?.total).toBe(1);
  });
});
