import { AutoRefresh } from "@/app/connect/auto-refresh";
import { SyncButton } from "@/app/connect/sync-button";
import { Chip } from "@/components/kit/chip";
import type { AccountSummary } from "@/lib/dashboard/types";
import { PLATFORM_META } from "@/lib/platforms";

const DAY = new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", timeZone: "UTC" });
const TIME = new Intl.DateTimeFormat("en-GB", {
  hour: "2-digit",
  minute: "2-digit",
  hourCycle: "h23",
  timeZone: "UTC",
});

/** "17 Oct, 14:05 UTC". */
function formatSynced(iso: string): string {
  const t = new Date(iso);
  return `${DAY.format(t)}, ${TIME.format(t)} UTC`;
}

function problem(accounts: AccountSummary[]): string | null {
  const names = (status: AccountSummary["status"]) =>
    accounts
      .filter((a) => a.status === status)
      .map((a) => PLATFORM_META[a.platform].name)
      .join(", ");
  if (accounts.some((a) => a.status === "error")) return `Sync error: ${names("error")}`;
  if (accounts.some((a) => a.status === "syncing")) return `Syncing: ${names("syncing")}`;
  if (accounts.some((a) => a.status === "pending"))
    return `Waiting for first sync: ${names("pending")}`;
  return null;
}

/** Sync status for every connected account, with a "Sync now" for all of them (Coach's .sync-line). */
export function SyncLine({ accounts }: { accounts: AccountSummary[] }) {
  const issue = problem(accounts);
  const last = accounts
    .map((a) => a.lastSyncedAt)
    .filter((d): d is string => d !== null)
    .sort()
    .pop();
  const syncing = accounts.some((a) => a.status === "syncing");

  return (
    <div className="mt-3.5 flex flex-wrap items-center gap-x-3.5 gap-y-2 text-[0.906rem] text-muted-foreground">
      {issue ? <Chip tone="primary">{issue}</Chip> : <Chip tone="good">All synced</Chip>}
      <span>{last ? `Last synced ${formatSynced(last)}` : "Not synced yet"}</span>
      <SyncButton label="Sync now" disabled={syncing} />
      {/* Pages stay in the client cache for a while, so poll until the sync lands. */}
      {syncing ? <AutoRefresh /> : null}
    </div>
  );
}
