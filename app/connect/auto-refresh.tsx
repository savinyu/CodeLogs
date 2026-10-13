"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";

/** Re-fetches the page every few seconds while it is mounted. Render it only while a sync is running. */
export function AutoRefresh({ intervalMs = 3000 }: { intervalMs?: number }) {
  const router = useRouter();
  useEffect(() => {
    const timer = setInterval(() => router.refresh(), intervalMs);
    return () => clearInterval(timer);
  }, [router, intervalMs]);
  return null;
}
