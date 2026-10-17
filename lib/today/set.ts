// Today's set: which picks to show, in which order. Pure.

import type { Recommendation, TopicPicks } from "@/lib/topics/recommend";

export interface TodayPick {
  topic: { slug: string; name: string; focus: { slug: string; name: string } | null };
  problem: Recommendation;
}

/**
 * The first pick of each practice topic, then the weakest topic's second pick, then the first
 * "may already be solved" pick from any topic. Duplicates (same platform and id) are dropped and
 * the set is capped at `limit`. `picks` is ordered weakest topic first.
 */
export function todaySet(picks: TopicPicks[], limit = 5): TodayPick[] {
  const entry = (t: TopicPicks, problem: Recommendation | undefined): TodayPick[] =>
    problem ? [{ topic: { slug: t.slug, name: t.name, focus: t.focus }, problem }] : [];

  const ordered: TodayPick[] = picks.flatMap((t) => entry(t, t.problems[0]));
  const weakest = picks[0];
  if (weakest) ordered.push(...entry(weakest, weakest.problems[1]));
  for (const t of picks) {
    const maybe = t.problems.find((p) => p.maybeSolved);
    if (maybe) {
      ordered.push(...entry(t, maybe));
      break;
    }
  }

  const seen = new Set<string>();
  const out: TodayPick[] = [];
  for (const pick of ordered) {
    const key = `${pick.problem.platform}:${pick.problem.externalId}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(pick);
    if (out.length === limit) break;
  }
  return out;
}
