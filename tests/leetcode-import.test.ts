import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { parseLeetcodeImportText, parseLeetcodeProblemsAll } from "@/lib/leetcode-import";

const raw = (name: string): string => readFileSync(`fixtures/leetcode/${name}`, "utf8");
const fixture = (name: string): unknown => JSON.parse(raw(name));

const SAMPLE_SLUGS = [
  "two-sum",
  "add-two-numbers",
  "median-of-two-sorted-arrays",
  "binary-tree-upside-down",
];

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

describe("parseLeetcodeImportText", () => {
  const expectSample = (text: string) => {
    const r = parseLeetcodeImportText(text);
    expect(r.ok && r.slugs).toEqual(SAMPLE_SLUGS);
  };

  it("reads the raw JSON", () => {
    expectSample(raw("problems-all-sample.json"));
  });

  // Captured from Chrome's JSON viewer (headless --dump-dom); one title has & < > and quotes.
  it("reads the HTML page Chrome saves, decoding entities", () => {
    const html = raw("problems-all-chrome-saved.html");
    expect(html).toContain("&amp; &lt;More&gt;");
    expectSample(html);
  });

  it("reads text copied from Chrome's viewer with the Pretty-print label", () => {
    expectSample(`Pretty-print \u2610\n${raw("problems-all-sample.json")}\n`);
  });

  it("reads a file with a byte order mark", () => {
    expectSample(`\ufeff${raw("problems-all-sample.json")}`);
  });

  it("reads HTML whose JSON isn't in a <pre>, ignoring styles", () => {
    const json = raw("problems-all-sample.json").replaceAll("&", "&amp;");
    expectSample(
      `<html><head><style>body { margin: 0 }</style></head><body><div>${json}</div></body></html>`,
    );
  });

  it("reports a logged-out page, not a generic error", () => {
    const r = parseLeetcodeImportText(raw("problems-all-logged-out.json"));
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toMatch(/logged in/);
  });

  it.each(["", "hello", "<html><body>Sign in</body></html>", "{not json}", "[1, 2]"])(
    "rejects %j",
    (text) => {
      const r = parseLeetcodeImportText(text);
      expect(r.ok).toBe(false);
      if (!r.ok) expect(r.error).toMatch(/api\/problems\/all/);
    },
  );
});
