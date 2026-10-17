import { describe, expect, it } from "vitest";
import { rankBoard, solvePoints, type BoardEntry } from "@/lib/friends/points";
import { isValidUsername, normalizeUsername } from "@/lib/friends/username";
import { weekLabel, weekStart } from "@/lib/friends/week";

const entry = (over: Partial<BoardEntry> & { userId: string }): BoardEntry => ({
  name: over.userId,
  username: over.userId,
  image: null,
  points: 0,
  solves: 0,
  activeDays: 0,
  platforms: {},
  ...over,
});

describe("solvePoints", () => {
  it("is the band, or 1 when unrated", () => {
    expect(solvePoints(null)).toBe(1);
    expect(solvePoints(1)).toBe(1);
    expect(solvePoints(5)).toBe(5);
  });
});

describe("rankBoard", () => {
  it("ranks by points, solves, active days, then name", () => {
    const ranked = rankBoard([
      entry({ userId: "d", name: "Zed", points: 5, solves: 2, activeDays: 1 }),
      entry({ userId: "c", name: "Bea", points: 5, solves: 2, activeDays: 1 }),
      entry({ userId: "b", points: 5, solves: 2, activeDays: 2 }),
      entry({ userId: "a", points: 5, solves: 3 }),
      entry({ userId: "e", points: 9, solves: 1 }),
    ]);
    expect(ranked.map((r) => r.userId)).toEqual(["e", "a", "b", "c", "d"]);
    expect(ranked.map((r) => r.rank)).toEqual([1, 2, 3, 4, 5]);
  });
});

describe("week", () => {
  it("starts on Monday 00:00 UTC", () => {
    expect(weekStart(new Date("2026-10-17T15:30:00Z")).toISOString()).toBe(
      "2026-10-12T00:00:00.000Z",
    );
    expect(weekStart(new Date("2026-10-12T00:00:00Z")).toISOString()).toBe(
      "2026-10-12T00:00:00.000Z",
    );
    expect(weekStart(new Date("2026-10-18T23:59:59Z")).toISOString()).toBe(
      "2026-10-12T00:00:00.000Z",
    );
  });
  it("labels Monday to Sunday", () => {
    expect(weekLabel(new Date("2026-10-17T15:30:00Z"))).toBe("Mon 12 Oct to Sun 18 Oct");
  });
});

describe("username", () => {
  it("normalizes", () => {
    expect(normalizeUsername("  @Anvi_K ")).toBe("anvi_k");
  });
  it("validates", () => {
    expect(isValidUsername("anvi_k")).toBe(true);
    expect(isValidUsername("a")).toBe(false);
    expect(isValidUsername("has space")).toBe(false);
    expect(isValidUsername("a".repeat(40))).toBe(false);
  });
});
