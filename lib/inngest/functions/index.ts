import { syncAccount } from "./sync-account";
import { syncCatalog } from "./sync-catalog";
import { syncCatalogs } from "./sync-catalogs";
import { syncStaleAccounts } from "./sync-stale-accounts";

export const functions = [syncAccount, syncCatalog, syncCatalogs, syncStaleAccounts];
