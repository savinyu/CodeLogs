import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import {
  basePermission,
  buildUpload,
  LOGN_ORIGIN,
  collectAcceptedDates,
  isAllowedBase,
  normalizeBaseUrl,
  parseProblemsAll,
} from "../extension/lib/leetcode.js";
import { loadFixture } from "./helpers/mock-http";

const sample = loadFixture("leetcode/problems-all-sample.json");
const loggedOut = loadFixture("leetcode/problems-all-logged-out.json");
const { pages } = loadFixture<{ pages: unknown[] }>("leetcode/submissions-page-sample.json");

describe("parseProblemsAll", () => {
  it("returns solved slugs only", () => {
    const r = parseProblemsAll(sample);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.userName).toBe("CptDailyBird");
    expect(r.slugs).toContain("two-sum");
    expect(r.slugs.length).toBe(r.numSolved);
  });
  it("rejects logged-out and malformed input", () => {
    expect(parseProblemsAll(loggedOut).ok).toBe(false);
    expect(parseProblemsAll(null).ok).toBe(false);
    expect(parseProblemsAll({ user_name: "a" }).ok).toBe(false);
  });
  it("dedupes slugs and skips non-ac", () => {
    const pair = (slug: string, status: string | null) => ({
      status,
      stat: { question__title_slug: slug },
    });
    const r = parseProblemsAll({
      user_name: "a",
      stat_status_pairs: [pair("x", "ac"), pair("x", "ac"), pair("y", "notac"), pair("z", null)],
    });
    expect(r.ok && r.slugs).toEqual(["x"]);
  });
});

describe("collectAcceptedDates", () => {
  it("keeps the earliest Accepted per slug, handles string timestamps, ignores others", () => {
    const m = collectAcceptedDates(pages);
    expect(m.get("two-sum")).toBe(1700000000);
    expect(m.get("add-two-numbers")).toBe(1710000000);
    expect(m.size).toBe(3);
  });
  it("accumulates into an existing map and survives garbage", () => {
    const into = new Map([["two-sum", 5]]);
    collectAcceptedDates([null, { submissions_dump: "x" }, ...pages], into);
    expect(into.get("two-sum")).toBe(5);
  });
});

describe("buildUpload", () => {
  it("includes every solved slug once, dates from the map, ignores unsolved dates", () => {
    const dates = collectAcceptedDates(pages);
    const body = buildUpload("me", ["two-sum", "add-two-numbers", "two-sum", "other"], dates);
    expect(body).toEqual({
      userName: "me",
      solves: [
        { slug: "two-sum", solvedAt: 1700000000 },
        { slug: "add-two-numbers", solvedAt: 1710000000 },
        { slug: "other", solvedAt: null },
      ],
    });
  });
  it("works without dates and drops invalid slugs", () => {
    expect(buildUpload("me", ["a", "Bad Slug"]).solves).toEqual([{ slug: "a", solvedAt: null }]);
  });
});

describe("normalizeBaseUrl", () => {
  it("accepts https and localhost, drops path and trailing slash", () => {
    expect(normalizeBaseUrl("https://x.vercel.app/foo")).toBe("https://x.vercel.app");
    expect(normalizeBaseUrl(" http://localhost:3000/ ")).toBe("http://localhost:3000");
  });
  it("rejects everything else", () => {
    for (const bad of [
      "http://evil.com",
      "javascript:alert(1)",
      "",
      "nonsense",
      "https://u:p@x.com",
    ]) {
      expect(normalizeBaseUrl(bad)).toBeNull();
    }
  });
});

describe("isAllowedBase", () => {
  it("allows the hosted LogN and localhost on any port, nothing else", () => {
    expect(isAllowedBase(LOGN_ORIGIN)).toBe(true);
    expect(isAllowedBase("http://localhost:3000")).toBe(true);
    expect(isAllowedBase("http://localhost:4000")).toBe(true);
    expect(isAllowedBase("https://x.vercel.app")).toBe(false);
    expect(isAllowedBase("https://logn.techsavy.space.evil.com")).toBe(false);
  });
});

describe("basePermission", () => {
  it("asks for the hosted origin, or every localhost port", () => {
    expect(basePermission(LOGN_ORIGIN)).toBe(`${LOGN_ORIGIN}/*`);
    expect(basePermission("http://localhost:3000")).toBe("http://localhost/*");
  });
});

describe("manifest", () => {
  const manifest = JSON.parse(
    readFileSync(fileURLToPath(new URL("../extension/manifest.json", import.meta.url)), "utf8"),
  ) as { host_permissions: string[]; optional_host_permissions: string[] };

  it("grants the hosted LogN and no wildcard hosts", () => {
    expect(manifest.host_permissions).toContain(basePermission(LOGN_ORIGIN));
    expect(manifest.optional_host_permissions).toContain(basePermission("http://localhost:3000"));
    for (const p of [...manifest.host_permissions, ...manifest.optional_host_permissions]) {
      expect(p).not.toMatch(/^\w+:\/\/\*|<all_urls>/);
    }
  });
});
