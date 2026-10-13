// Pure parser for the JSON at https://leetcode.com/api/problems/all/ (saved by the user from
// their own logged-in browser). Importable from client components; no server or DB imports.

export type LeetcodeImportParse =
  | { ok: true; userName: string; slugs: string[]; numSolved: number | null }
  | { ok: false; error: string };

const NOT_THE_FILE =
  "That doesn't look like the file from leetcode.com/api/problems/all/. Save that page as a .json file and choose it again.";

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
