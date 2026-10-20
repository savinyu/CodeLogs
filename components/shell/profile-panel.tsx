"use client";

import { useId, useOptimistic, useState, useTransition } from "react";
import Link from "next/link";
import { toast } from "sonner";
import { setGlobalBoard, setPublicProfile } from "@/app/settings/actions";
import { SignOutButton } from "@/components/auth/sign-out-button";
import { UserAvatar } from "@/components/kit/user-avatar";
import { buttonVariants } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Switch } from "@/components/ui/switch";
import { cn } from "cn";

// Coach 2's .switch: 48x28, rose when on, with a 22px thumb. The ui Switch has no size prop for
// this, so the thumb is reached through descendant selectors (important to beat its own classes).
const SWITCH =
  "data-[size=default]:h-7 data-[size=default]:w-12 data-unchecked:bg-muted dark:data-unchecked:bg-muted " +
  "[&_[data-slot=switch-thumb]]:ml-[2px] [&_[data-slot=switch-thumb]]:size-[22px]! " +
  "[&_[data-slot=switch-thumb]]:bg-muted-foreground! [&_[data-slot=switch-thumb]]:translate-x-0! " +
  "[&[data-checked]_[data-slot=switch-thumb]]:bg-primary-foreground! " +
  "[&[data-checked]_[data-slot=switch-thumb]]:translate-x-5!";

const ROW_LINK =
  "rounded-full px-3 py-2 text-left text-[0.9375rem] font-semibold outline-none hover:bg-muted focus-visible:ring-3 focus-visible:ring-ring/50";

function SwitchRow({
  label,
  note,
  checked,
  disabled,
  onChange,
}: {
  label: string;
  note: string;
  checked: boolean;
  disabled?: boolean;
  onChange: (next: boolean) => void;
}) {
  const id = useId();
  return (
    <div className="flex items-center justify-between gap-3">
      <div className="min-w-0 flex-1">
        <span className="font-semibold" id={`${id}-label`}>
          {label}
        </span>
        {/* The public URL has no spaces, so it may break anywhere instead of pushing the switch out. */}
        <div className="text-sm wrap-anywhere text-muted-foreground" id={`${id}-note`}>
          {note}
        </div>
      </div>
      <Switch
        checked={checked}
        onCheckedChange={onChange}
        disabled={disabled}
        aria-labelledby={`${id}-label`}
        aria-describedby={`${id}-note`}
        className={SWITCH}
      />
    </div>
  );
}

/** The avatar button and the profile panel it opens. */
export function ProfilePanel({
  user,
  settings,
  host,
}: {
  user: { name: string; username: string | null; email: string; image: string | null };
  settings: { publicProfile: boolean; globalBoard: boolean };
  host: string;
}) {
  const [open, setOpen] = useState(false);
  const [isPublic, setPublicOptimistic] = useOptimistic(settings.publicProfile);
  const [onBoard, setBoardOptimistic] = useOptimistic(settings.globalBoard);
  const [pending, startTransition] = useTransition();

  function changePublic(next: boolean) {
    startTransition(async () => {
      setPublicOptimistic(next);
      const result = await setPublicProfile(next);
      if (!result.ok) toast.error(result.error);
    });
  }

  function changeBoard(next: boolean) {
    startTransition(async () => {
      setBoardOptimistic(next);
      const result = await setGlobalBoard(next);
      if (!result.ok) toast.error(result.error);
    });
  }

  const close = () => setOpen(false);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger
        aria-label="Open profile menu"
        className="rounded-full outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
      >
        <UserAvatar
          name={user.name}
          image={user.image}
          shape="circle"
          tone="soft"
          className="size-10"
        />
      </PopoverTrigger>
      <PopoverContent
        align="end"
        aria-label="Profile menu"
        className="grid w-[min(22.5rem,calc(100vw-2rem))] gap-3.5 rounded-[20px] bg-popover p-5 text-base shadow-pop ring-0"
      >
        <div>
          <h2 className="font-display text-[1.375rem] font-semibold">Welcome, {user.name}</h2>
          <p className="text-[0.9rem] break-all text-muted-foreground">Signed in as {user.email}</p>
        </div>
        <SwitchRow
          label="Public profile"
          note={
            isPublic && user.username
              ? `Visible at ${host}/u/${user.username}`
              : "Only you can see your dashboard"
          }
          checked={isPublic}
          disabled={pending}
          onChange={changePublic}
        />
        <SwitchRow
          label="Global leaderboard"
          note={
            !isPublic
              ? "Needs a public profile"
              : onBoard
                ? "Your weekly points are listed"
                : "Hidden from the global board"
          }
          checked={isPublic && onBoard}
          disabled={pending || !isPublic}
          onChange={changeBoard}
        />
        {isPublic && user.username ? (
          <Link
            href={`/u/${user.username}`}
            onClick={close}
            className={cn(buttonVariants({ size: "sm" }), "w-full")}
          >
            View my public profile
          </Link>
        ) : null}
        <div className="grid gap-0.5 border-t border-border pt-2">
          <Link href="/connect" onClick={close} className={ROW_LINK}>
            Connect platforms
          </Link>
          <Link href="/settings" onClick={close} className={ROW_LINK}>
            Settings
          </Link>
          <SignOutButton className={ROW_LINK} onDone={close} />
        </div>
      </PopoverContent>
    </Popover>
  );
}
