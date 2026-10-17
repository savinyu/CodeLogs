/** Trim, drop one leading @, lowercase. */
export function normalizeUsername(input: string): string {
  return input.trim().replace(/^@/, "").toLowerCase();
}

export function isValidUsername(username: string): boolean {
  return /^[a-z0-9._-]{2,39}$/.test(username);
}
