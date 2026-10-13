// Handle validation for the connect form: the offline format check, then the platform itself.

import { checkHandleFormat } from "./handle-format";
import { ADAPTERS } from "./index";
import type { PlatformId, ValidateResult } from "./types";

export async function validateHandle(
  platform: PlatformId,
  rawHandle: string,
): Promise<ValidateResult> {
  const format = await checkHandleFormat(platform, rawHandle);
  if (format.result !== "valid") return format;
  return ADAPTERS[platform].validateHandle(format.canonicalHandle);
}
