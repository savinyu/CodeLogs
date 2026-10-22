/** The text a user must type to confirm account deletion: their username, or "delete" without one. */
export function deleteConfirmationPhrase(username: string | null): string {
  return username && username.length > 0 ? username : "delete";
}

export function isDeleteConfirmed(username: string | null, input: string): boolean {
  return input.trim() === deleteConfirmationPhrase(username);
}

/** logn-<username or user id>-<YYYY-MM-DD>.json, with anything unsafe for a header replaced. */
export function exportFilename(username: string | null, userId: string, now: Date): string {
  const who = (username || userId).replace(/[^A-Za-z0-9._-]/g, "_");
  return `logn-${who}-${now.toISOString().slice(0, 10)}.json`;
}

export type FriendRelation = "friends" | "request sent" | "request received";

/** One friendship row seen from `userId`'s side. */
export function friendRelation(
  row: { requesterId: string; status: "pending" | "accepted" },
  userId: string,
): FriendRelation {
  if (row.status === "accepted") return "friends";
  return row.requesterId === userId ? "request sent" : "request received";
}
