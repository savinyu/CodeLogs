import type { DifficultyRow } from "@/lib/dashboard/types";

// STUB: replaced by a subagent.
export function DifficultyChart({ rows }: { rows: DifficultyRow[] }) {
  return <pre className="text-xs">{JSON.stringify(rows)}</pre>;
}
