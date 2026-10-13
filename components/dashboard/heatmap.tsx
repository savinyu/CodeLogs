import type { ActivityDay } from "@/lib/dashboard/types";

// STUB: replaced by a subagent.
export function ActivityHeatmap({ activity }: { activity: ActivityDay[]; asOf: string }) {
  return <p className="text-xs">{activity.length} active days</p>;
}
