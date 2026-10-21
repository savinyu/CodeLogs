import { cn } from "cn";
import { Chip } from "@/components/kit/chip";
import { PlatformDot } from "@/components/kit/platform-dot";
import { StatTile } from "@/components/kit/stat-tile";
import type { PlatformTotal } from "@/lib/dashboard/types";
import { PLATFORM_META } from "@/lib/platforms";

const fmt = (n: number) => n.toLocaleString("en-US");

// The split chips show the tier's initial and the number in the difficulty's color; the full tier
// name is on hover and for screen readers.
const SPLIT: {
  key: "easy" | "medium" | "hard";
  letter: string;
  name: string;
  className: string;
}[] = [
  { key: "easy", letter: "E", name: "Easy", className: "text-difficulty-easy" },
  { key: "medium", letter: "M", name: "Medium", className: "text-difficulty-medium" },
  { key: "hard", letter: "H", name: "Hard", className: "text-difficulty-hard" },
];

/** A platform's lifetime Easy / Medium / Hard split as E / M / H chips. */
function SplitChips({ split }: { split: NonNullable<PlatformTotal["split"]> }) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {SPLIT.map((d) => (
        <Chip key={d.key} title={d.name} className={d.className}>
          <span aria-hidden="true">{d.letter}</span>
          <span className="sr-only">{d.name}</span> {fmt(split[d.key])}
        </Chip>
      ))}
    </div>
  );
}

// Codeforces' rank colors (lowercase rank names, as user.info returns them).
const CF_RANK: Record<string, string> = {
  newbie: "text-cf-newbie",
  pupil: "text-cf-pupil",
  specialist: "text-cf-specialist",
  expert: "text-cf-expert",
  "candidate master": "text-cf-candidate-master",
  master: "text-cf-master",
  "international master": "text-cf-master",
  grandmaster: "text-cf-grandmaster",
  "international grandmaster": "text-cf-grandmaster",
  "legendary grandmaster": "text-cf-grandmaster",
};

/** A Codeforces rank name in its rank color. */
function CfRank({ rank }: { rank: string }) {
  return (
    <span className={cn("font-semibold", CF_RANK[rank.toLowerCase()])}>{rank.toLowerCase()}</span>
  );
}

/** "Rating 839 · max 1,062 · newbie", with the rank in its color. */
function RatingLine({ rating }: { rating: NonNullable<PlatformTotal["rating"]> }) {
  return (
    <div className="text-sm text-muted-foreground">
      Rating <b className="font-semibold text-foreground">{fmt(rating.current)}</b> · max{" "}
      {fmt(rating.max)}
      {rating.rank ? (
        <>
          {" · "}
          <CfRank rank={rating.rank} />
        </>
      ) : null}
    </div>
  );
}

function PlatformExtra({ total: t }: { total: PlatformTotal }) {
  if (t.rating) return <RatingLine rating={t.rating} />;
  if (t.split) return <SplitChips split={t.split} />;
  if (t.platform === "atcoder") {
    return (
      <div className="text-sm text-muted-foreground">
        No rating on file. AtCoder history is limited.
      </div>
    );
  }
  return null;
}

/**
 * One platform's tile: its name, solved count, the sub line and its rating or split. Progress and
 * the public profile both use it. `badge` sits beside the name; `sub` is the line under the count.
 */
export function PlatformStatTile({
  total,
  badge,
  sub,
}: {
  total: PlatformTotal;
  badge?: React.ReactNode;
  sub?: React.ReactNode;
}) {
  return (
    <StatTile
      label={
        <>
          <PlatformDot platform={total.platform} />
          {PLATFORM_META[total.platform].name}
          {badge}
        </>
      }
      value={fmt(total.solved)}
      sub={sub}
    >
      <PlatformExtra total={total} />
    </StatTile>
  );
}
