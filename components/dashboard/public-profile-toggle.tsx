"use client";

import { useOptimistic, useTransition } from "react";
import Link from "next/link";
import { toast } from "sonner";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { setPublicProfile } from "@/app/dashboard/actions";

/** Owner-only switch for the public /u/<username> page. */
export function PublicProfileToggle({
  username,
  enabled,
  unverified,
}: {
  username: string;
  enabled: boolean;
  /** Connected handles that the public page leaves out until they're verified. */
  unverified: number;
}) {
  const [optimistic, setOptimistic] = useOptimistic(enabled);
  const [pending, startTransition] = useTransition();

  function onChange(next: boolean) {
    startTransition(async () => {
      setOptimistic(next);
      const result = await setPublicProfile(next);
      if (!result.ok) toast.error(result.error);
    });
  }

  return (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm">
      <div className="flex items-center gap-2">
        <Switch
          id="public-profile"
          checked={optimistic}
          onCheckedChange={onChange}
          disabled={pending}
        />
        <Label htmlFor="public-profile">Public profile</Label>
      </div>
      {optimistic ? (
        <>
          <Link href={`/u/${username}`} className="text-muted-foreground hover:underline">
            /u/{username}
          </Link>
          {unverified > 0 && (
            <Link href="/connect" className="text-muted-foreground hover:underline">
              {unverified === 1 ? "1 unverified handle" : `${unverified} unverified handles`} hidden
            </Link>
          )}
        </>
      ) : (
        <span className="text-muted-foreground">Only you can see this dashboard.</span>
      )}
    </div>
  );
}
