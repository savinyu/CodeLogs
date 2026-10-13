import { syncAccount } from "./sync-account";
import { syncCatalog } from "./sync-catalog";
import { syncCatalogs } from "./sync-catalogs";

export const functions = [syncAccount, syncCatalog, syncCatalogs];
