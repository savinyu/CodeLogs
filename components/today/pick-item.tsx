"use client";

import Link from "next/link";
import { useOptimistic, useTransition } from "react";
import { toast } from "sonner";
import { setPickDone } from "@/app/today/actions";
import { CheckLabel } from "@/components/kit/check-label";
import { Chip } from "@/components/kit/chip";
import { DifficultyBadge } from "@/components/kit/difficulty-badge";
import { PlatformDot } from "@/components/kit/platform-dot";
import { Button } from "@/components/ui/button";
import { PLATFORM_META } from "@/lib/platforms";
import type { TodayPick } from "@/lib/today/set";
import { cn } from "cn";

/** One pick in Today's set (Coach's .q-item) with its optimistic "Mark done" checkbox. */
export function PickItem({
  pick,
  marked,
  track,
}: {
  pick: TodayPick;
  /** Marked done today (daily_marks). */
  marked: boolean;
  /** Name of a followed sheet that contains the problem. */
  track: string | null;
}) {
  const { problem, topic } = pick;
  const [isMarked, setMarked] = useOptimistic(marked);
  const [, startTransition] = useTransition();
  // A synced solve ticks the pick by itself and can't be undone here.
  const synced = problem.solvedToday;
  const done = synced || isMarked;

  function change(next: boolean) {
    startTransition(async () => {
      setMarked(next);
      const result = await setPickDone({
        platform: problem.platform,
        externalId: problem.externalId,
        done: next,
      });
      if (!result.ok) toast.error(result.error);
    });
  }

  return (
    <li
      className={cn(
        "grid items-center gap-x-[18px] gap-y-3 rounded-item px-5 py-[18px] min-[560px]:grid-cols-[minmax(0,1fr)_auto]",
        done ? "bg-good-soft" : "bg-raised",
      )}
    >
      <div className="grid min-w-0 gap-1.5">
        <div className="flex flex-wrap items-center gap-2 text-sm font-semibold text-muted-foreground">
          <PlatformDot platform={problem.platform} />
          {PLATFORM_META[problem.platform].name}
          {problem.difficultyRaw ? (
            <DifficultyBadge platform={problem.platform} raw={problem.difficultyRaw} />
          ) : null}
          {track ? <Chip tone="track">{track}</Chip> : null}
          {problem.maybeSolved ? <Chip tone="primary">may already be solved</Chip> : null}
        </div>
        <a
          href={problem.url}
          target="_blank"
          rel="noopener noreferrer"
          className={cn(
            "text-[1.1875rem] leading-snug font-semibold [overflow-wrap:anywhere] hover:underline",
            done && "text-muted-foreground line-through",
          )}
        >
          {problem.title}
        </a>
        <p className="text-[0.906rem] text-muted-foreground">
          Trains:{" "}
          <Link href={`/topics?topic=${topic.slug}`} className="font-semibold text-primary-ink">
            {topic.name}
            {topic.focus ? ` · ${topic.focus.name}` : ""}
          </Link>
        </p>
      </div>
      <div className="flex items-center justify-between gap-3.5 min-[560px]:justify-start">
        <CheckLabel
          checked={done}
          disabled={synced}
          tone={synced ? "good" : "primary"}
          onCheckedChange={change}
        >
          {synced ? "Solved today" : "Mark done"}
        </CheckLabel>
        <Button
          nativeButton={false}
          render={<a href={problem.url} target="_blank" rel="noopener noreferrer" />}
        >
          Open
        </Button>
      </div>
    </li>
  );
}
