import type { PlatformId } from "@/lib/adapters/types";
import type { PlatformFilter } from "@/lib/dashboard/types";

// STUB: replaced by a subagent.
export function PlatformFilterBar({ value }: { value: PlatformFilter; platforms: PlatformId[] }) {
  return <p className="text-xs">Filter: {value}</p>;
}
