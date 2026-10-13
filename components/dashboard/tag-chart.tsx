import type { PlatformId } from "@/lib/adapters/types";
import type { PlatformTags } from "@/lib/dashboard/types";

// STUB: replaced by a subagent.
export function TagCharts({ tags }: { tags: PlatformTags[]; connected: PlatformId[] }) {
  return <p className="text-xs">{tags.length} platforms with tags</p>;
}
