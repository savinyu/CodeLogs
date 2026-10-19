import { describe, expect, it } from "vitest";
import {
  activityYears,
  dashboardHref,
  parseActivityPeriod,
  shownTotals,
} from "../lib/dashboard/filters";
import type { AccountSummary, ActivityDay, PlatformTotal } from "../lib/dashboard/types";

const day = (d: string, total = 1): ActivityDay => ({ day: d, total, counts: {} });

describe("activityYears", () => {
  it("returns distinct years with activity, newest first", () => {
    const act = [day("2023-05-01"), day("2026-01-01"), day("2025-02-02"), day("2025-03-03")];
    expect(activityYears(act)).toEqual([2026, 2025, 2023]);
  });
  it("ignores zero-total days and handles empty input", () => {
    expect(activityYears([day("2024-01-01", 0)])).toEqual([]);
    expect(activityYears([])).toEqual([]);
  });
});

describe("parseActivityPeriod", () => {
  const years = [2026, 2025, 2023];
  it("accepts a year in the list", () => {
    expect(parseActivityPeriod("2025", years)).toBe(2025);
  });
  it("treats all as unknown and falls back to last12", () => {
    expect(parseActivityPeriod("all", years)).toBe("last12");
  });
  it("falls back to last12", () => {
    expect(parseActivityPeriod("2024", years)).toBe("last12");
    expect(parseActivityPeriod("abc", years)).toBe("last12");
    expect(parseActivityPeriod("2025abc", years)).toBe("last12");
    expect(parseActivityPeriod(undefined, years)).toBe("last12");
    expect(parseActivityPeriod(["2025"], years)).toBe("last12");
  });
});

describe("dashboardHref", () => {
  it("omits defaults", () => {
    expect(dashboardHref("/dashboard", { platform: "all", period: "last12" })).toBe("/dashboard");
  });
  it("combines platform and year", () => {
    expect(dashboardHref("/dashboard", { platform: "codeforces", period: "last12" })).toBe(
      "/dashboard?platform=codeforces",
    );
    expect(dashboardHref("/u/me", { platform: "all", period: 2025 })).toBe("/u/me?year=2025");
    expect(dashboardHref("/dashboard", { platform: "codeforces", period: 2025 })).toBe(
      "/dashboard?platform=codeforces&year=2025",
    );
  });
});

describe("shownTotals", () => {
  const total = (platform: PlatformTotal["platform"], solved: number): PlatformTotal => ({
    platform,
    solved,
    source: "tracked",
    listed: solved,
  });
  const account = (
    platform: AccountSummary["platform"],
    status: AccountSummary["status"],
  ): AccountSummary => ({
    platform,
    handle: "me",
    status,
    verified: true,
    historyComplete: true,
    lastSyncedAt: null,
  });
  const totals = [
    total("codeforces", 46),
    total("atcoder", 0),
    total("hackerrank", 0),
    total("gfg", 0),
    total("codechef", 0),
  ];
  const accounts = [
    account("codeforces", "ok"),
    account("atcoder", "ok"),
    account("hackerrank", "partial"),
    account("gfg", "pending"),
    account("codechef", "error"),
  ];

  it("hides confirmed zeros and keeps zeros that still have a status to show", () => {
    expect(shownTotals(totals, accounts, "all").map((t) => t.platform)).toEqual([
      "codeforces",
      "gfg",
      "codechef",
    ]);
  });
  it("always shows the filtered platform", () => {
    expect(shownTotals([total("atcoder", 0)], accounts, "atcoder")).toHaveLength(1);
  });
});
