import { Suspense } from "react";
import { PlatformLegend, StackedColumns } from "@/components/charts/stacked-columns";
import { ConnectPrompt } from "@/components/kit/connect-prompt";
import { Page } from "@/components/kit/page";
import { PageHead } from "@/components/kit/page-head";
import { Panel, PanelHeader } from "@/components/kit/panel";
import { SegmentedLinks } from "@/components/kit/segmented-links";
import { ActivityRow } from "@/components/progress/activity-row";
import { PlatformTiles } from "@/components/progress/platform-tiles";
import { RecentSolvesList } from "@/components/progress/recent-solves";
import { SyncLine } from "@/components/progress/sync-line";
import { Skeleton } from "@/components/ui/skeleton";
import { filterDashboard, parsePlatformFilter } from "@/lib/dashboard/aggregate";
import { activityYears, dashboardHref, parseActivityPeriod } from "@/lib/dashboard/filters";
import { monthlyTotals } from "@/lib/dashboard/monthly";
import { getDashboardData } from "@/lib/dashboard/queries";
import { DIFFICULTY_BANDS } from "@/lib/dashboard/types";
import { PLATFORM_META } from "@/lib/platforms";
import { requireUser } from "@/lib/session";

export const metadata = { title: "Progress" };

/** Read after the data fetch, so it is request time (the React purity lint can't see through it). */
function renderTime(): number {
  return Date.now();
}

export default function ProgressPage({ searchParams }: PageProps<"/progress">) {
  return (
    <Page>
      <PageHead
        title="Progress"
        description="Everything you have solved, across all three platforms."
      />
      <Suspense fallback={<ProgressSkeleton />}>
        <ProgressContent searchParams={searchParams} />
      </Suspense>
    </Page>
  );
}

async function ProgressContent({ searchParams }: Pick<PageProps<"/progress">, "searchParams">) {
  const user = await requireUser();
  const params = await searchParams;
  const all = await getDashboardData(user.id);
  if (all.accounts.length === 0) return <ConnectPrompt />;

  const filter = parsePlatformFilter(params.platform);
  const data = filterDashboard(all, filter);
  const connected = all.accounts.map((a) => a.platform);
  const shown = data.accounts.map((a) => a.platform);
  const years = activityYears(data.activity);
  const period = parseActivityPeriod(params.year, years);
  const now = renderTime();

  const platformLinks = [
    {
      href: dashboardHref("/progress", { platform: "all", period }),
      label: "All",
      active: filter === "all",
    },
    ...connected.map((p) => ({
      href: dashboardHref("/progress", { platform: p, period }),
      label: PLATFORM_META[p].name,
      active: filter === p,
    })),
  ];
  const periodLinks =
    years.length === 0
      ? undefined
      : [
          { label: "Last 12 months", value: "last12" as const },
          ...years.map((y) => ({ label: String(y), value: y })),
        ].map((o) => ({
          href: dashboardHref("/progress", { platform: filter, period: o.value }),
          label: o.label,
          active: period === o.value,
        }));

  const difficultyRows = data.difficulty
    .filter((r) => r.band !== null || r.total > 0)
    .map((r) => ({
      label: r.band === null ? "Unrated" : DIFFICULTY_BANDS[r.band].label,
      hint: r.band === null ? "No difficulty available" : DIFFICULTY_BANDS[r.band].hint,
      counts: r.counts,
    }));
  const recentHint = filter === "all" ? "" : ` · ${PLATFORM_META[filter].name}`;
  const lc = data.accounts.find((a) => a.platform === "leetcode");

  return (
    <div className="grid gap-5">
      {connected.length > 1 ? (
        <Panel className="flex flex-wrap items-center justify-between gap-3">
          <SegmentedLinks label="Platform filter" items={platformLinks} onCard />
          <span className="text-sm text-muted-foreground">Filters totals and recent solves</span>
        </Panel>
      ) : null}
      <div>
        <PlatformTiles totals={data.totals} accounts={data.accounts} filter={filter} />
        <SyncLine accounts={all.accounts} />
      </div>
      <ActivityRow
        activity={data.activity}
        asOf={data.asOf}
        period={period}
        periodLinks={periodLinks}
      />
      <div className="grid gap-5 min-[901px]:grid-cols-2">
        <Panel aria-labelledby="monthly-title">
          <PanelHeader
            title="Solves per month"
            titleId="monthly-title"
            action={<span className="text-sm text-muted-foreground">Last 12 months</span>}
          />
          <StackedColumns
            rows={monthlyTotals(data.activity, data.asOf)}
            label="Solves per month, last 12 months, by platform"
          />
          <PlatformLegend platforms={shown} />
        </Panel>
        <Panel aria-labelledby="difficulty-title">
          <PanelHeader
            title="Difficulty"
            titleId="difficulty-title"
            action={
              <span
                className="text-sm text-muted-foreground"
                title="Band 1 is the easiest and Band 5 the hardest. Hover a bar for its rating range per platform."
              >
                Band 1 easiest · hover for ranges
              </span>
            }
          />
          <StackedColumns rows={difficultyRows} label="Solves by difficulty band, by platform" />
          <PlatformLegend platforms={shown} />
        </Panel>
      </div>
      <Panel aria-labelledby="recent-title">
        <PanelHeader
          title="Recent solves"
          titleId="recent-title"
          action={
            <span className="text-sm text-muted-foreground">
              {data.recent.length} shown{recentHint}
            </span>
          }
        />
        <RecentSolvesList
          solves={data.recent}
          now={now}
          leetcodeNote={lc !== undefined && !lc.historyComplete}
        />
      </Panel>
    </div>
  );
}

function ProgressSkeleton() {
  return (
    <div className="grid gap-5" aria-hidden>
      <Skeleton className="h-16 rounded-card" />
      <div className="grid grid-cols-[repeat(auto-fill,minmax(16rem,1fr))] gap-3.5">
        {[0, 1, 2, 3].map((i) => (
          <Skeleton key={i} className="h-40 rounded-card" />
        ))}
      </div>
      <Skeleton className="h-64 rounded-card" />
      <Skeleton className="h-80 rounded-card" />
    </div>
  );
}
