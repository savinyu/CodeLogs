"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";

/** Longest it keeps polling, so a stuck sync can't keep tabs re-rendering forever. */
const MAX_MS = 10 * 60 * 1000;

/**
 * Re-fetches the page every few seconds while it is mounted and visible, for up to ten minutes.
 * Render it only while a sync is running.
 */
export function AutoRefresh({ intervalMs = 3000 }: { intervalMs?: number }) {
  const router = useRouter();
  useEffect(() => {
    const started = Date.now();
    const timer = setInterval(() => {
      if (Date.now() - started > MAX_MS) return clearInterval(timer);
      if (!document.hidden) router.refresh();
    }, intervalMs);
    return () => clearInterval(timer);
  }, [router, intervalMs]);
  return null;
}
