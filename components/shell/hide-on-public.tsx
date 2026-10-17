"use client";

import { usePathname } from "next/navigation";

/** Hides its children on public profile pages (/u/<username>). */
export function HideOnPublic({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  return pathname.startsWith("/u/") ? null : children;
}
