"use client";

import { useEffect, useRef } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "cn";

const LINKS = [
  { href: "/today", label: "Today" },
  { href: "/progress", label: "Progress" },
  { href: "/topics", label: "Topics" },
  { href: "/sheets", label: "Sheets" },
  { href: "/friends", label: "Friends" },
  { href: "/contests", label: "Contests" },
] as const;

/**
 * The pill nav, or on a public profile (/u/<username>) the profile URL pill in its place.
 * Signed-out visitors only ever see the URL pill.
 */
export function MainNav({ signedIn, host }: { signedIn: boolean; host: string }) {
  const pathname = usePathname();
  const navRef = useRef<HTMLElement>(null);
  const publicName = /^\/u\/([^/]+)/.exec(pathname)?.[1];

  // On phones the nav scrolls sideways: keep the active pill in view after navigating.
  useEffect(() => {
    navRef.current
      ?.querySelector<HTMLElement>('[aria-current="page"]')
      ?.scrollIntoView({ inline: "center", block: "nearest" });
  }, [pathname]);

  if (publicName !== undefined) {
    return (
      <span className="shrink-0 rounded-full bg-card px-3.5 py-1.5 text-sm font-semibold text-muted-foreground">
        {host}/u/{decodeURIComponent(publicName)}
      </span>
    );
  }
  if (!signedIn) return null;

  return (
    <nav ref={navRef} aria-label="Main" className="flex shrink-0 gap-1 rounded-full bg-card p-1">
      {LINKS.map(({ href, label }) => {
        const active = pathname === href || pathname.startsWith(`${href}/`);
        return (
          <Link
            key={href}
            href={href}
            // Full prefetch: Progress, Topics, Sheets and Friends read searchParams, so the
            // default App Shell prefetch leaves their content out and the click shows a skeleton.
            // The reads behind it are server-cached (lib/cache.ts), so this costs no queries.
            prefetch={true}
            aria-current={active ? "page" : undefined}
            className={cn(
              "inline-flex items-center rounded-full px-4 py-2 text-[0.9375rem] font-semibold whitespace-nowrap outline-none focus-visible:ring-3 focus-visible:ring-ring/50",
              active
                ? "bg-primary text-primary-foreground"
                : "text-muted-foreground hover:text-foreground",
            )}
          >
            {label}
          </Link>
        );
      })}
    </nav>
  );
}
