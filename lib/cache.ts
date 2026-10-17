// Server cache tags for user data. Reads are `"use cache: remote"` functions keyed by user id
// (and the UTC day where it matters) and tagged with userTag(); every write to a user's rows drops
// that tag, so the cacheLife timers in next.config.ts are only a backstop.

import "server-only";
import { refresh, revalidateTag, updateTag } from "next/cache";

/** Everything cached for one user: dashboard, streak, settings, sheets, marks, picks, friends. */
export const userTag = (userId: string) => `user:${userId}`;
/** The problem catalogs, which change with the daily catalog syncs. */
export const CATALOG_TAG = "catalog";
/** The opt-in global board, which reads every listed user's week. */
export const GLOBAL_BOARD_TAG = "board:global";

/**
 * After a write outside a server action (sync steps, route handlers): the next read of the
 * user's data waits for fresh rows. The global board may stay stale while it refreshes.
 */
export function invalidateUser(userId: string): void {
  revalidateTag(userTag(userId), { expire: 0 });
  revalidateTag(GLOBAL_BOARD_TAG, "max");
}

/**
 * After a write in a server action: drops the users' cached reads (read-your-writes) and
 * re-renders the page. Pass both people for a friendship change.
 */
export function userDataChanged(...userIds: string[]): void {
  for (const id of userIds) updateTag(userTag(id));
  updateTag(GLOBAL_BOARD_TAG);
  refresh();
}
