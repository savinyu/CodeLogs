import { readdirSync, readFileSync } from "node:fs";
import { join, relative } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const fixturesDir = fileURLToPath(new URL("../fixtures", import.meta.url));

function listJson(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) return listJson(full);
    return entry.name.endsWith(".json") ? [full] : [];
  });
}

const files = listJson(fixturesDir);

describe("fixtures", () => {
  it("contains at least one JSON file", () => {
    expect(files.length).toBeGreaterThan(0);
  });

  it.each(files.map((f) => relative(fixturesDir, f)))("%s parses as non-empty JSON", (name) => {
    const text = readFileSync(join(fixturesDir, name), "utf8");
    expect(text.trim().length).toBeGreaterThan(0);
    const parsed: unknown = JSON.parse(text);
    expect(parsed).not.toBeNull();
    if (typeof parsed === "object") expect(Object.keys(parsed as object).length).toBeGreaterThan(0);
  });
});
