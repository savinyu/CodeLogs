import { describe, expect, it } from "vitest";
import {
  activityStats,
  buildHeatmapGrid,
  heatLevel,
  heatThresholds,
} from "../lib/dashboard/heatmap";
import type { ActivityDay } from "../lib/dashboard/types";

const day = (d: string, total: number): ActivityDay => ({
  day: d,
  total,
  counts: { leetcode: total },
});

describe("buildHeatmapGrid", () => {
  const asOf = "2026-10-13"; // Tuesday
  const { weeks, months } = buildHeatmapGrid([day("2026-10-08", 4)], asOf);

  it("has 7-slot Sunday-start columns and ends with the week containing asOf", () => {
    expect(weeks.every((w) => w.length === 7)).toBe(true);
    const last = weeks[weeks.length - 1]!;
    expect(last[2]?.day).toBe(asOf); // Sunday 11th, Monday 12th, Tuesday 13th
    expect(last[0]?.day).toBe("2026-10-11");
    expect(last.slice(3).every((c) => c === null)).toBe(true);
  });

  it("covers exactly the 365-day window, nulling cells outside it", () => {
    const cells = weeks.flat().filter((c) => c !== null);
    expect(cells).toHaveLength(365);
    expect(cells[0]?.day).toBe("2025-10-14");
    expect(weeks[0]![0]).toBeNull(); // 2025-10-14 is a Tuesday
    expect(weeks[0]![2]?.day).toBe("2025-10-14");
  });

  it("fills activity into cells", () => {
    const cell = weeks.flat().find((c) => c?.day === "2026-10-08");
    expect(cell).toMatchObject({ total: 4, level: 4 });
  });

  it("labels months with at least 3 weeks between labels", () => {
    expect(months.map((m) => m.label)).toContain("Oct");
    for (let i = 1; i < months.length; i++) {
      expect(months[i]!.weekIndex - months[i - 1]!.weekIndex).toBeGreaterThanOrEqual(3);
    }
    const oct = months[months.length - 1]!;
    expect(oct.label).toBe("Oct");
    expect(weeks[oct.weekIndex]!.some((c) => c?.day === "2026-10-01")).toBe(true);
  });
});

describe("heat levels", () => {
  it("maps zero to 0, nonzero to at least 1 and the max to 4", () => {
    const act = [1, 1, 2, 3, 5, 8, 13, 18].map((t, i) => day(`2026-01-0${i + 1}`, t));
    const th = heatThresholds(act);
    expect(heatLevel(0, th)).toBe(0);
    expect(heatLevel(1, th)).toBe(1);
    expect(heatLevel(18, th)).toBe(4);
    const levels = act.map((a) => heatLevel(a.total, th));
    expect(new Set(levels).size).toBeGreaterThanOrEqual(3);
    expect(levels).toEqual([...levels].sort());
  });

  it("spreads small and large distributions alike", () => {
    const small = [1, 1, 1, 2, 2, 3].map((t, i) => day(`2026-01-0${i + 1}`, t));
    const th = heatThresholds(small);
    expect(heatLevel(1, th)).toBe(1);
    expect(heatLevel(3, th)).toBe(4);
  });

  it("handles no activity", () => {
    expect(heatLevel(0, heatThresholds([]))).toBe(0);
  });
});

describe("activityStats", () => {
  const act = [
    day("2026-10-01", 2),
    day("2026-10-02", 1),
    day("2026-10-03", 3),
    day("2026-10-10", 1),
    day("2026-10-11", 1),
    day("2026-10-12", 5),
  ];

  it("counts days, totals and longest streak", () => {
    const s = activityStats(act, "2026-10-13");
    expect(s).toMatchObject({ activeDays: 6, total: 13, longestStreak: 3 });
  });

  it("keeps the streak alive when today has no activity yet", () => {
    expect(activityStats(act, "2026-10-13").currentStreak).toBe(3);
    expect(activityStats([...act, day("2026-10-13", 1)], "2026-10-13").currentStreak).toBe(4);
  });

  it("resets when a full day is missed", () => {
    expect(activityStats(act, "2026-10-14").currentStreak).toBe(0);
  });

  it("handles empty activity", () => {
    expect(activityStats([], "2026-10-13")).toEqual({
      activeDays: 0,
      total: 0,
      currentStreak: 0,
      longestStreak: 0,
    });
  });
});
