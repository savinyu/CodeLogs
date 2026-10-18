// Handle validation for the connect form: the offline format check, then the platform itself.

import { checkHandleFormat } from "./handle-format";
import { ADAPTERS } from "./index";
import { isSyncedPlatform } from "../platforms";
import type { PlatformId, ValidateResult } from "./types";

export async function validateHandle(
  platform: PlatformId,
  rawHandle: string,
): Promise<ValidateResult> {
  const format = await checkHandleFormat(platform, rawHandle);
  if (format.result !== "valid") return format;
  // Extension platforms are never fetched by the server: the format check is all we can do,
  // and the extension's first upload confirms the handle (PLAN-v2.md §9).
  if (!isSyncedPlatform(platform)) return format;
  return ADAPTERS[platform].validateHandle(format.canonicalHandle);
}
