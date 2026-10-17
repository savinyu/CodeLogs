import { cn } from "cn";
import { RatingLine } from "@/components/charts/rating-line";
import { Chip } from "@/components/kit/chip";
import { Disclosure } from "@/components/kit/disclosure";
import { Panel, PanelHeader } from "@/components/kit/panel";
import { PlatformDot } from "@/components/kit/platform-dot";
import { PLATFORM_META } from "@/lib/platforms";
import type { ContestEntry, PlatformContests } from "@/lib/dashboard/types";

const num = (n: number) => n.toLocaleString("en");
const fullDate = (iso: string) =>
  new Date(iso).toLocaleDateString("en-US", {
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  });

function deltaOf(c: ContestEntry): number | null {
  return c.oldRating !== null && c.newRating !== null ? c.newRating - c.oldRating : null;
}

function Delta({ value }: { value: number | null }) {
  if (value === null) {
    return <span className="min-w-[54px] text-right font-bold text-muted-foreground">—</span>;
  }
  return (
    <span
      className={cn(
        "min-w-[54px] text-right font-bold whitespace-nowrap tabular-nums",
        value >= 0 ? "text-good" : "text-primary-ink",
      )}
    >
      {value >= 0 ? "+" : "−"}
      {num(Math.abs(value))}
    </span>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="grid">
      <b className="font-display text-[1.75rem] leading-[1.1] font-bold">{value}</b>
      <span className="text-[0.84rem] text-muted-foreground">{label}</span>
    </div>
  );
}

/** One platform's rating chart, stats and contest history (Coach's .rating-card). */
export function ContestCard({ contests }: { contests: PlatformContests }) {
  const { platform } = contests;
  const name = PLATFORM_META[platform].name;
  const list = [...contests.contests].reverse();
  const last = list[0];
  const points = contests.contests.flatMap((c) =>
    c.newRating === null ? [] : [{ at: c.heldAt, rating: c.newRating, name: c.name }],
  );
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
      {!last ? (
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
          <Disclosure
            className="mt-4"
            summaryClassName="flex-wrap gap-y-1 font-semibold"
            summary={
              <>
                <span className="flex-1 whitespace-nowrap">
                  <span className="group-open:hidden">Show contest history</span>
                  <span className="hidden group-open:inline">Hide contest history</span>{" "}
                  <span className="font-medium text-muted-foreground">
                    ({list.length}
                    {contests.attended > list.length ? ` of ${num(contests.attended)}` : ""})
                  </span>
                </span>
                <span className="min-w-0 truncate text-sm font-medium text-muted-foreground">
                  Last: {last.name.replace(/^Codeforces /, "")}
                </span>
                <Delta value={deltaOf(last)} />
              </>
            }
          >
            <ul aria-label={`${name} contests`} className="grid max-h-[360px] overflow-y-auto">
              {list.map((c) => (
                <li
                  key={c.contestKey}
                  className="grid grid-cols-[minmax(0,1fr)_auto_auto] items-center gap-2.5 py-2.5 text-[0.9375rem] not-first:shadow-[0_-1px_0_var(--border)]"
                >
                  <span className="[overflow-wrap:anywhere]">
                    <a
                      href={c.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="underline-offset-4 hover:underline"
                    >
                      {c.name}
                    </a>
                    <small className="block text-[0.8125rem] text-muted-foreground">
                      {fullDate(c.heldAt)}
                      {c.rank !== null && ` · rank ${num(c.rank)}`}
                    </small>
                  </span>
                  <span className="text-muted-foreground tabular-nums">
                    {c.newRating === null ? "—" : num(c.newRating)}
                  </span>
                  <Delta value={deltaOf(c)} />
                </li>
              ))}
            </ul>
            {contests.attended > list.length && (
              <p className="mt-2 text-[0.84rem] text-muted-foreground">
                {name} shares the latest {list.length} of your {num(contests.attended)} contests.
              </p>
            )}
          </Disclosure>
        </>
      )}
    </Panel>
  );
}
