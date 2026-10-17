// Which sheets a user follows. Pure: sheet_follows stores explicit choices only, and a sheet
// without a choice falls back to DEFAULT_FOLLOWED.

import { SHEETS } from "./index";
import type { SheetId } from "./types";

export const DEFAULT_FOLLOWED: ReadonlySet<SheetId> = new Set<SheetId>(["neetcode-150"]);

/** Followed sheets in SHEETS order, from the user's stored choices (sheetId → following). */
export function followedSheets(choices: ReadonlyMap<string, boolean>): SheetId[] {
  return SHEETS.map((s) => s.id).filter((id) => choices.get(id) ?? DEFAULT_FOLLOWED.has(id));
}
