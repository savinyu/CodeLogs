import { cn } from "cn";
import { DifficultyBadge } from "@/components/kit/difficulty-badge";
import { PlatformDot } from "@/components/kit/platform-dot";
import type { RecentSolve } from "@/lib/dashboard/types";
import { PLATFORM_META } from "@/lib/platforms";
import { formatRelative } from "@/lib/relative-time";

/**
 * Newest-first solve list (Coach's .recent). `now` is the render time in ms; `leetcodeNote` adds the
 * honest "only 20 recent solves" line while LeetCode's full history isn't imported.
 */
export function RecentSolvesList({
  solves,
  limit,
  now,
  leetcodeNote = false,
  className,
}: {
  solves: RecentSolve[];
  limit?: number;
  now: number;
  leetcodeNote?: boolean;
  className?: string;
}) {
  const shown = limit === undefined ? solves : solves.slice(0, limit);
  if (shown.length === 0) {
    return <p className="text-muted-foreground">No recent solves yet.</p>;
  }
  const showNote = leetcodeNote && shown.some((s) => s.platform === "leetcode");

  return (
    <div className={className}>
      <ul className="m-0 grid list-none p-0">
        {shown.map((s) => (
          <li
            key={`${s.platform}:${s.externalId}`}
            className={cn(
              "grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-3 py-3 min-[561px]:grid-cols-[auto_minmax(0,1fr)_auto_auto]",
              "[&:not(:first-child)]:shadow-[0_-1px_0_var(--border)]",
            )}
          >
            <PlatformDot platform={s.platform} title={PLATFORM_META[s.platform].name} />
            <a
              href={s.url}
              target="_blank"
              rel="noreferrer"
              className="rounded-sm font-medium [overflow-wrap:anywhere] outline-none hover:underline focus-visible:ring-3 focus-visible:ring-ring/50"
            >
              {s.title}
            </a>
            {s.difficultyRaw ? (
              <span className="min-[561px]:col-start-3">
                <DifficultyBadge platform={s.platform} raw={s.difficultyRaw} />
              </span>
            ) : null}
            <time
              dateTime={s.solvedAt ?? undefined}
              title={s.solvedAt ? new Date(s.solvedAt).toUTCString() : undefined}
              className="text-sm text-muted-foreground max-[560px]:col-[2/-1] min-[561px]:col-start-4 min-[561px]:min-w-[5.25rem] min-[561px]:text-right"
            >
              {formatRelative(s.solvedAt, now)}
            </time>
          </li>
        ))}
      </ul>
      {showNote ? (
        <p className="mt-2 text-xs text-muted-foreground">
          LeetCode only shares your 20 most recent solves.
        </p>
      ) : null}
    </div>
  );
}
