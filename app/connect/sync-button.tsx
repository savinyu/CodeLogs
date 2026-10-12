"use client";

import { useActionState, useEffect, useRef } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import type { PlatformId } from "@/lib/adapters/types";
import { syncNow, type SyncState } from "./actions";

/** Omit `platform` to sync every connected account. */
export function SyncButton({
  platform,
  label,
  disabled = false,
  variant = "outline",
}: {
  platform?: PlatformId;
  label: string;
  disabled?: boolean;
  variant?: "outline" | "default";
}) {
  const [state, action, pending] = useActionState<SyncState, FormData>(syncNow, null);
  const lastToasted = useRef<SyncState>(null);

  useEffect(() => {
    if (!state || lastToasted.current === state) return;
    lastToasted.current = state;
    if (!state.ok) toast.error(state.error);
    else if (state.queued === 0) toast.info("Synced recently. Try again in a few minutes.");
    else toast.success(state.queued === 1 ? "Sync started." : `Started ${state.queued} syncs.`);
  }, [state]);

  return (
    <form action={action} className="flex flex-col items-end gap-1">
      {platform && <input type="hidden" name="platform" value={platform} />}
      <Button type="submit" variant={variant} size="sm" disabled={disabled || pending}>
        {pending ? "Starting..." : label}
      </Button>
      {state && !state.ok && (
        <p role="alert" className="text-xs text-destructive">
          {state.error}
        </p>
      )}
    </form>
  );
}
