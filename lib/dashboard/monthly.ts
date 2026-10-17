// Pure: solves per calendar month by platform, for the Progress "Solves per month" chart.

import type { PlatformId } from "@/lib/adapters/types";
import type { ActivityDay } from "./types";

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

export interface MonthTotal {
  /** YYYY-MM (UTC). */
  month: string;
  /** "Nov". */
  label: string;
  /** "Nov 2025". */
  hint: string;
  counts: Partial<Record<PlatformId, number>>;
  total: number;
}

/**
 * The `months` calendar months ending with asOf's month, oldest first. Months without activity are
 * included with zero totals. asOf is a UTC YYYY-MM-DD.
 */
export function monthlyTotals(activity: ActivityDay[], asOf: string, months = 12): MonthTotal[] {
  const endYear = Number(asOf.slice(0, 4));
  const endMonth = Number(asOf.slice(5, 7)) - 1;
  const rows: MonthTotal[] = [];
  for (let i = months - 1; i >= 0; i--) {
    const index = endYear * 12 + endMonth - i;
    const year = Math.floor(index / 12);
    const m = index % 12;
    const name = MONTHS[m] ?? "";
    rows.push({
      month: `${year}-${String(m + 1).padStart(2, "0")}`,
      label: name,
      hint: `${name} ${year}`,
      counts: {},
      total: 0,
    });
  }
  const byMonth = new Map(rows.map((r) => [r.month, r]));
  for (const a of activity) {
    if (a.day > asOf) continue;
    const row = byMonth.get(a.day.slice(0, 7));
    if (!row) continue;
    for (const [platform, n] of Object.entries(a.counts) as [PlatformId, number][]) {
      if (n <= 0) continue;
      row.counts[platform] = (row.counts[platform] ?? 0) + n;
      row.total += n;
    }
  }
  return rows;
}
