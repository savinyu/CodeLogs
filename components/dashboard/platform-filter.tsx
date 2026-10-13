"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { buttonVariants } from "@/components/ui/button";
import type { PlatformId } from "@/lib/adapters/types";
import type { PlatformFilter } from "@/lib/dashboard/types";
import { PLATFORM_META } from "@/lib/platforms";

export function PlatformFilterBar({
  value,
  platforms,
}: {
  value: PlatformFilter;
  platforms: PlatformId[];
}) {
  const pathname = usePathname();
  if (platforms.length <= 1) return null;

  const options: { id: PlatformFilter; label: string; href: string }[] = [
    { id: "all", label: "All", href: pathname },
    ...platforms.map((p) => ({
      id: p as PlatformFilter,
      label: PLATFORM_META[p].name,
      href: `${pathname}?platform=${p}`,
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
