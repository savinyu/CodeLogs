import { describe, expect, it } from "vitest";
import { todaySet } from "@/lib/today/set";
import { goalDone, goalProgress, weekStrip } from "@/lib/today/week";
import type { Recommendation, TopicPicks } from "@/lib/topics/recommend";

function rec(id: string, extra: Partial<Recommendation> = {}): Recommendation {
  return {
    platform: "codeforces",
    externalId: id,
    title: `Problem ${id}`,
    url: `https://example.com/${id}`,
    difficultyRaw: "1200",
    tags: [],
    maybeSolved: false,
    solvedToday: false,
    ...extra,
  };
}

function topic(slug: string, problems: Recommendation[]): TopicPicks {
  return {
    slug,
    name: slug,
    weak: true,
    focus: { slug: `${slug}-f`, name: `${slug} focus` },
    problems,
  } as unknown as TopicPicks;
}

describe("todaySet", () => {
  it("orders first picks, the weakest second pick, then the first maybe-solved pick", () => {
    const picks = [
      topic("a", [rec("a1"), rec("a2")]),
      topic("b", [rec("b1"), rec("b2")]),
      topic("c", [rec("c1"), rec("c2", { platform: "leetcode", maybeSolved: true })]),
    ];
    expect(todaySet(picks).map((p) => p.problem.externalId)).toEqual([
      "a1",
      "b1",
      "c1",
      "a2",
      "c2",
    ]);
  });

  it("drops duplicates by platform and id, and caps at the limit", () => {
    const lc = rec("x", { platform: "leetcode", maybeSolved: true });
    const picks = [topic("a", [lc, rec("a2")]), topic("b", [rec("b1")])];
    const ids = todaySet(picks).map((p) => `${p.problem.platform}:${p.problem.externalId}`);
    expect(ids).toEqual(["leetcode:x", "codeforces:b1", "codeforces:a2"]);
    expect(todaySet(picks, 2)).toHaveLength(2);
  });

  it("keeps the same id on different platforms", () => {
    const picks = [topic("a", [rec("1"), rec("1", { platform: "leetcode" })])];
    expect(todaySet(picks)).toHaveLength(2);
  });

  it("skips topics without picks and handles no topics", () => {
    expect(todaySet([])).toEqual([]);
    const picks = [topic("a", []), topic("b", [rec("b1")])];
    const set = todaySet(picks);
    expect(set).toHaveLength(1);
    expect(set[0]!.topic).toEqual({
      slug: "b",
      name: "b",
      focus: { slug: "b-f", name: "b focus" },
    });
  });
});

describe("weekStrip", () => {
  it("returns the 7 days ending at asOf, zero-filled", () => {
    const week = weekStrip(
      [
        { day: "2026-10-17", counts: {}, total: 3 },
        { day: "2026-10-14", counts: {}, total: 1 },
        { day: "2026-10-01", counts: {}, total: 9 },
      ],
      "2026-10-17",
    );
    expect(week.map((d) => d.day)).toEqual([
      "2026-10-11",
      "2026-10-12",
      "2026-10-13",
      "2026-10-14",
      "2026-10-15",
      "2026-10-16",
      "2026-10-17",
    ]);
    expect(week.map((d) => d.weekday)).toEqual(["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"]);
    expect(week.map((d) => d.total)).toEqual([0, 0, 0, 1, 0, 0, 3]);
    expect(week.filter((d) => d.isToday).map((d) => d.day)).toEqual(["2026-10-17"]);
  });

  it("crosses month and year boundaries", () => {
    const week = weekStrip([], "2027-01-02");
    expect(week[0]!.day).toBe("2026-12-27");
    expect(week[6]!.day).toBe("2027-01-02");
  });
});

describe("goalProgress", () => {
  it("reports progress below the goal", () => {
    expect(goalProgress(1, 3)).toEqual({ done: 1, goal: 3, fraction: 1 / 3, met: false });
  });
  it("is met at and above the goal, with the fraction capped at 1", () => {
    expect(goalProgress(3, 3).met).toBe(true);
    expect(goalProgress(5, 3)).toMatchObject({ done: 5, fraction: 1, met: true });
  });
  it("handles zero", () => {
    expect(goalProgress(0, 3)).toMatchObject({ fraction: 0, met: false });
  });
});

describe("goalDone", () => {
  it("adds marked picks to today's synced solves", () => {
    const picks = [
      { marked: true, solvedToday: false },
      { marked: false, solvedToday: false },
      { marked: true, solvedToday: false },
    ];
    expect(goalDone(1, picks)).toBe(3);
  });
  it("doesn't count a marked pick twice once it syncs as solved today", () => {
    expect(goalDone(1, [{ marked: true, solvedToday: true }])).toBe(1);
  });
});
