"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { buttonVariants } from "@/components/ui/button";
import type { PlatformId } from "@/lib/adapters/types";
import { dashboardHref, type ActivityPeriod } from "@/lib/dashboard/filters";
import type { PlatformFilter } from "@/lib/dashboard/types";
import { PLATFORM_META } from "@/lib/platforms";

export function PlatformFilterBar({
  value,
  platforms,
  period = "last12",
}: {
  value: PlatformFilter;
  platforms: PlatformId[];
  period?: ActivityPeriod;
}) {
  const pathname = usePathname();
  if (platforms.length <= 1) return null;

  const options: { id: PlatformFilter; label: string; href: string }[] = [
    { id: "all", label: "All", href: dashboardHref(pathname, { platform: "all", period }) },
    ...platforms.map((p) => ({
      id: p as PlatformFilter,
      label: PLATFORM_META[p].name,
      href: dashboardHref(pathname, { platform: p, period }),
    })),
  ];

  return (
    <nav aria-label="Platform filter" className="flex flex-wrap gap-1">
      {options.map((o) => {
        const active = o.id === value;
        return (
          <Link
            key={o.id}
            href={o.href}
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
