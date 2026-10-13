import Link from "next/link";
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { filterDashboard } from "@/lib/dashboard/aggregate";
import { activityYears, parseActivityPeriod } from "@/lib/dashboard/filters";
import type { DashboardData, PlatformFilter } from "@/lib/dashboard/types";
import { ActivityPeriodFilter } from "./activity-period-filter";
import { ActivityHeatmap } from "./heatmap";
import { DifficultyChart } from "./difficulty-chart";
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
  title: string;
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
}: {
  data: DashboardData;
  filter: PlatformFilter;
  /** Raw ?year= search param; only the Activity card uses it. */
  year?: unknown;
  isOwner: boolean;
  /** Owner-only "Solve next" body (async server component, wrapped in Suspense by the page). */
  solveNext?: React.ReactNode;
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
      <p className="text-sm text-muted-foreground">No platforms connected yet.</p>
    );
  }

  const data = filterDashboard(all, filter);
  const connected = all.accounts.map((a) => a.platform);
  const years = activityYears(data.activity);
  const period = parseActivityPeriod(year, years);
  const visible = data.accounts.map((a) => a.platform);

  return (
    <div className="flex flex-col gap-6">
      <PlatformFilterBar value={filter} platforms={connected} period={period} />
      <TotalsCards totals={data.totals} accounts={data.accounts} />
      <Section
        title="Activity"
        description={period === "last12" ? "The last 12 months, in UTC." : `${period}, in UTC.`}
        action={<ActivityPeriodFilter years={years} period={period} platform={filter} />}
      >
        <ActivityHeatmap activity={data.activity} asOf={data.asOf} period={period} />
      </Section>
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
      <div className="grid items-start gap-6 lg:grid-cols-2">
        <Section title="Difficulty" description="Bands are rough equivalents across platforms.">
          <DifficultyChart rows={data.difficulty} />
        </Section>
        <Section title="Recent solves">
          <RecentSolves solves={data.recent} />
        </Section>
      </div>
      <Section
        title="Platform tags"
        description="Each platform's own tags. Popular tags you haven't solved are your gaps."
      >
        <TagCharts tags={data.tags} connected={visible} />
      </Section>
    </div>
  );
}
