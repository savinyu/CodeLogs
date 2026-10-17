"use client";

import { useOptimistic, useTransition } from "react";
import { toast } from "sonner";
import { cn } from "cn";
import { setSheetTick } from "@/app/sheets/actions";
import { Chip } from "@/components/kit/chip";
import { DifficultyBadge } from "@/components/kit/difficulty-badge";
import { PlatformDot } from "@/components/kit/platform-dot";
import type { SheetProblem } from "@/lib/sheets";

/** One LeetCode problem still to do, or ticked by hand, with a "Solved it" checkbox. */
export function TickRow({ problem, ticked }: { problem: SheetProblem; ticked: boolean }) {
  const [optimistic, setOptimistic] = useOptimistic(ticked);
  const [, startTransition] = useTransition();
  const id = `tick-${problem.slug}`;

  return (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-1 py-2 not-first:shadow-[0_-1px_0_var(--border)]">
      <PlatformDot platform="leetcode" />
      <a
        href={problem.url}
        target="_blank"
        rel="noopener noreferrer"
        className={cn(
          "min-w-40 flex-1 font-semibold [overflow-wrap:anywhere] hover:underline",
          optimistic && "text-muted-foreground line-through",
        )}
      >
        {problem.title}
      </a>
      <DifficultyBadge platform="leetcode" raw={problem.difficulty} />
      {problem.premium ? <Chip>Premium</Chip> : null}
      <label
        htmlFor={id}
        className="inline-flex cursor-pointer items-center gap-2 text-[0.906rem] font-semibold text-muted-foreground"
      >
        <input
          id={id}
          type="checkbox"
          checked={optimistic}
          onChange={(e) => {
            const next = e.target.checked;
            startTransition(async () => {
              setOptimistic(next);
              const result = await setSheetTick({ slug: problem.slug, ticked: next });
              if (!result.ok) toast.error(result.error);
            });
          }}
          className="grid size-6 shrink-0 cursor-pointer appearance-none place-items-center rounded-lg bg-muted outline-none checked:bg-primary checked:after:h-[11px] checked:after:w-1.5 checked:after:translate-x-px checked:after:-translate-y-px checked:after:rotate-45 checked:after:border-solid checked:after:border-primary-foreground checked:after:border-r-[2.5px] checked:after:border-b-[2.5px] checked:after:content-[''] focus-visible:ring-3 focus-visible:ring-ring/50"
        />
        Solved it
      </label>
    </div>
  );
}
