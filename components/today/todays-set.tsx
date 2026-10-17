import Link from "next/link";
import { Panel, PanelHeader } from "@/components/kit/panel";
import { Ring } from "@/components/kit/ring";
import { Button } from "@/components/ui/button";
import type { TodayPick } from "@/lib/today/set";
import type { GoalProgress } from "@/lib/today/week";
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

/** Today's set: the daily goal and the ordered picks. */
export function TodaysSet({
  picks,
  goal,
}: {
  picks: { pick: TodayPick; marked: boolean; track: string | null }[];
  goal: GoalProgress;
}) {
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
            {picks.map(({ pick, marked, track }) => (
              <PickItem
                key={`${pick.problem.platform}:${pick.problem.externalId}`}
                pick={pick}
                marked={marked}
                track={track}
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
