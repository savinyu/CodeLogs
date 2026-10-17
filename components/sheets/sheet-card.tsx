import Link from "next/link";
import { cn } from "cn";
import { Bar } from "@/components/kit/bar";
import { Chip } from "@/components/kit/chip";
import { FollowButton } from "@/components/sheets/follow-button";
import type { SheetProgress } from "@/lib/sheets";

/** One sheet in the card row: progress, a link to select it, and a follow toggle. */
export function SheetCard({
  sheet,
  selected,
  following,
}: {
  sheet: SheetProgress;
  selected: boolean;
  following: boolean;
}) {
  const listed = sheet.total + sheet.offPlatform;
  return (
    <div
      className={cn(
        "grid min-w-0 content-start gap-2.5 rounded-card bg-card p-5",
        selected && "shadow-[inset_0_0_0_2px_var(--primary)]",
      )}
    >
      <div className="flex flex-wrap items-center justify-between gap-2.5">
        <h3 className="font-display text-lg font-semibold">
          <Link
            href={`/sheets?sheet=${sheet.id}`}
            scroll={false}
            aria-current={selected ? "true" : undefined}
            className="rounded-sm outline-none hover:underline focus-visible:ring-3 focus-visible:ring-ring/50"
          >
            {sheet.name}
          </Link>
        </h3>
        {selected ? <Chip tone="primary">Shown below</Chip> : null}
      </div>
      <div className="font-display text-[2.125rem] leading-none font-bold tabular-nums">
        {sheet.solved}
        <small className="text-lg font-semibold text-muted-foreground"> / {sheet.total}</small>
        {sheet.offPlatform > 0 ? (
          <small className="ml-2 text-sm font-semibold text-muted-foreground">
            of {listed} total
          </small>
        ) : null}
      </div>
      <Bar
        value={sheet.total > 0 ? sheet.solved / sheet.total : 0}
        tone="neutral"
        label={`${sheet.name}: ${sheet.solved} of ${sheet.total} solved`}
      />
      <p className="text-sm text-muted-foreground">{sheet.note}</p>
      <div>
        <FollowButton sheetId={sheet.id} following={following} />
      </div>
    </div>
  );
}
