// Adapter registry: the only place that maps a PlatformId to its adapters.

import { atcoderAdapter, atcoderCatalog } from "./atcoder";
import { codeforcesAdapter, codeforcesCatalog } from "./codeforces";
import { leetcodeAdapter, leetcodeCatalog } from "./leetcode";
import type { CatalogAdapter, PlatformAdapter, PlatformId } from "./types";

export const ADAPTERS: Record<PlatformId, PlatformAdapter> = {
  codeforces: codeforcesAdapter,
  atcoder: atcoderAdapter,
  leetcode: leetcodeAdapter,
};

export const CATALOGS: Record<PlatformId, CatalogAdapter> = {
  codeforces: codeforcesCatalog,
  atcoder: atcoderCatalog,
  leetcode: leetcodeCatalog,
};
