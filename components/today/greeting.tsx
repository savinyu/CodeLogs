"use client";

import { useSyncExternalStore } from "react";

const subscribe = () => () => {};
const onClient = () => true;
const onServer = () => false;

function partOfDay(hour: number): string {
  if (hour < 12) return "Morning";
  if (hour < 18) return "Afternoon";
  return "Evening";
}

/**
 * Today's hero: the local date, a greeting by local time, and a line about the picks. The server
 * can't know the visitor's clock, so it renders "Hello" until the page mounts.
 */
export function Greeting({
  firstName,
  pickCount,
  weak,
}: {
  firstName: string;
  pickCount: number;
  /** False when no topic is below the weak threshold and the picks are the lowest-coverage ones. */
  weak: boolean;
}) {
  const mounted = useSyncExternalStore(subscribe, onClient, onServer);
  const now = mounted ? new Date() : null;
  const date = now
    ? now.toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long" })
    : null;

  return (
    <div className="mt-6 mb-6">
      <p className="mb-1 min-h-6 text-base font-semibold text-muted-foreground">{date ?? " "}</p>
      <h1 className="font-display text-[clamp(2.5rem,7vw,4rem)] leading-none font-bold tracking-[-0.02em] text-balance">
        {now ? `${partOfDay(now.getHours())}, ${firstName}.` : `Hello, ${firstName}.`}
      </h1>
      {pickCount > 0 ? (
        <p className="mt-2.5 max-w-[46ch] text-lg text-muted-foreground">
          {pickCount} {pickCount === 1 ? "problem" : "problems"} from your three{" "}
          {weak ? "weakest" : "lowest-coverage"} topics.
        </p>
      ) : null}
    </div>
  );
}
