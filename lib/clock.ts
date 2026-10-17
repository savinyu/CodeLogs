// The render's clock. Signed-in pages are prefetched per session (lib/session.ts), and a prefetch
// may not read the time directly, so the time comes from a cache that refreshes every minute.

import "server-only";
import { cacheLife } from "next/cache";

/** Milliseconds since the epoch, at most about a minute old. */
export async function renderNow(): Promise<number> {
  "use cache";
  cacheLife("clock");
  return Date.now();
}

/** Today's UTC date as YYYY-MM-DD. */
export async function utcToday(): Promise<string> {
  return new Date(await renderNow()).toISOString().slice(0, 10);
}
