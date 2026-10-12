// Errors adapters throw that the sync job treats specially.

/**
 * The handle no longer exists on the platform (renamed or deleted). Retrying can't help,
 * so the sync job fails the run immediately instead of retrying.
 */
export class PlatformUserNotFoundError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "PlatformUserNotFoundError";
  }
}
