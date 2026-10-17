"use client";

import { useOptimistic, useTransition } from "react";
import { toast } from "sonner";
import { cn } from "cn";
import { setSheetTick } from "@/app/sheets/actions";
import { CheckLabel } from "@/components/kit/check-label";
import { Chip } from "@/components/kit/chip";
import { DifficultyBadge } from "@/components/kit/difficulty-badge";
import { PlatformDot } from "@/components/kit/platform-dot";
import type { SheetProblem } from "@/lib/sheets";

/** One LeetCode problem still to do, or ticked by hand, with a "Solved it" checkbox. */
export function TickRow({ problem, ticked }: { problem: SheetProblem; ticked: boolean }) {
  const [optimistic, setOptimistic] = useOptimistic(ticked);
  const [, startTransition] = useTransition();

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
      <CheckLabel
        checked={optimistic}
        onCheckedChange={(next) =>
          startTransition(async () => {
            setOptimistic(next);
            const result = await setSheetTick({ slug: problem.slug, ticked: next });
            if (!result.ok) toast.error(result.error);
          })
        }
      >
        Solved it
      </CheckLabel>
    </div>
  );
}
