import { Suspense } from "react";
import { cn } from "cn";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { LeetcodeBadgesGrid } from "@/components/contests/badges-grid";
import { ContestCard } from "@/components/contests/contest-card";
import { Note } from "@/components/kit/note";
import { Page } from "@/components/kit/page";
import { Panel, PanelHeader } from "@/components/kit/panel";
import { PlatformDot } from "@/components/kit/platform-dot";
import { StatTile, StatTiles } from "@/components/kit/stat-tile";
import { OwnerBanner } from "@/components/profile/owner-banner";
import { ProfileHero } from "@/components/profile/profile-hero";
import { SignupCta } from "@/components/profile/signup-cta";
import { ActivityRow } from "@/components/progress/activity-row";
import { RecentSolvesList } from "@/components/progress/recent-solves";
import { MapLegend, TopicMap } from "@/components/topics/topic-map";
import { Skeleton } from "@/components/ui/skeleton";
import { countUnverifiedAccounts } from "@/lib/accounts";
import { getDashboardData, getPublicProfile } from "@/lib/dashboard/queries";
import { getFriendship } from "@/lib/friends/queries";
import { renderNow } from "@/lib/clock";
import { PLATFORM_META } from "@/lib/platforms";
import { getCurrentUser } from "@/lib/session";
import { getSocialLinks } from "@/lib/social-links";
import { topicViews } from "@/lib/topics/view";

export async function generateMetadata({ params }: PageProps<"/u/[username]">): Promise<Metadata> {
  const { username } = await params;
  const profile = await getPublicProfile(username);
  if (!profile) return { title: "Profile not found · CodeLogs" };
  return {
    title: `${profile.name} (@${profile.username}) · CodeLogs`,
    description: `${profile.name}'s solved problems across Codeforces, AtCoder and LeetCode.`,
  };
}

const fmt = (n: number) => n.toLocaleString("en-US");

function joinNames(names: string[]): string {
  if (names.length <= 1) return names.join("");
  return `${names.slice(0, -1).join(", ")} and ${names[names.length - 1]}`;
}

async function PublicProfileContent({ params }: Pick<PageProps<"/u/[username]">, "params">) {
  const { username } = await params;
  // Private and unknown profiles look the same from outside.
  const profile = await getPublicProfile(username);
  if (!profile) notFound();

  const viewer = await getCurrentUser();
  const isOwner = viewer?.id === profile.userId;
  const [data, links, friendship, hiddenCount] = await Promise.all([
    getDashboardData(profile.userId, { verifiedOnly: true }),
    getSocialLinks(profile.userId),
    viewer && !isOwner ? getFriendship(viewer.id, profile.userId) : undefined,
    // The owner's unverified handles are hidden here, so count them for the banner.
    isOwner ? countUnverifiedAccounts(profile.userId) : 0,
  ]);
  const now = await renderNow();

  const banner = isOwner ? <OwnerBanner hiddenCount={hiddenCount} /> : null;
  const cta = viewer ? null : <SignupCta />;
  const hero = (
    <ProfileHero
      name={profile.name}
      username={profile.username}
      image={profile.image}
      firstActiveDay={data.activity[0]?.day ?? null}
      github={profile.username}
      links={links}
      handles={data.accounts.map((a) => ({ platform: a.platform, handle: a.handle }))}
      friendship={friendship}
    />
  );

  if (data.accounts.length === 0) {
    return (
      <>
        {banner}
        {hero}
        <Note>No verified platforms yet.</Note>
        {cta}
      </>
    );
  }

  const total = data.totals.reduce((n, t) => n + t.solved, 0);
  const platformNames = data.totals.map((t) => PLATFORM_META[t.platform].name);
  const cfRating = data.totals.find((t) => t.platform === "codeforces")?.rating;
  const lcContests = data.contests.find((c) => c.platform === "leetcode");
  // Tile size is problems solved, so topics with none would be empty slivers.
  const solvedTopics = topicViews(data.topics).filter((t) => Math.round(t.solved) > 0);
  const hasTopics = solvedTopics.length > 0;
  const hasLeetcode = data.accounts.some((a) => a.platform === "leetcode");
  const contests = data.contests.filter((c) => c.contests.length > 0);

  return (
    <>
      {banner}
      {hero}
      <StatTiles>
        <StatTile
          tone="primary"
          label="Problems solved"
          value={fmt(total)}
          sub={joinNames(platformNames)}
        />
        {cfRating ? (
          <StatTile
            label={
              <>
                <PlatformDot platform="codeforces" />
                Codeforces
              </>
            }
            value={fmt(cfRating.current)}
            sub={`${cfRating.rank ? `${cfRating.rank} · ` : ""}max ${fmt(cfRating.max)}`}
          />
        ) : null}
        {lcContests?.currentRating != null ? (
          <StatTile
            label={
              <>
                <PlatformDot platform="leetcode" />
                LeetCode
              </>
            }
            value={fmt(lcContests.currentRating)}
            sub={
              lcContests.topPercentage != null
                ? `contest rating · top ${lcContests.topPercentage}%`
                : "contest rating"
            }
          />
        ) : null}
      </StatTiles>

      <div className="mt-5">
        <ActivityRow activity={data.activity} asOf={data.asOf} period="last12" />
      </div>

      {hasTopics ? (
        <Panel size="lg" aria-labelledby="public-topics" className="mt-5">
          <PanelHeader
            title="Topics"
            titleId="public-topics"
            action={
              <span className="text-sm text-muted-foreground">Tile size = problems solved</span>
            }
          />
          <TopicMap topics={solvedTopics} mode="public" />
          <MapLegend mode="public" />
          <p className="mt-2.5 text-sm text-muted-foreground">
            Visitors see what you have solved per topic. Coverage percentages and the weak labels
            need your expected numbers, so they stay on your own map.
          </p>
        </Panel>
      ) : null}

      {contests.length > 0 ? (
        <div
          className={cn(
            "mt-5 grid grid-cols-1 gap-5",
            contests.length > 1 && "min-[900px]:grid-cols-2",
          )}
        >
          {contests.map((c) => (
            <ContestCard key={c.platform} contests={c} />
          ))}
        </div>
      ) : null}

      {hasLeetcode && data.leetcodeBadges.length > 0 ? (
        <Panel size="lg" aria-labelledby="public-badges" className="mt-5">
          <PanelHeader
            title="LeetCode badges"
            titleId="public-badges"
            className="mb-0"
            action={
              <span className="text-muted-foreground">{data.leetcodeBadges.length} earned</span>
            }
          />
          <LeetcodeBadgesGrid badges={data.leetcodeBadges} />
        </Panel>
      ) : null}

      <Panel aria-labelledby="public-recent" className="mt-5">
        <PanelHeader title="Recently solved" titleId="public-recent" />
        <RecentSolvesList solves={data.recent} limit={6} now={now} />
      </Panel>

      {cta}
    </>
  );
}

export default function PublicProfilePage(props: PageProps<"/u/[username]">) {
  return (
    <Page>
      <Suspense
        fallback={
          <div className="grid gap-5 pt-7" aria-hidden>
            <Skeleton className="h-28 w-2/3 rounded-card" />
            <Skeleton className="h-36 rounded-card" />
            <Skeleton className="h-64 rounded-card" />
          </div>
        }
      >
        <PublicProfileContent params={props.params} />
      </Suspense>
    </Page>
  );
}
