"use client";

import Link from "next/link";
import { useOptimistic, useTransition } from "react";
import { toast } from "sonner";
import { setPickDone } from "@/app/today/actions";
import { Panel, PanelHeader } from "@/components/kit/panel";
import { Ring } from "@/components/kit/ring";
import { Button } from "@/components/ui/button";
import type { TodayPick } from "@/lib/today/set";
import { goalDone, goalProgress, type GoalProgress } from "@/lib/today/week";
import { cn } from "cn";
import { PickItem } from "./pick-item";

function GoalPill({ goal }: { goal: GoalProgress }) {
  const { done, met } = goal;
  return (
    <div className="flex items-center gap-2.5 rounded-full bg-raised py-[5px] pr-3.5 pl-[5px] max-[560px]:w-full">
      <Ring
        value={goal.fraction}
        tone={met ? "good" : "primary"}
        label={`Daily goal: ${done} of ${goal.goal} solved today`}
      >
        <span className="text-[0.9375rem]">{done}</span>
      </Ring>
      <div className="leading-tight">
        <b className="block text-[0.906rem]">
          {done} of {goal.goal} today
        </b>
        <span
          className={cn(
            "block text-[0.8125rem] text-muted-foreground",
            met && "font-semibold text-good",
          )}
        >
          {met ? "Goal met" : `${goal.goal - done} to go`}
        </span>
      </div>
    </div>
  );
}

const keyOf = (pick: TodayPick) => `${pick.problem.platform}:${pick.problem.externalId}`;

/**
 * Today's set: the daily goal and the ordered picks. "Mark done" is optimistic here, so the goal
 * ring moves with the tick instead of waiting for the server round trip.
 */
export function TodaysSet({
  picks,
  todayTotal,
  dailyGoal,
  day,
}: {
  picks: { pick: TodayPick; marked: boolean; track: string | null }[];
  /** Today's synced solves. */
  todayTotal: number;
  dailyGoal: number;
  /** The UTC day this page shows (YYYY-MM-DD); marks are filed under it. */
  day: string;
}) {
  const [marks, setMark] = useOptimistic(
    new Set(picks.filter((p) => p.marked).map((p) => keyOf(p.pick))),
    (state, { key, done }: { key: string; done: boolean }) => {
      const next = new Set(state);
      if (done) next.add(key);
      else next.delete(key);
      return next;
    },
  );
  const [, startTransition] = useTransition();

  function change(pick: TodayPick, done: boolean) {
    startTransition(async () => {
      setMark({ key: keyOf(pick), done });
      try {
        const result = await setPickDone({
          platform: pick.problem.platform,
          externalId: pick.problem.externalId,
          done,
          day,
        });
        if (!result.ok) toast.error(result.error);
      } catch {
        toast.error("Could not save that. Try again.");
      }
    });
  }

  const goal = goalProgress(
    goalDone(
      todayTotal,
      picks.map(({ pick }) => ({
        marked: marks.has(keyOf(pick)),
        solvedToday: pick.problem.solvedToday,
      })),
    ),
    dailyGoal,
  );

  return (
    <Panel size="lg" aria-labelledby="todays-set">
      <PanelHeader
        title="Today’s set"
        titleId="todays-set"
        align="center"
        action={<GoalPill goal={goal} />}
      />
      {picks.length > 0 ? (
        <>
          <ol className="grid gap-3">
            {picks.map(({ pick, track }) => (
              <PickItem
                key={keyOf(pick)}
                pick={pick}
                marked={marks.has(keyOf(pick))}
                track={track}
                onMarkedChange={(done) => change(pick, done)}
              />
            ))}
          </ol>
          <p className="mt-4 text-[0.906rem] text-muted-foreground">
            New picks every day. Solves sync on their own.
          </p>
        </>
      ) : (
        <div className="grid justify-items-start gap-3">
          <p className="text-muted-foreground">
            No picks right now. Picks come from the topics where you are behind, and there are none
            to suggest yet.
          </p>
          <Button variant="secondary" nativeButton={false} render={<Link href="/topics" />}>
            See your topics
          </Button>
        </div>
      )}
    </Panel>
  );
}
