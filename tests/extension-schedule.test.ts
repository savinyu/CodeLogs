import { describe, expect, it } from "vitest";
import { oldestSubmissionTime, parseProblemsAll } from "../extension/lib/leetcode.js";
import { SYNC_PLATFORMS } from "../extension/lib/registry.js";
import {
  DAILY_INTERVAL_MS,
  VISIT_INTERVAL_MS,
  VISIT_RETRY_MS,
  isDue,
  leetcodeDatesSince,
  nextRun,
  platformForUrl,
  type RunRecord,
} from "../extension/lib/schedule.js";
import { loadFixture } from "./helpers/mock-http";

const NOW = Date.UTC(2026, 9, 19, 12);
const HOUR = 3_600_000;

function run(over: Partial<RunRecord>): RunRecord {
  return { at: NOW, okAt: NOW, ok: true, loggedOut: false, auto: true, text: "", ...over };
}

describe("isDue", () => {
  it("is due with no run yet", () => {
    expect(isDue(undefined, NOW, VISIT_INTERVAL_MS, VISIT_RETRY_MS)).toBe(true);
  });

  it("waits for the interval after a success", () => {
    const r = run({ at: NOW - 5 * HOUR, okAt: NOW - 5 * HOUR });
    expect(isDue(r, NOW, VISIT_INTERVAL_MS, VISIT_RETRY_MS)).toBe(false);
    expect(isDue(r, NOW + HOUR, VISIT_INTERVAL_MS, VISIT_RETRY_MS)).toBe(true);
  });

  it("retries a failure after the retry delay, not the full interval", () => {
    const r = run({ at: NOW - 5 * 60_000, okAt: null, ok: false, loggedOut: true });
    expect(isDue(r, NOW, VISIT_INTERVAL_MS, VISIT_RETRY_MS)).toBe(false);
    expect(isDue(r, NOW + 5 * 60_000, VISIT_INTERVAL_MS, VISIT_RETRY_MS)).toBe(true);
  });

  it("an old success with a recent failed attempt waits for the retry delay", () => {
    const r = run({ at: NOW - 60_000, okAt: NOW - 30 * HOUR, ok: false });
    expect(isDue(r, NOW, DAILY_INTERVAL_MS, HOUR)).toBe(false);
  });
});

describe("nextRun", () => {
  it("keeps the last success time when a run fails", () => {
    const prev = run({ okAt: NOW - HOUR });
    const next = nextRun(prev, { now: NOW, ok: false, loggedOut: true, auto: true, text: "x" });
    expect(next).toMatchObject({ at: NOW, okAt: NOW - HOUR, ok: false, loggedOut: true });
    expect(nextRun(undefined, { now: NOW, ok: true, auto: false, text: "y" })).toMatchObject({
      okAt: NOW,
      loggedOut: false,
    });
  });
});

describe("platformForUrl", () => {
  const id = (url: string) => platformForUrl(url, SYNC_PLATFORMS)?.id ?? null;

  it("maps each platform's pages", () => {
    expect(id("https://leetcode.com/problems/two-sum/")).toBe("leetcode");
    expect(id("https://www.codechef.com/practice")).toBe("codechef");
    expect(id("https://www.hackerrank.com/dashboard")).toBe("hackerrank");
    expect(id("https://www.interviewbit.com/practice/")).toBe("interviewbit");
    expect(id("https://www.geeksforgeeks.org/problems/x/1")).toBe("gfg");
    expect(id("https://www.naukri.com/code360/problems/x")).toBe("code360");
  });

  it("ignores naukri.com outside Code360, look-alike hosts and CodeLogs itself", () => {
    expect(id("https://www.naukri.com/jobs-in-pune")).toBeNull();
    expect(id("https://leetcode.com.evil.example/")).toBeNull();
    expect(id("http://localhost:3000/extension/connect")).toBeNull();
    expect(platformForUrl(undefined, SYNC_PLATFORMS)).toBeNull();
  });
});

describe("LeetCode automatic sync", () => {
  it("flags a logged-out problems list", () => {
    const r = parseProblemsAll(loadFixture("leetcode/problems-all-logged-out.json"));
    expect(r).toMatchObject({ ok: false, loggedOut: true });
  });

  it("walks dates back to a day before the last success, or all of them", () => {
    expect(leetcodeDatesSince(undefined)).toBeNull();
    expect(leetcodeDatesSince(run({ okAt: null }))).toBeNull();
    expect(leetcodeDatesSince(run({ okAt: NOW }))).toBe((NOW - DAILY_INTERVAL_MS) / 1000);
  });

  it("finds the oldest submission on a page", () => {
    const page = {
      submissions_dump: [{ timestamp: 1700000300 }, { timestamp: "1700000100" }, { timestamp: 0 }],
    };
    expect(oldestSubmissionTime(page)).toBe(1700000100);
    expect(oldestSubmissionTime({ submissions_dump: [] })).toBeNull();
    expect(oldestSubmissionTime(null)).toBeNull();
  });
});
