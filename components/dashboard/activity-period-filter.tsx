"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { buttonVariants } from "@/components/ui/button";
import { dashboardHref, type ActivityPeriod } from "@/lib/dashboard/filters";
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
  if (years.length === 0) return null;

  const options: { id: ActivityPeriod; label: string }[] = [
    { id: "last12", label: "Last 12 months" },
    ...years.map((y) => ({ id: y as ActivityPeriod, label: String(y) })),
  ];

  return (
    <nav aria-label="Activity period" className="flex flex-wrap gap-1 sm:justify-end">
      {options.map((o) => {
        const active = o.id === period;
        return (
          <Link
            key={o.id}
            href={dashboardHref(pathname, { platform, period: o.id })}
            scroll={false}
            aria-current={active ? "page" : undefined}
            className={buttonVariants({ variant: active ? "secondary" : "ghost", size: "sm" })}
          >
            {o.label}
          </Link>
        );
      })}
    </nav>
  );
}
