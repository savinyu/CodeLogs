// Pure parser for the JSON at https://leetcode.com/api/problems/all/ (saved or copied by the user
// from their own logged-in browser). Importable from client components; no server or DB imports.

export type LeetcodeImportParse =
  | { ok: true; userName: string; slugs: string[]; numSolved: number | null }
  | { ok: false; error: string };

const NOT_THE_FILE =
  "That doesn't look like the page at leetcode.com/api/problems/all/. Open it, copy everything (Cmd/Ctrl+A, then Cmd/Ctrl+C) and paste it here.";

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

export function parseLeetcodeProblemsAll(json: unknown): LeetcodeImportParse {
  if (!isRecord(json) || !Array.isArray(json.stat_status_pairs)) {
    return { ok: false, error: NOT_THE_FILE };
  }
  const userName = typeof json.user_name === "string" ? json.user_name.trim() : "";
  if (userName === "") {
    return {
      ok: false,
      error:
        "You weren't logged in on leetcode.com when you saved the file. Log in, open the link again and save that page.",
    };
  }

  const slugs = new Set<string>();
  for (const pair of json.stat_status_pairs) {
    if (!isRecord(pair) || pair.status !== "ac" || !isRecord(pair.stat)) continue;
    const slug = pair.stat.question__title_slug;
    if (typeof slug === "string" && slug.length > 0) slugs.add(slug);
  }

  const numSolved =
    typeof json.num_solved === "number" && Number.isFinite(json.num_solved)
      ? json.num_solved
      : null;
  return { ok: true, userName, slugs: [...slugs], numSolved };
}

// Accepts whatever the user brings: the raw JSON, the HTML page Chrome saves with Cmd/Ctrl+S
// (the JSON sits in a <pre>, entity-escaped), or text copied from the page (Chrome's viewer can
// put a "Pretty-print" label before it).
export function parseLeetcodeImportText(text: string): LeetcodeImportParse {
  let firstError: LeetcodeImportParse | null = null;
  for (const candidate of jsonCandidates(text)) {
    let json: unknown;
    try {
      json = JSON.parse(candidate);
    } catch {
      continue;
    }
    const parsed = parseLeetcodeProblemsAll(json);
    if (parsed.ok) return parsed;
    firstError ??= parsed;
  }
  return firstError ?? { ok: false, error: NOT_THE_FILE };
}

function* jsonCandidates(text: string): Generator<string> {
  yield text;
  for (const m of text.matchAll(/<pre\b[^>]*>([\s\S]*?)<\/pre>/gi)) {
    yield decodeEntities(stripTags(m[1] ?? ""));
  }
  yield braceSlice(text);
  if (/<[a-z!/]/i.test(text)) {
    const body = text.replace(/<(script|style)\b[\s\S]*?<\/\1>/gi, "");
    yield braceSlice(decodeEntities(stripTags(body)));
  }
}

function braceSlice(s: string): string {
  const start = s.indexOf("{");
  const end = s.lastIndexOf("}");
  return start >= 0 && end > start ? s.slice(start, end + 1) : "";
}

function stripTags(s: string): string {
  return s.replace(/<[^>]*>/g, "");
}

const NAMED_ENTITIES: Record<string, string> = {
  amp: "&",
  lt: "<",
  gt: ">",
  quot: '"',
  apos: "'",
  nbsp: "\u00a0",
};

function decodeEntities(s: string): string {
  return s.replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (whole, ref: string) => {
    if (ref[0] !== "#") return NAMED_ENTITIES[ref.toLowerCase()] ?? whole;
    const code =
      ref[1] === "x" || ref[1] === "X" ? parseInt(ref.slice(2), 16) : Number(ref.slice(1));
    return code <= 0x10ffff ? String.fromCodePoint(code) : whole;
  });
}
