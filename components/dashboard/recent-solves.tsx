import type { RecentSolve } from "@/lib/dashboard/types";

// STUB: replaced by a subagent.
export function RecentSolves({ solves }: { solves: RecentSolve[] }) {
  return <p className="text-xs">{solves.length} recent solves</p>;
}
