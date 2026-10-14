import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PLATFORM_META } from "@/lib/platforms";
import { PLATFORM_COLOR } from "@/lib/dashboard/types";
import type { AccountSummary, PlatformTotal } from "@/lib/dashboard/types";

const STATUS_LABEL: Partial<Record<AccountSummary["status"], string>> = {
  error: "Sync error",
  syncing: "Syncing",
  pending: "Pending",
};

export function TotalsCards({
  totals,
  accounts,
}: {
  totals: PlatformTotal[];
  accounts: AccountSummary[];
}) {
  // Hide empty platforms, unless the card carries a sync status worth seeing.
  const shown = totals.filter((t) => {
    const status = accounts.find((a) => a.platform === t.platform)?.status;
    return t.solved > 0 || (status !== undefined && STATUS_LABEL[status] !== undefined);
  });
  const sum = shown.reduce((acc, t) => acc + t.solved, 0);
  const hasReported = shown.some((t) => t.source === "reported");

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
      {shown.length > 1 && (
        <Card>
          <CardHeader>
            <CardTitle>Total solved</CardTitle>
          </CardHeader>
          <CardContent className="space-y-1">
            <p className="text-3xl font-semibold tabular-nums">{sum}</p>
            {hasReported && (
              <p className="text-xs text-muted-foreground">
                Includes LeetCode&apos;s own lifetime count.
              </p>
            )}
          </CardContent>
        </Card>
      )}
      {shown.map((t) => {
        const meta = PLATFORM_META[t.platform];
        const account = accounts.find((a) => a.platform === t.platform);
        const statusLabel = account ? STATUS_LABEL[account.status] : undefined;
        return (
          <Card key={t.platform}>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <span
                  aria-hidden
                  className="size-2.5 shrink-0 rounded-full"
                  style={{ backgroundColor: PLATFORM_COLOR[t.platform] }}
                />
                {meta.name}
                {t.source === "reported" && <Badge variant="outline">count</Badge>}
                {statusLabel && (
                  <Badge
                    variant={account?.status === "error" ? "destructive" : "secondary"}
                    className="ml-auto"
                  >
                    {statusLabel}
                  </Badge>
                )}
              </CardTitle>
              {account && (
                <a
                  href={meta.profileUrl(account.handle)}
                  target="_blank"
                  rel="noreferrer"
                  className="truncate text-sm text-muted-foreground hover:underline"
                >
                  {account.handle}
                </a>
              )}
            </CardHeader>
            <CardContent className="space-y-1">
              <p className="text-3xl font-semibold tabular-nums">{t.solved}</p>
              {t.rating && (
                <p className="text-xs text-muted-foreground">
                  {t.rating.current} (max {t.rating.max})
                  {t.rating.rank ? ` · ${t.rating.rank}` : ""}
                </p>
              )}
              {t.source === "reported" && (
                <p className="text-xs text-muted-foreground">
                  {account?.historyComplete
                    ? `Full history imported: ${t.listed.toLocaleString("en-US")} ${t.listed === 1 ? "problem" : "problems"}.`
                    : "Lifetime count reported by LeetCode; only recent solves are listed."}
                </p>
              )}
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
