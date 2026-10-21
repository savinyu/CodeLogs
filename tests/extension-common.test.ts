import { describe, expect, it } from "vitest";
import {
  PROBLEM_HOSTS,
  buildPlatformUpload,
  cleanIdentity,
  expectData,
  isProblemUrl,
  istToEpoch,
  pickString,
  stripTags,
  toCount,
  toEpochSeconds,
  utcDay,
  ReaderError,
} from "../extension/lib/common.js";
import { describeLeetcodeResult, describePlatformResult } from "../extension/lib/describe.js";
import { SYNC_PLATFORMS } from "../extension/lib/registry.js";
import { PROBLEM_HOSTS as SERVER_HOSTS, extensionUploadSchema } from "@/lib/extension-upload";
import { PLATFORM_ORDER } from "@/lib/platforms";
import manifest from "../extension/manifest.json";

describe("extension manifest", () => {
  it("is MV3 CodeLogs 0.3.4 with scripting, alarms and the platform hosts optional", () => {
    expect(manifest.manifest_version).toBe(3);
    expect(manifest.name).toBe("CodeLogs");
    expect(manifest.version).toBe("0.3.4");
    expect(manifest.permissions).toEqual(
      expect.arrayContaining(["storage", "scripting", "alarms"]),
    );
    for (const p of SYNC_PLATFORMS.filter((p) => p.kind === "page")) {
      for (const origin of p.permissions) {
        expect(manifest.optional_host_permissions).toContain(origin);
        expect(manifest.host_permissions).not.toContain(origin);
      }
    }
    expect(manifest.host_permissions).toContain("https://leetcode.com/*");
  });
  it("lists the platforms in the site's order", () => {
    const ids = SYNC_PLATFORMS.map((p) => p.id);
    expect(ids).toEqual(PLATFORM_ORDER.filter((id) => ids.includes(id as never)));
  });
});

describe("PROBLEM_HOSTS", () => {
  it("matches the server's allowed hosts", () => {
    expect(PROBLEM_HOSTS).toEqual(SERVER_HOSTS);
  });
  it("checks scheme and host", () => {
    expect(isProblemUrl("gfg", "https://www.geeksforgeeks.org/problems/x")).toBe(true);
    expect(isProblemUrl("gfg", "http://www.geeksforgeeks.org/problems/x")).toBe(false);
    expect(isProblemUrl("gfg", "https://evil.example/problems/x")).toBe(false);
    expect(isProblemUrl("gfg", "nonsense")).toBe(false);
    expect(isProblemUrl("unknown", "https://www.geeksforgeeks.org/")).toBe(false);
  });
});

describe("istToEpoch", () => {
  it("converts India time to epoch seconds", () => {
    // 2023-12-25 23:45 IST = 18:15 UTC
    expect(istToEpoch(2023, 12, 25, 23, 45)).toBe(Date.UTC(2023, 11, 25, 18, 15) / 1000);
    // just after midnight IST lands on the previous UTC day
    expect(utcDay(istToEpoch(2025, 3, 18, 0, 30, 33) ?? 0)).toBe("2025-03-17");
  });
  it("rejects impossible dates", () => {
    expect(istToEpoch(2023, 13, 1)).toBeNull();
    expect(istToEpoch(2023, 1, 1, 25)).toBeNull();
  });
});

describe("toEpochSeconds", () => {
  it("reads seconds, milliseconds and ISO strings", () => {
    expect(toEpochSeconds(1700000000)).toBe(1700000000);
    expect(toEpochSeconds("1700000000")).toBe(1700000000);
    expect(toEpochSeconds(1700000000000)).toBe(1700000000);
    expect(toEpochSeconds("2024-03-05T04:50:30.000Z")).toBe(1709614230);
  });
  it("leaves relative text and junk undated", () => {
    expect(toEpochSeconds("2 hours ago")).toBeNull();
    expect(toEpochSeconds(null)).toBeNull();
    expect(toEpochSeconds(-5)).toBeNull();
    expect(toEpochSeconds("")).toBeNull();
  });
});

describe("cleanIdentity", () => {
  it("accepts handles and ids", () => {
    expect(cleanIdentity("some_hacker")).toBe("some_hacker");
    expect(cleanIdentity(" a1b2-c3 ")).toBe("a1b2-c3");
    expect(cleanIdentity(12345)).toBe("12345");
  });
  it("drops anything that looks like an email, token or object", () => {
    expect(cleanIdentity("me@example.com")).toBeNull();
    expect(cleanIdentity("x".repeat(65))).toBeNull();
    expect(cleanIdentity("two words")).toBeNull();
    expect(cleanIdentity("")).toBeNull();
    expect(cleanIdentity(null)).toBeNull();
    expect(cleanIdentity({ username: "a" })).toBeNull();
  });
});

describe("small helpers", () => {
  it("pickString walks a path", () => {
    expect(pickString({ a: { b: "x" } }, ["a", "b"])).toBe("x");
    expect(pickString({ a: { b: 7 } }, ["a", "b"])).toBe("7");
    expect(pickString({ a: [] }, ["a", "b"])).toBeNull();
    expect(pickString({ a: { b: null } }, ["a", "b"])).toBeNull();
  });
  it("toCount keeps non-negative integers", () => {
    expect(toCount("12")).toBe(12);
    expect(toCount(3.9)).toBe(3);
    expect(toCount(-1)).toBeNull();
    expect(toCount("x")).toBeNull();
  });
  it("stripTags decodes entities and collapses space", () => {
    expect(stripTags("<b>Life,&nbsp;the</b>  &amp; <i>more</i>")).toBe("Life, the & more");
  });
  it("expectData throws short human errors", () => {
    expect(() => expectData("Foo", { status: 401, data: null }, "x")).toThrow(/Log in to Foo/);
    expect(() => expectData("Foo", { status: 500, data: null }, "x")).toThrow(/HTTP 500/);
    expect(() => expectData("Foo", { status: 200, data: null }, "x")).toThrow(ReaderError);
    expect(expectData("Foo", { status: 200, data: { a: 1 } }, "x")).toEqual({ a: 1 });
  });
});

describe("buildPlatformUpload", () => {
  const base = { platform: "gfg", loggedInAs: "me" };
  const solve = (id: string, solvedAt: number | null, extra = {}) => ({
    id,
    title: `Title ${id}`,
    url: `https://www.geeksforgeeks.org/problems/${id}`,
    difficulty: "Easy",
    tags: [],
    solvedAt,
    ...extra,
  });

  it("dedupes by id and keeps the earliest date", () => {
    const out = buildPlatformUpload({
      ...base,
      solves: [
        solve("a", 200),
        solve("a", 100),
        solve("a", null),
        solve("b", null),
        solve("b", 50),
      ],
      listComplete: true,
    });
    expect(out.solves.map((s) => [s.id, s.solvedAt])).toEqual([
      ["a", 100],
      ["b", 50],
    ]);
    expect(out.listComplete).toBe(true);
  });
  it("drops solves with a URL off the platform's hosts or not https", () => {
    const out = buildPlatformUpload({
      ...base,
      solves: [
        solve("ok", 1),
        solve("bad", 1, { url: "https://evil.example/x" }),
        solve("http", 1, { url: "http://www.geeksforgeeks.org/problems/http" }),
      ],
    });
    expect(out.solves.map((s) => s.id)).toEqual(["ok"]);
  });
  it("cleans counts, tags and activity", () => {
    const out = buildPlatformUpload({
      ...base,
      counts: { total: 5, byDifficulty: { Easy: 3, "": 1, Bad: -2 } },
      solves: [solve("a", 1, { tags: ["x", "x", " y ", 4, ""] })],
      activity: [
        { day: "2024-01-02", count: 2 },
        { day: "2024-01-01", count: 0 },
        { day: "bad", count: 1 },
        { day: "2023-12-31", count: 1 },
      ],
    });
    expect(out.counts).toEqual({ total: 5, byDifficulty: { Easy: 3 } });
    expect(out.solves[0]?.tags).toEqual(["x", "y"]);
    expect(out.activity).toEqual([
      { day: "2023-12-31", count: 1 },
      { day: "2024-01-02", count: 2 },
    ]);
  });
  it("gives counts null when the total is missing, and passes the server schema", () => {
    const out = buildPlatformUpload({ ...base, counts: null, solves: [], activity: [] });
    expect(out.counts).toBeNull();
    expect(extensionUploadSchema.safeParse(out).success).toBe(true);
  });
});

describe("result lines", () => {
  it("describes a platform sync", () => {
    expect(
      describePlatformResult({
        handle: "me",
        verified: true,
        imported: 12,
        listed: 170,
        total: 170,
      }),
    ).toBe("Synced 170 problems (12 new). Verified as @me.");
    expect(
      describePlatformResult({ handle: "me", verified: false, created: true, total: 575 }),
    ).toBe("Synced your solved count (575). Connected @me.");
    expect(describePlatformResult({ handle: "me", verified: false, listed: 1, imported: 0 })).toBe(
      "Synced 1 problem (0 new). Not verified as @me.",
    );
    expect(describePlatformResult({ handle: "me", verified: true, listed: 0, total: 0 })).toBe(
      "Synced. No solved problems there yet. Verified as @me.",
    );
  });
  it("describes a LeetCode sync like before", () => {
    expect(
      describeLeetcodeResult({ imported: 2, alreadyKnown: 5, complete: true, datesFilled: 3 }),
    ).toBe("Imported 2 new, 5 already known, dates filled for 3. History complete.");
  });
});
