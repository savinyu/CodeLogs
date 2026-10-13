import { Badge } from "@/components/ui/badge";
import { humanizeSlug } from "@/lib/dashboard/aggregate";
import { PLATFORM_COLOR } from "@/lib/dashboard/types";
import type { RecentSolve } from "@/lib/dashboard/types";
import { DifficultyBadge } from "./difficulty-badge";

const DATE_FORMAT = new Intl.DateTimeFormat("en-GB", {
  day: "numeric",
  month: "short",
  year: "numeric",
  timeZone: "UTC",
});

function formatDate(iso: string | null): string {
  if (!iso) return "date unknown";
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? "date unknown" : DATE_FORMAT.format(d);
}

export function RecentSolves({ solves }: { solves: RecentSolve[] }) {
  if (solves.length === 0) {
    return <p className="text-sm text-muted-foreground">No solves yet.</p>;
  }
  const hasLeetCode = solves.some((s) => s.platform === "leetcode");

  return (
    <div className="space-y-2">
      <ul className="divide-y">
        {solves.map((s) => (
          <li
            key={`${s.platform}:${s.externalId}`}
            className="flex flex-wrap items-center gap-x-3 gap-y-1 py-2"
          >
            <span
              aria-hidden
              className="size-2.5 shrink-0 rounded-full"
              style={{ backgroundColor: PLATFORM_COLOR[s.platform] }}
            />
            <a
              href={s.url}
              target="_blank"
              rel="noreferrer"
              className="min-w-0 flex-1 basis-40 truncate text-sm font-medium hover:underline"
            >
              {s.title}
            </a>
            {s.difficultyRaw && <DifficultyBadge raw={s.difficultyRaw} />}
            {s.tags.slice(0, 3).map((tag) => (
              <Badge key={tag} variant="secondary" className="text-muted-foreground">
                {s.platform === "leetcode" ? humanizeSlug(tag) : tag}
              </Badge>
            ))}
            <span className="ml-auto text-xs whitespace-nowrap text-muted-foreground">
              {formatDate(s.solvedAt)}
            </span>
          </li>
        ))}
      </ul>
      {hasLeetCode && (
        <p className="text-xs text-muted-foreground">
          LeetCode only shares your 20 most recent solves.
        </p>
      )}
    </div>
  );
}
