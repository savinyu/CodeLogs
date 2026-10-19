// Pure planning for POST /api/extension/platform: turns a validated upload into the snapshot
// applySnapshot writes, and decides what to do with the connected handle. No DB or server-only
// imports, so tests load it directly. The DB side is lib/extension-platform-ingest.ts.

import type { NormalizedSolve, PlatformSnapshot } from "@/lib/adapters/types";
import {
  difficultySplit,
  EXT_COUNTS_KIND,
  isPlatformProblemUrl,
  type ExtCounts,
  type ExtensionUpload,
} from "@/lib/extension-upload";

export interface PlatformPlan {
  snapshot: PlatformSnapshot;
  /** Solves dropped because their URL isn't https on the platform's own hosts. */
  rejected: number;
  /** Distinct solves in the snapshot. */
  solveCount: number;
  /** Account status once written: "ok" only when the uploaded list is the complete list. */
  status: "ok" | "partial";
  historyComplete: boolean;
}

export function buildPlatformSnapshot(upload: ExtensionUpload): PlatformPlan {
  const { platform } = upload;

  // One solve per id, keeping the earliest known date (a null date never beats a real one).
  const byId = new Map<string, NormalizedSolve>();
  let rejected = 0;
  for (const s of upload.solves) {
    if (!isPlatformProblemUrl(platform, s.url)) {
      rejected++;
      continue;
    }
    const solvedAt = s.solvedAt === null ? undefined : new Date(s.solvedAt * 1000);
    const seen = byId.get(s.id);
    if (seen) {
      if (solvedAt && (!seen.firstSolvedAt || solvedAt < seen.firstSolvedAt)) {
        seen.firstSolvedAt = solvedAt;
      }
      continue;
    }
    byId.set(s.id, {
      platform,
      externalProblemId: s.id,
      ...(solvedAt ? { firstSolvedAt: solvedAt } : {}),
      problemFallback: {
        title: s.title,
        url: s.url,
        difficultyRaw: s.difficulty ?? undefined,
        rawTags: s.tags,
      },
    });
  }

  const extras: PlatformSnapshot["extras"] = [];
  if (upload.counts !== null) {
    const payload: ExtCounts = {
      total: upload.counts.total,
      byDifficulty: upload.counts.byDifficulty,
      split: difficultySplit(platform, upload.counts.byDifficulty),
    };
    extras.push({ kind: EXT_COUNTS_KIND, payload });
  }

  // The dashboard already builds a platform's heatmap from solve dates when it has no
  // activity_days rows (that's how Codeforces and AtCoder work), so nothing is derived here:
  // only a calendar the platform itself gave is stored.
  const days = new Map<string, number>();
  for (const a of upload.activity) {
    days.set(a.day, Math.max(days.get(a.day) ?? 0, a.count));
  }
  const activity = [...days]
    .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
    .map(([day, count]) => ({ day, count }));

  return {
    snapshot: { solves: [...byId.values()], extras, activity },
    rejected,
    solveCount: byId.size,
    status: upload.listComplete ? "ok" : "partial",
    historyComplete: upload.listComplete,
  };
}

export type AccountMatch =
  /** No connected handle for this platform: connect the logged-in one. */
  | { kind: "create" }
  /** Same handle (any casing): verified; `handle` is the platform's casing. */
  | { kind: "match"; handle: string }
  /** A different handle is connected: refuse. */
  | { kind: "mismatch"; connected: string };

/** Compares the connected account (if any) with the canonical logged-in handle. */
export function matchAccount(existing: { handle: string } | null, canonical: string): AccountMatch {
  if (!existing) return { kind: "create" };
  if (existing.handle.toLowerCase() === canonical.toLowerCase()) {
    return { kind: "match", handle: canonical };
  }
  return { kind: "mismatch", connected: existing.handle };
}
