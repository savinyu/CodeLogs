"use client";

import { usePathname, useRouter } from "next/navigation";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { dashboardHref, parseActivityPeriod, type ActivityPeriod } from "@/lib/dashboard/filters";
import type { PlatformFilter } from "@/lib/dashboard/types";

export function ActivityPeriodFilter({
  years,
  period,
  platform,
}: {
  years: number[];
  period: ActivityPeriod;
  platform: PlatformFilter;
}) {
  const pathname = usePathname();
  const router = useRouter();
  if (years.length === 0) return null;

  const options: { value: string; label: string }[] = [
    { value: "last12", label: "Last 12 months" },
    { value: "all", label: "All time" },
    ...years.map((y) => ({ value: String(y), label: String(y) })),
  ];

  return (
    <Select
      items={options}
      value={String(period)}
      onValueChange={(value) => {
        const next = parseActivityPeriod(value, years);
        router.push(dashboardHref(pathname, { platform, period: next }), { scroll: false });
      }}
    >
      <SelectTrigger size="sm" aria-label="Activity period" className="min-w-36">
        <SelectValue />
      </SelectTrigger>
      <SelectContent align="end">
        {options.map((o) => (
          <SelectItem key={o.value} value={o.value}>
            {o.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
