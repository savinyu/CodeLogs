import Link from "next/link";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { filterDashboard } from "@/lib/dashboard/aggregate";
import type { DashboardData, PlatformFilter } from "@/lib/dashboard/types";
import { ActivityHeatmap } from "./heatmap";
import { DifficultyChart } from "./difficulty-chart";
import { PlatformFilterBar } from "./platform-filter";
import { RecentSolves } from "./recent-solves";
import { TagCharts } from "./tag-chart";
import { TotalsCards } from "./totals";

function Section({
  title,
  description,
  children,
}: {
  title: string;
  description?: string;
  children: React.ReactNode;
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
        {description && <CardDescription>{description}</CardDescription>}
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
  isOwner,
}: {
  data: DashboardData;
  filter: PlatformFilter;
  isOwner: boolean;
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
  const visible = data.accounts.map((a) => a.platform);

  return (
    <div className="flex flex-col gap-6">
      <PlatformFilterBar value={filter} platforms={connected} />
      <TotalsCards totals={data.totals} accounts={data.accounts} />
      <Section title="Activity" description="The last 365 days, in UTC.">
        <ActivityHeatmap activity={data.activity} asOf={data.asOf} />
      </Section>
      <div className="grid gap-6 lg:grid-cols-2">
        <Section title="Difficulty" description="Bands are rough equivalents across platforms.">
          <DifficultyChart rows={data.difficulty} />
        </Section>
        <Section title="Recent solves">
          <RecentSolves solves={data.recent} />
        </Section>
      </div>
      <Section
        title="Topics"
        description="Each platform's own tags. Popular tags you haven't solved are your gaps."
      >
        <TagCharts tags={data.tags} connected={visible} />
      </Section>
    </div>
  );
}
