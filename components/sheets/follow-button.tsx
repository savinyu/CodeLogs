"use client";

import { useOptimistic, useTransition } from "react";
import { toast } from "sonner";
import { setSheetFollow } from "@/app/sheets/actions";
import { Button } from "@/components/ui/button";
import type { SheetId } from "@/lib/sheets";

/** Follow or unfollow a sheet; flips at once and settles when the action returns. */
export function FollowButton({ sheetId, following }: { sheetId: SheetId; following: boolean }) {
  const [optimistic, setOptimistic] = useOptimistic(following);
  const [, startTransition] = useTransition();

  return (
    <Button
      type="button"
      size="sm"
      variant={optimistic ? "secondary" : "default"}
      aria-pressed={optimistic}
      onClick={() =>
        startTransition(async () => {
          setOptimistic(!optimistic);
          const result = await setSheetFollow({ sheetId, following: !optimistic });
          if (!result.ok) toast.error(result.error);
        })
      }
    >
      {optimistic ? "Following" : "Follow"}
    </Button>
  );
}
