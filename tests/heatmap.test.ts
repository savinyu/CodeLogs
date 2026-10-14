import { describe, expect, it } from "vitest";
import {
  activeDaysSummary,
  activityStats,
  buildHeatmapGrid,
  heatLevel,
  heatThresholds,
  periodRange,
} from "../lib/dashboard/heatmap";
import type { ActivityDay } from "../lib/dashboard/types";

const day = (d: string, total: number): ActivityDay => ({
  day: d,
  total,
  counts: { leetcode: total },
});

describe("buildHeatmapGrid", () => {
  const asOf = "2026-10-13"; // Tuesday
  const { weeks, months } = buildHeatmapGrid([day("2026-10-08", 4)], periodRange("last12", asOf));

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
    const s = activityStats(act, periodRange("last12", "2026-10-13"), "2026-10-13");
    expect(s).toMatchObject({ activeDays: 6, total: 13, longestStreak: 3 });
  });

  it("keeps the streak alive when today has no activity yet", () => {
    expect(
      activityStats(act, periodRange("last12", "2026-10-13"), "2026-10-13").currentStreak,
    ).toBe(3);
    expect(
      activityStats(
        [...act, day("2026-10-13", 1)],
        periodRange("last12", "2026-10-13"),
        "2026-10-13",
      ).currentStreak,
    ).toBe(4);
  });

  it("resets when a full day is missed", () => {
    expect(
      activityStats(act, periodRange("last12", "2026-10-14"), "2026-10-14").currentStreak,
    ).toBe(0);
  });

  it("handles empty activity", () => {
    expect(activityStats([], periodRange("last12", "2026-10-13"), "2026-10-13")).toEqual({
      activeDays: 0,
      total: 0,
      currentStreak: 0,
      longestStreak: 0,
    });
  });
});

describe("periodRange", () => {
  it("is the rolling 365 days for last12", () => {
    expect(periodRange("last12", "2026-10-13")).toEqual({ start: "2025-10-14", end: "2026-10-13" });
  });
  it("is the full calendar year for a past year and cut at asOf for the current one", () => {
    expect(periodRange(2025, "2026-10-13")).toEqual({ start: "2025-01-01", end: "2025-12-31" });
    expect(periodRange(2026, "2026-10-13")).toEqual({ start: "2026-01-01", end: "2026-10-13" });
  });
});

describe("year views", () => {
  const asOf = "2026-10-13";
  it("renders a full past year starting at Jan 1 with a Jan label", () => {
    const { weeks, months } = buildHeatmapGrid([day("2025-03-03", 2)], periodRange(2025, asOf));
    const cells = weeks.flat().filter((c) => c !== null);
    expect(cells).toHaveLength(365);
    expect(cells[0]?.day).toBe("2025-01-01");
    expect(cells[cells.length - 1]?.day).toBe("2025-12-31");
    expect(months[0]).toMatchObject({ weekIndex: 0, label: "Jan" });
  });

  it("cuts the current year at asOf", () => {
    const { weeks } = buildHeatmapGrid([], periodRange(2026, asOf));
    const cells = weeks.flat().filter((c) => c !== null);
    expect(cells[cells.length - 1]?.day).toBe(asOf);
    expect(cells).toHaveLength(286); // Jan 1 - Oct 13, 2026
  });

  it("computes thresholds only from in-range days", () => {
    const act = [day("2025-05-01", 1), day("2025-05-02", 2), day("2026-01-05", 100)];
    const { weeks } = buildHeatmapGrid(act, periodRange(2025, asOf));
    const level = (d: string) => weeks.flat().find((c) => c?.day === d)?.level;
    expect(level("2025-05-02")).toBe(4); // max within 2025, not 100
    expect(level("2025-05-01")).toBe(1);
    expect(weeks.flat().some((c) => c?.day === "2026-01-05")).toBe(false);
  });

  const act = [
    day("2025-12-30", 1),
    day("2025-12-31", 1),
    day("2026-01-01", 1),
    day("2026-01-02", 4),
    day("2026-10-12", 1),
    day("2026-10-13", 1),
  ];
  it("counts only in-range days and hides the current streak for a past year", () => {
    expect(activityStats(act, periodRange(2025, asOf), asOf)).toEqual({
      activeDays: 2,
      total: 2,
      currentStreak: null,
      longestStreak: 2,
    });
  });
  it("counts the current year in full with a current streak", () => {
    expect(activityStats(act, periodRange(2026, asOf), asOf)).toEqual({
      activeDays: 4,
      total: 7,
      currentStreak: 2,
      longestStreak: 2,
    });
  });
  it("lets the current streak reach before the range start", () => {
    const a = [day("2026-10-12", 1), day("2026-10-13", 1)];
    const s = activityStats(a, { start: "2026-10-13", end: asOf }, asOf);
    expect(s).toMatchObject({ activeDays: 1, currentStreak: 2, longestStreak: 1 });
  });
});

describe("activeDaysSummary", () => {
  const asOf = "2026-10-13"; // Tuesday
  const mixed = (d: string, counts: ActivityDay["counts"]): ActivityDay => ({
    day: d,
    counts,
    total: Object.values(counts).reduce((a, b) => a + (b ?? 0), 0),
  });

  it("counts period days inclusively", () => {
    expect(activeDaysSummary([], periodRange("last12", asOf), asOf).periodDays).toBe(365);
    expect(activeDaysSummary([], periodRange(2025, asOf), asOf).periodDays).toBe(365);
    expect(activeDaysSummary([], periodRange(2024, asOf), asOf).periodDays).toBe(366);
    expect(activeDaysSummary([], periodRange(2026, asOf), asOf).periodDays).toBe(286);
  });

  it("counts active days per platform inside the range", () => {
    const act = [
      mixed("2026-10-01", { codeforces: 2, leetcode: 1 }),
      mixed("2026-10-02", { leetcode: 3 }),
      mixed("2026-10-03", { atcoder: 0, leetcode: 0 }),
      mixed("2024-01-01", { codeforces: 5 }), // outside last12
    ];
    const s = activeDaysSummary(act, periodRange("last12", asOf), asOf);
    expect(s.byPlatform).toEqual({ codeforces: 1, leetcode: 2 });
    expect(s.activeDays).toBe(2);
  });

  it("finds the busiest weekday and breaks ties by the lower index", () => {
    // 2026-10-04 Sun, 10-05 Mon, 10-12 Mon, 10-11 Sun, 10-06 Tue
    const act = [day("2026-10-05", 1), day("2026-10-12", 1), day("2026-10-06", 1)];
    expect(activeDaysSummary(act, periodRange("last12", asOf), asOf).busiestWeekday).toBe(1);
    const tie = [day("2026-10-04", 1), day("2026-10-05", 1)];
    expect(activeDaysSummary(tie, periodRange("last12", asOf), asOf).busiestWeekday).toBe(0);
  });

  it("has a null weekday when empty", () => {
    const s = activeDaysSummary([], periodRange("last12", asOf), asOf);
    expect(s.busiestWeekday).toBeNull();
    expect(s.byPlatform).toEqual({});
  });

  it("passes streaks through from activityStats", () => {
    const act = [day("2026-10-11", 1), day("2026-10-12", 2), day("2026-10-13", 1)];
    const s = activeDaysSummary(act, periodRange("last12", asOf), asOf);
    expect(s).toMatchObject({ activeDays: 3, total: 4, currentStreak: 3, longestStreak: 3 });
    expect(activeDaysSummary(act, periodRange(2025, asOf), asOf).currentStreak).toBeNull();
  });
});
