import Link from "next/link";
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { InfoTip } from "@/components/kit/info-tip";
import { filterDashboard } from "@/lib/dashboard/aggregate";
import { activityYears, parseActivityPeriod } from "@/lib/dashboard/filters";
import { periodRange } from "@/lib/dashboard/heatmap";
import type { DashboardData, PlatformFilter } from "@/lib/dashboard/types";
import { ActiveDays, StreakFlame } from "./active-days";
import { ActivityPeriodFilter } from "./activity-period-filter";
import { ActivityHeatmap } from "./heatmap";
import { Contests } from "./contests";
import { DifficultyChart } from "./difficulty-chart";
import { LeetcodeBadges } from "./leetcode-badges";
import { PlatformFilterBar } from "./platform-filter";
import { RecentSolves } from "./recent-solves";
import { TagCharts } from "./tag-chart";
import { TopicChart } from "./topic-chart";
import { TotalsCards } from "./totals";

function Section({
  title,
  description,
  action,
  children,
}: {
  title: React.ReactNode;
  description?: string;
  action?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <Card>
      {/* One column on phones, so the action drops below the description. */}
      <CardHeader className="max-sm:has-data-[slot=card-action]:grid-cols-1">
        <CardTitle>{title}</CardTitle>
        {description && <CardDescription>{description}</CardDescription>}
        {action && (
          <CardAction className="col-start-1 row-span-1 row-start-3 mt-2 justify-self-start sm:col-start-2 sm:row-span-2 sm:row-start-1 sm:mt-0 sm:justify-self-end">
            {action}
          </CardAction>
        )}
      </CardHeader>
      <CardContent>{children}</CardContent>
    </Card>
  );
}

/**
 * The dashboard body, shared by /dashboard (the owner) and /u/[username] (public, read-only).
 * Server component; the charts inside are client components.
 */
export function DashboardView({
  data: all,
  filter,
  year,
  isOwner,
  solveNext,
  sheets,
}: {
  data: DashboardData;
  filter: PlatformFilter;
  /** Raw ?year= search param; only the Activity card uses it. */
  year?: unknown;
  isOwner: boolean;
  /** Owner-only "Solve next" body (async server component, wrapped in Suspense by the page). */
  solveNext?: React.ReactNode;
  /** Owner-only sheets summary (async server component, wrapped in Suspense by the page). */
  sheets?: React.ReactNode;
}) {
  if (all.accounts.length === 0) {
    return isOwner ? (
      <Link
        href="/connect"
        className="block rounded-xl outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
      >
        <Card className="transition-colors hover:bg-muted/50">
          <CardHeader>
            <CardTitle>Connect your platforms</CardTitle>
            <CardDescription>
              Add your Codeforces, AtCoder and LeetCode handles to start tracking.
            </CardDescription>
          </CardHeader>
        </Card>
      </Link>
    ) : (
      <p className="text-sm text-muted-foreground">No verified platforms yet.</p>
    );
  }

  const data = filterDashboard(all, filter);
  const connected = all.accounts.map((a) => a.platform);
  const years = activityYears(data.activity);
  const period = parseActivityPeriod(year, years);
  // The streak is "right now", so it only shows when the period runs up to today.
  const showStreak = periodRange(period, data.asOf).end === data.asOf;
  const visible = data.accounts.map((a) => a.platform);
  const atcoderVisible = visible.includes("atcoder");

  return (
    <div className="flex flex-col gap-6">
      <PlatformFilterBar value={filter} platforms={connected} period={period} />
      <TotalsCards totals={data.totals} accounts={data.accounts} />
      {/* 13rem leaves the heatmap room for a full year (~730px) inside max-w-5xl. */}
      <div className="grid gap-6 lg:grid-cols-[13rem_minmax(0,1fr)]">
        <Section
          title="Active days"
          action={
            showStreak && <StreakFlame activity={data.activity} asOf={data.asOf} period={period} />
          }
        >
          <ActiveDays activity={data.activity} asOf={data.asOf} period={period} />
        </Section>
        <Section
          title="Activity"
          description={period === "last12" ? "The last 12 months, in UTC." : `${period}, in UTC.`}
          action={<ActivityPeriodFilter years={years} period={period} platform={filter} />}
        >
          <ActivityHeatmap activity={data.activity} asOf={data.asOf} period={period} />
        </Section>
      </div>
      <Section title="Topics" description="Your solves on one shared topic list, across platforms.">
        <TopicChart topics={data.topics} showExpected={isOwner} />
      </Section>
      {solveNext && (
        <Section
          title="Solve next"
          description="Your weakest topics, with unsolved problems at your level."
        >
          {solveNext}
        </Section>
      )}
      {sheets && (
        <Section title="Sheets" description="Your progress through popular LeetCode problem lists.">
          {sheets}
        </Section>
      )}
      <div className="grid gap-6 lg:grid-cols-2">
        <Section
          title={
            <span className="inline-flex items-center gap-1.5">
              Difficulty
              <InfoTip label="About difficulty bands">
                Bands group your solves by difficulty so the platforms line up. Band 1 is the
                easiest and Band 5 the hardest. Hover a bar to see each band&apos;s rating range per
                platform. Unrated solves have no difficulty available.
              </InfoTip>
            </span>
          }
          description="Bands are rough equivalents across platforms."
        >
          <DifficultyChart rows={data.difficulty} />
        </Section>
        <Section title="Recent solves" description="Newest first.">
          <RecentSolves
            solves={data.recent}
            leetcodeHistoryComplete={
              data.accounts.find((a) => a.platform === "leetcode")?.historyComplete ?? false
            }
          />
        </Section>
      </div>
      {(data.contests.length > 0 || atcoderVisible) && (
        <Section title="Contests" description="Rated contests and your rating over time.">
          <Contests contests={data.contests} atcoderVisible={atcoderVisible} />
        </Section>
      )}
      {data.leetcodeBadges.length > 0 && (
        <Section title="LeetCode badges">
          <LeetcodeBadges badges={data.leetcodeBadges} />
        </Section>
      )}
      <Section
        title="Platform tags"
        description="Each platform's own tags. Popular tags you haven't solved are your gaps."
      >
        <TagCharts tags={data.tags} connected={visible} />
      </Section>
    </div>
  );
}
