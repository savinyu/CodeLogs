import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { parseLeetcodeProblemsAll } from "@/lib/leetcode-import";

const fixture = (name: string): unknown =>
  JSON.parse(readFileSync(`fixtures/leetcode/${name}`, "utf8"));

describe("parseLeetcodeProblemsAll", () => {
  it("keeps only accepted problems, deduped", () => {
    const r = parseLeetcodeProblemsAll(fixture("problems-all-sample.json"));
    expect(r).toEqual({
      ok: true,
      userName: "CptDailyBird",
      slugs: [
        "two-sum",
        "add-two-numbers",
        "median-of-two-sorted-arrays",
        "binary-tree-upside-down",
      ],
      numSolved: 4,
    });
  });

  it("rejects a logged-out file", () => {
    const r = parseLeetcodeProblemsAll(fixture("problems-all-logged-out.json"));
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toMatch(/logged in/);
  });

  it.each([null, "text", 5, [], {}, { stat_status_pairs: "x" }])("rejects %j", (input) => {
    expect(parseLeetcodeProblemsAll(input).ok).toBe(false);
  });

  it("tolerates junk entries and missing fields", () => {
    const r = parseLeetcodeProblemsAll({
      user_name: "me",
      stat_status_pairs: [
        null,
        "x",
        { status: "ac" },
        { status: "ac", stat: { question__title_slug: 42 } },
        { status: "ac", stat: { question__title_slug: "ok" } },
      ],
    });
    expect(r).toEqual({ ok: true, userName: "me", slugs: ["ok"], numSolved: null });
  });
});
