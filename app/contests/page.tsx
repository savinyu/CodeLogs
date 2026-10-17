import { Suspense } from "react";
import { cn } from "cn";
import { ContestCard } from "@/components/contests/contest-card";
import { LeetcodeBadgesGrid } from "@/components/contests/badges-grid";
import { ConnectPrompt } from "@/components/kit/connect-prompt";
import { Note } from "@/components/kit/note";
import { Page } from "@/components/kit/page";
import { PageHead } from "@/components/kit/page-head";
import { Panel, PanelHeader } from "@/components/kit/panel";
import { PlatformDot } from "@/components/kit/platform-dot";
import { Skeleton } from "@/components/ui/skeleton";
import { getDashboardData } from "@/lib/dashboard/queries";
import { PLATFORM_META } from "@/lib/platforms";
import { requireUser } from "@/lib/session";

export const metadata = { title: "Contests" };

export default function ContestsPage() {
  return (
    <Page>
      <PageHead
        title="Contests"
        description="Rating over time. Hover a point on the chart to see that contest’s format, rank and rating change."
      />
      <Suspense fallback={<ContestsSkeleton />}>
        <ContestsContent />
      </Suspense>
    </Page>
  );
}

async function ContestsContent() {
  const user = await requireUser();
  const data = await getDashboardData(user.id);
  const has = (p: string) => data.accounts.some((a) => a.platform === p);

  if (data.accounts.length === 0) return <ConnectPrompt />;

  // A connected platform without a single contest gets a one-line note, not an empty card.
  const entered = data.contests.filter((c) => c.attended > 0 || c.currentRating !== null);
  const notEntered = data.contests.filter((c) => !entered.includes(c));

  return (
    <div className="grid gap-5">
      {entered.length > 0 ? (
        <div
          className={cn("grid grid-cols-1 gap-5", entered.length > 1 && "min-[900px]:grid-cols-2")}
        >
          {entered.map((c) => (
            <ContestCard key={c.platform} contests={c} />
          ))}
        </div>
      ) : null}
      {notEntered.map((c) => (
        <Note key={c.platform} icon={<PlatformDot platform={c.platform} className="mt-2" />}>
          <b>{PLATFORM_META[c.platform].name}.</b> No rated contests yet. Your rating and contest
          history show up here after your first one.
        </Note>
      ))}
      {data.contests.length > 0 ? null : (
        <p className="text-muted-foreground">
          Contest history comes from Codeforces and LeetCode. Connect either one to see it here.
        </p>
      )}
      {has("atcoder") && (
        <Note icon={<PlatformDot platform="atcoder" className="mt-2" />}>
          <b>AtCoder.</b> AtCoder contest history isn’t available. AtCoder’s robots.txt disallows
          it.
        </Note>
      )}
      {has("leetcode") && (
        <Panel size="lg" aria-labelledby="lc-badges">
          <PanelHeader
            titleId="lc-badges"
            title="LeetCode badges"
            action={
              <span className="text-muted-foreground">{data.leetcodeBadges.length} earned</span>
            }
            className="mb-0"
          />
          {data.leetcodeBadges.length > 0 ? (
            <LeetcodeBadgesGrid badges={data.leetcodeBadges} />
          ) : (
            <p className="mt-4 text-muted-foreground">No badges yet.</p>
          )}
        </Panel>
      )}
    </div>
  );
}

function ContestsSkeleton() {
  return (
    <div className="grid grid-cols-1 gap-5 min-[900px]:grid-cols-2">
      <Skeleton className="h-96 rounded-card-lg" />
      <Skeleton className="h-96 rounded-card-lg" />
    </div>
  );
}
