import { Chip } from "@/components/kit/chip";
import { PlatformDot } from "@/components/kit/platform-dot";
import { StatTile, StatTiles } from "@/components/kit/stat-tile";
import type { PlatformId } from "@/lib/adapters/types";
import type { AccountSummary, PlatformFilter, PlatformTotal } from "@/lib/dashboard/types";
import { isExtensionPlatform, PLATFORM_META } from "@/lib/platforms";

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
  const only = filter === "all" ? null : totals[0];
  const label = only ? `${PLATFORM_META[only.platform].name} solved` : "Total solved";
  const sub = only
    ? only.source === "reported"
      ? `count reported by ${PLATFORM_META[only.platform].name}`
      : "tracked from your submissions"
    : `across ${totals.length} ${totals.length === 1 ? "platform" : "platforms"}`;

  return (
    <StatTiles>
      <StatTile tone="primary" label={label} value={fmt(sum)} sub={sub} />
      {totals.map((t) => {
        const meta = PLATFORM_META[t.platform];
        const account = accounts.find((a) => a.platform === t.platform);
        return (
          <StatTile
            key={t.platform}
            label={
              <>
                <PlatformDot platform={t.platform} />
                {meta.name}
                {account ? (
                  <Chip
                    tone={statusTone(t.platform, account.status)}
                    title={statusLabel(t.platform, account.status)}
                  >
                    {statusLabel(t.platform, account.status, true)}
                  </Chip>
                ) : null}
              </>
            }
            value={fmt(t.solved)}
            sub={
              <>
                {t.source === "reported"
                  ? isExtensionPlatform(t.platform)
                    ? "reported count"
                    : `count (reported by ${meta.name})`
                  : "solved"}
                {account ? (
                  <>
                    {" · "}
                    <a
                      href={meta.profileUrl(account.handle)}
                      target="_blank"
                      rel="noreferrer"
                      className="rounded-sm outline-none hover:underline focus-visible:ring-3 focus-visible:ring-ring/50"
                    >
                      {account.handle}
                    </a>
                  </>
                ) : null}
              </>
            }
          >
            <Extra total={t} />
          </StatTile>
        );
      })}
    </StatTiles>
  );
}

function Extra({ total: t }: { total: PlatformTotal }) {
  if (t.rating) {
    return (
      <div className="text-sm text-muted-foreground">
        Rating <b className="font-semibold text-foreground">{t.rating.current}</b> · max{" "}
        {t.rating.max}
        {t.rating.rank ? ` · ${t.rating.rank}` : ""}
      </div>
    );
  }
  if (t.split) {
    return (
      <div className="flex flex-wrap gap-1.5">
        <Chip>Easy {fmt(t.split.easy)}</Chip>
        <Chip>Medium {fmt(t.split.medium)}</Chip>
        <Chip>Hard {fmt(t.split.hard)}</Chip>
      </div>
    );
  }
  if (t.platform === "atcoder") {
    return (
      <div className="text-sm text-muted-foreground">
        No rating on file. AtCoder history is limited.
      </div>
    );
  }
  return null;
}
