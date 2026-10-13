import { ChevronRightIcon } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { filterDashboard } from "@/lib/dashboard/aggregate";
import { PLATFORM_COLOR, type DashboardData, type PlatformFilter } from "@/lib/dashboard/types";
import { PLATFORM_META } from "@/lib/platforms";
import { getSolveNext } from "@/lib/topics/recommend";
import { DifficultyBadge } from "./difficulty-badge";

const MAX_TOPICS = 3;

export function SolveNextSkeleton() {
  return (
    <div className="space-y-4">
      <Skeleton className="h-5 w-48" />
      <Skeleton className="h-16 w-full" />
      <Skeleton className="h-5 w-40" />
      <Skeleton className="h-16 w-full" />
    </div>
  );
}

export async function SolveNext({
  userId,
  data,
  filter,
}: {
  userId: string;
  data: DashboardData;
  filter: PlatformFilter;
}) {
  const filtered = filterDashboard(data, filter);

  if (filtered.topics.every((t) => t.platforms.length === 0)) {
    return (
      <p className="text-sm text-muted-foreground">
        Recommendations use Codeforces and LeetCode tags.
      </p>
    );
  }

  const picks = (await getSolveNext(userId, filtered)).slice(0, MAX_TOPICS);

  if (picks.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        No weak topics right now: every topic is at least 80% of what&apos;s expected.
      </p>
    );
  }

  return (
    <div className="space-y-6">
      {picks.map((t) => {
        const pct = Math.round(Math.min(Math.max(t.coverage, 0), 1) * 100);
        return (
          // Native <details>: collapsible without client JS, open by default.
          <details key={t.slug} open className="group space-y-2">
            <summary className="-mx-2 cursor-pointer list-none space-y-1 rounded-md px-2 py-1 outline-none hover:bg-muted/50 focus-visible:ring-3 focus-visible:ring-ring/50 [&::-webkit-details-marker]:hidden">
              <h3 className="flex items-center gap-1 text-sm font-semibold">
                <ChevronRightIcon
                  aria-hidden
                  className="-ml-1 size-4 text-muted-foreground transition-transform group-open:rotate-90"
                />
                {t.name}
                {t.problems.length > 0 && (
                  <span className="ml-1 text-xs font-normal text-muted-foreground group-open:hidden">
                    {t.problems.length} {t.problems.length === 1 ? "pick" : "picks"}
                  </span>
                )}
              </h3>
              <div className="flex items-center gap-3">
                <div
                  role="meter"
                  aria-valuemin={0}
                  aria-valuemax={100}
                  aria-valuenow={pct}
                  aria-label={`${t.name} coverage: ${pct}% of expected`}
                  className="h-2 w-32 overflow-hidden rounded-full bg-muted"
                >
                  <div className="h-full bg-primary" style={{ width: `${pct}%` }} />
                </div>
                <span className="text-xs text-muted-foreground">
                  {t.solved} solved · ~{Math.round(t.expected)} expected
                </span>
              </div>
              {t.focus && <p className="text-xs text-muted-foreground">Focus: {t.focus.name}</p>}
            </summary>
            {t.problems.length === 0 ? (
              <p className="text-sm text-muted-foreground">No unsolved picks found.</p>
            ) : (
              <ul className="divide-y">
                {t.problems.map((p) => (
                  <li
                    key={`${p.platform}:${p.externalId}`}
                    className="flex flex-wrap items-center gap-x-3 gap-y-1 py-2"
                  >
                    <span
                      role="img"
                      aria-label={PLATFORM_META[p.platform].name}
                      className="size-2.5 shrink-0 rounded-full"
                      style={{ backgroundColor: PLATFORM_COLOR[p.platform] }}
                    />
                    <a
                      href={p.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="min-w-0 flex-1 basis-40 truncate text-sm font-medium hover:underline"
                    >
                      {p.title}
                    </a>
                    {p.difficultyRaw && <DifficultyBadge raw={p.difficultyRaw} />}
                    {p.maybeSolved && <Badge variant="outline">may already be solved</Badge>}
                  </li>
                ))}
              </ul>
            )}
          </details>
        );
      })}
      <p className="text-xs text-muted-foreground">
        Picks change daily. Expected = what you&apos;d have solved if your solves followed each
        platform&apos;s problem mix (Codeforces: up to your rating + 300).
      </p>
    </div>
  );
}
