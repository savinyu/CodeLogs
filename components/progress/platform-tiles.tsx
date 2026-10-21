import { Chip } from "@/components/kit/chip";
import { PlatformStatTile } from "@/components/kit/platform-stat-tile";
import { StatTile, StatTiles } from "@/components/kit/stat-tile";
import type { PlatformId } from "@/lib/adapters/types";
import { shownTotals } from "@/lib/dashboard/filters";
import type { AccountSummary, PlatformFilter, PlatformTotal } from "@/lib/dashboard/types";
import {
  acrossPlatforms,
  displayHandle,
  isExtensionPlatform,
  PLATFORM_META,
} from "@/lib/platforms";

const STATUS_LABEL: Record<AccountSummary["status"], string> = {
  ok: "Synced",
  partial: "Partial",
  error: "Sync error",
  syncing: "Syncing",
  pending: "Pending",
};

/** Extension platforms stay "Pending" until the extension's first upload. */
function statusLabel(
  platform: PlatformId,
  status: AccountSummary["status"],
  short = false,
): string {
  if (isExtensionPlatform(platform) && status === "pending") {
    return short ? "Waiting" : "Waiting for the extension";
  }
  return STATUS_LABEL[status];
}

function statusTone(platform: PlatformId, status: AccountSummary["status"]) {
  if (status === "ok") return "good";
  // Counts-only and partial lists are normal for extension platforms.
  if (isExtensionPlatform(platform) && (status === "partial" || status === "pending")) {
    return "neutral";
  }
  return "primary";
}

const fmt = (n: number) => n.toLocaleString("en-US");

/** The "Total solved" tile and one tile per shown platform (Coach's .tiles). */
export function PlatformTiles({
  totals,
  accounts,
  filter,
}: {
  totals: PlatformTotal[];
  accounts: AccountSummary[];
  filter: PlatformFilter;
}) {
  const sum = totals.reduce((n, t) => n + t.solved, 0);
  const shown = shownTotals(totals, accounts, filter);
  const only = filter === "all" ? null : totals[0];
  const label = only ? `${PLATFORM_META[only.platform].name} solved` : "Total solved";
  const sub = only ? undefined : acrossPlatforms(shown.length);

  return (
    <StatTiles>
      <StatTile tone="primary" size="lg" label={label} value={fmt(sum)} sub={sub} />
      {shown.map((t) => {
        const meta = PLATFORM_META[t.platform];
        const account = accounts.find((a) => a.platform === t.platform);
        return (
          <PlatformStatTile
            key={t.platform}
            total={t}
            badge={
              account ? (
                <Chip
                  tone={statusTone(t.platform, account.status)}
                  title={statusLabel(t.platform, account.status)}
                >
                  {statusLabel(t.platform, account.status, true)}
                </Chip>
              ) : null
            }
            sub={
              account ? (
                <a
                  href={meta.profileUrl(account.handle)}
                  target="_blank"
                  rel="noreferrer"
                  title={account.handle}
                  className="rounded-sm outline-none hover:underline focus-visible:ring-3 focus-visible:ring-ring/50"
                >
                  {displayHandle(t.platform, account.handle)}
                </a>
              ) : undefined
            }
          >
            {t.platform === "atcoder" && !t.rating ? (
              <div className="text-sm text-muted-foreground">
                No rating on file. AtCoder history is limited.
              </div>
            ) : null}
          </PlatformStatTile>
        );
      })}
    </StatTiles>
  );
}
