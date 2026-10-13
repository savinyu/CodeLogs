import type { AccountSummary, PlatformTotal } from "@/lib/dashboard/types";

// STUB: replaced by a subagent.
export function TotalsCards({ totals }: { totals: PlatformTotal[]; accounts: AccountSummary[] }) {
  return <pre className="text-xs">{JSON.stringify(totals)}</pre>;
}
