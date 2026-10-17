import { RatingLine } from "@/components/charts/rating-line";
import { Chip } from "@/components/kit/chip";
import { Panel, PanelHeader } from "@/components/kit/panel";
import { PlatformDot } from "@/components/kit/platform-dot";
import { contestFormat, contestTitle } from "@/lib/dashboard/contest-format";
import type { PlatformContests } from "@/lib/dashboard/types";
import { PLATFORM_META } from "@/lib/platforms";

const num = (n: number) => n.toLocaleString("en");

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="grid">
      <b className="font-display text-[1.75rem] leading-[1.1] font-bold">{value}</b>
      <span className="text-[0.84rem] text-muted-foreground">{label}</span>
    </div>
  );
}

/** One platform's rating chart (hover a point for that contest) and stats (Coach's .rating-card). */
export function ContestCard({ contests }: { contests: PlatformContests }) {
  const { platform } = contests;
  const name = PLATFORM_META[platform].name;
  const shared = contests.contests.length;
  const points = contests.contests.flatMap((c) => {
    if (c.newRating === null) return [];
    const format = contestFormat(platform, c.name);
    return [
      {
        at: c.heldAt,
        rating: c.newRating,
        // The format line under the title says what the "(Div. 2)" suffix did.
        name: format ? contestTitle(c.name) : c.name,
        format,
        rank: c.rank,
        delta: c.oldRating === null ? null : c.newRating - c.oldRating,
      },
    ];
  });
  const dash = (n: number | null | undefined) => (n == null ? "–" : num(n));

  return (
    <Panel size="lg" aria-labelledby={`contests-${platform}`}>
      <PanelHeader
        titleId={`contests-${platform}`}
        title={
          <span className="flex items-center gap-2.5">
            <PlatformDot platform={platform} />
            {name}
          </span>
        }
        action={
          contests.topPercentage != null || contests.badge ? (
            <span className="flex flex-wrap gap-2">
              {contests.topPercentage != null && (
                <Chip tone="primary">Top {contests.topPercentage}%</Chip>
              )}
              {contests.badge && <Chip>{contests.badge}</Chip>}
            </span>
          ) : undefined
        }
      />
      {shared === 0 ? (
        <p className="text-muted-foreground">No rated contests yet.</p>
      ) : (
        <>
          {points.length > 0 && (
            <RatingLine platform={platform} points={points} label={`${name} rating over time`} />
          )}
          <div className="mt-3.5 mb-1.5 flex flex-wrap gap-x-7 gap-y-2">
            <Stat label="Contests attended" value={num(contests.attended)} />
            <Stat label="Best rank" value={dash(contests.bestRank)} />
            <Stat label="Current rating" value={dash(contests.currentRating)} />
            <Stat label="Max rating" value={dash(contests.maxRating)} />
            {contests.globalRanking != null && (
              <Stat label="Global rank" value={num(contests.globalRanking)} />
            )}
          </div>
          {contests.attended > shared && (
            <p className="mt-2 text-[0.84rem] text-muted-foreground">
              {name} shares the latest {shared} of your {num(contests.attended)} contests.
            </p>
          )}
        </>
      )}
    </Panel>
  );
}
