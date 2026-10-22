// Regenerates lib/sheets/striver-data.ts from Striver's 180 on takeuforward.org (the page the old
// SDE sheet URL now redirects to). Run: pnpm sheets:striver. Dev-only; the app never fetches this
// at runtime. robots.txt allows the page (it only disallows /api/ and account paths).
//
// The page embeds the sheet as React Server Component data: `sheet_syllabus` is a table of rows
// (`fields` per row shape, row[0] picks the shape) where categories list their children by row
// index and repeated values are "$..:sheet_syllabus:rows:R:C" references.
//
// Difficulty, premium and the catalog check come from our LeetCode catalog (the problems table in
// DATABASE_URL), so every tracked slug is one a solve can match.
import { writeFileSync } from "node:fs";
import { config } from "dotenv";

config({ path: ".env.local", quiet: true });

const SOURCE = "https://takeuforward.org/prep-hub/strivers-180-master-dsa-patterns";
const OUT = new URL("../../lib/sheets/striver-data.ts", import.meta.url);
const SITE = "takeUforward";
/** Old LeetCode slugs the sheet still links (LeetCode redirects them) → the catalog's slug. */
const RENAMED: Record<string, string> = {
  "implement-strstr": "find-the-index-of-the-first-occurrence-in-a-string",
};

type Row = unknown[];
interface Syllabus {
  fields: string[][];
  rows: Row[];
  roots: number[];
}
interface Item {
  section: string;
  title: string;
  itemSlug: string;
  leetcode: string | null;
}

async function fetchSyllabus(): Promise<Syllabus> {
  const res = await fetch(SOURCE, {
    headers: { "User-Agent": "Mozilla/5.0 (compatible; LogN sheet generator)" },
  });
  if (!res.ok) throw new Error(`HTTP ${res.status} from ${SOURCE}`);
  const html = await res.text();
  const chunks = [...html.matchAll(/self\.__next_f\.push\(\[1,"((?:[^"\\]|\\.)*)"\]\)/g)];
  const text = chunks.map((m) => JSON.parse(`"${m[1]}"`) as string).join("");
  const key = '"sheet_syllabus":';
  const start = text.indexOf(key);
  if (start < 0) throw new Error("No sheet_syllabus in the page; the page format changed");
  return parseJsonPrefix(text, start + key.length) as Syllabus;
}

/** Parses the JSON value that starts at `from` and ignores whatever follows it. */
function parseJsonPrefix(text: string, from: number): unknown {
  let depth = 0;
  let inString = false;
  for (let i = from; i < text.length; i++) {
    const c = text[i];
    if (inString) {
      if (c === "\\") i++;
      else if (c === '"') inString = false;
    } else if (c === '"') inString = true;
    else if (c === "{" || c === "[") depth++;
    else if (c === "}" || c === "]") {
      if (--depth === 0) return JSON.parse(text.slice(from, i + 1));
    }
  }
  throw new Error("Unterminated sheet_syllabus JSON");
}

function walk(s: Syllabus): Item[] {
  const resolve = (v: unknown): unknown => {
    if (typeof v === "string" && v.startsWith("$") && v.includes(":sheet_syllabus:rows")) {
      let cur: unknown = s.rows;
      for (const part of v.split(":sheet_syllabus:rows")[1]!.split(":").filter(Boolean)) {
        cur = (cur as Record<string, unknown>)[part];
      }
      return resolve(cur);
    }
    return v;
  };
  const record = (i: number) => {
    const row = s.rows[i]!;
    const fields = s.fields[row[0] as number]!;
    return Object.fromEntries(fields.map((f, k) => [f, resolve(row[k + 1])])) as Record<
      string,
      unknown
    >;
  };
  const items: Item[] = [];
  const visit = (i: number, section: string | null) => {
    const r = record(i);
    if (r.type === "category") {
      // Top-level categories are the sections; the pattern categories under them are flattened.
      for (const child of r.children as number[]) visit(child, section ?? String(r.label).trim());
    } else {
      if (!section) throw new Error(`Item outside a section: ${String(r.label)}`);
      items.push({
        section,
        title: String(r.label).trim(),
        itemSlug: String(r.slug),
        leetcode: typeof r.leetcode_link === "string" ? r.leetcode_link : null,
      });
    }
  };
  for (const root of s.roots) visit(root, null);
  return items;
}

async function main() {
  const items = walk(await fetchSyllabus());

  const { and, eq, inArray } = await import("drizzle-orm");
  const { db } = await import("@/lib/db/client");
  const { problems } = await import("@/lib/db/schema");

  // A LeetCode link counts only when it is a problem page; two items link a discuss post that
  // demonstrates an algorithm on some other problem, and those stay on takeUforward.
  const slugOf = (url: string | null) => {
    const slug = url?.match(/^https:\/\/leetcode\.com\/problems\/([a-z0-9-]+)\/?$/)?.[1];
    return slug ? (RENAMED[slug] ?? slug) : null;
  };
  const slugs = [...new Set(items.map((i) => slugOf(i.leetcode)).filter((s) => s !== null))];
  const catalog = await db
    .select({
      slug: problems.externalId,
      difficulty: problems.difficultyRaw,
      premium: problems.paidOnly,
    })
    .from(problems)
    .where(and(eq(problems.platform, "leetcode"), inArray(problems.externalId, slugs)));
  const bySlug = new Map(catalog.map((p) => [p.slug, p]));
  const missing = slugs.filter((s) => !bySlug.has(s));
  if (missing.length) throw new Error(`Not in the LeetCode catalog: ${missing.join(", ")}`);

  const sections = new Map<
    string,
    {
      name: string;
      problems: unknown[];
      offPlatform: { title: string; url: string; site: string }[];
    }
  >();
  const seen = new Set<string>();
  const shared: string[] = [];
  for (const item of items) {
    let section = sections.get(item.section);
    if (!section) {
      sections.set(item.section, (section = { name: item.section, problems: [], offPlatform: [] }));
    }
    const slug = slugOf(item.leetcode);
    if (!slug) {
      section.offPlatform.push({
        title: item.title,
        url: `https://takeuforward.org/practice/dsa/${item.itemSlug}`,
        site: SITE,
      });
      continue;
    }
    // Each problem appears once per sheet: an item sharing an earlier item's LeetCode problem
    // (Power Set twice, the two cycle checks) is counted in its first section only.
    if (seen.has(slug)) {
      shared.push(`${item.title} (${slug})`);
      continue;
    }
    seen.add(slug);
    const p = bySlug.get(slug)!;
    if (!["Easy", "Medium", "Hard"].includes(p.difficulty ?? "")) {
      throw new Error(`Unexpected difficulty for ${slug}: ${p.difficulty}`);
    }
    section.problems.push({
      slug,
      title: item.title,
      difficulty: p.difficulty,
      premium: p.premium,
      url: `https://leetcode.com/problems/${slug}/`,
    });
  }

  const list = [...sections.values()];
  const tracked = list.reduce((n, s) => n + s.problems.length, 0);
  const off = list.reduce((n, s) => n + s.offPlatform.length, 0);
  if (items.length < 150 || tracked < 120) {
    throw new Error(`Suspiciously small sheet: ${items.length} items, ${tracked} on LeetCode`);
  }

  const header = `// Generated by scripts/dev/sheets-striver.ts from ${SOURCE}
// on ${new Date().toISOString().slice(0, 10)}. Don't edit by hand; rerun \`pnpm sheets:striver\`.
//
// Striver's 180 by takeUforward: ${items.length} items in ${list.length} sections, as listed on the
// sheet. ${tracked} LeetCode problems are tracked; ${off} problems hosted on takeUforward (or linked
// to a LeetCode discuss post) are listed only. Counted once, in their first section:
// ${shared.join("; ") || "none"}.

import type { StriverSection } from "./types";

/** Striver's 180 in the sheet's order. Titles are the sheet's names for the problems. */
export const STRIVER_SECTIONS: readonly StriverSection[] = `;
  writeFileSync(OUT, `${header}${JSON.stringify(list, null, 2)};\n`);
  console.log(
    `Wrote ${list.length} sections: ${tracked} LeetCode, ${off} off-platform, ${shared.length} shared, to ${OUT.pathname}`,
  );
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
