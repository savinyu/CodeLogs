"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { Chip } from "@/components/kit/chip";
import { Note } from "@/components/kit/note";
import { Panel, PanelHeader } from "@/components/kit/panel";
import { PlatformDot } from "@/components/kit/platform-dot";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { PlatformId } from "@/lib/adapters/types";
import { isSyncedPlatform } from "@/lib/platforms";
import { connectPlatform, disconnectPlatform, type ActionState } from "./actions";
import { LeetcodeImport } from "./leetcode-import";
import { SyncButton } from "./sync-button";
import { VerifyPanel } from "./verify-panel";

type Status = "pending" | "syncing" | "ok" | "partial" | "error";

const STATUS_LABEL: Record<Status, string> = {
  pending: "Pending",
  syncing: "Syncing",
  ok: "Synced",
  partial: "Partial",
  error: "Error",
};

const STATUS_TONE: Record<Status, "neutral" | "primary" | "good"> = {
  pending: "neutral",
  syncing: "neutral",
  ok: "good",
  partial: "neutral",
  error: "primary",
};

export interface PlatformCardProps {
  platform: PlatformId;
  name: string;
  handleHint: string;
  note: string | null;
  account: {
    handle: string;
    profileUrl: string;
    status: Status;
    verified: boolean;
    verifyToken: string | null;
    /** LeetCode: every solve is known (imported, and no gap since). */
    historyComplete: boolean;
    /** ISO timestamp, so it survives the server-to-client boundary. */
    lastSyncedAt: string | null;
    lastError: string | null;
  } | null;
}

const RELATIVE_UNITS: [Intl.RelativeTimeFormatUnit, number][] = [
  ["day", 86_400_000],
  ["hour", 3_600_000],
  ["minute", 60_000],
];

function formatRelative(iso: string): string {
  const diff = new Date(iso).getTime() - Date.now();
  const formatter = new Intl.RelativeTimeFormat("en", { numeric: "auto" });
  for (const [unit, ms] of RELATIVE_UNITS) {
    if (Math.abs(diff) >= ms) return formatter.format(Math.round(diff / ms), unit);
  }
  return "just now";
}

export function PlatformCard({ platform, name, handleHint, note, account }: PlatformCardProps) {
  return (
    <Panel aria-label={name}>
      <PanelHeader
        title={
          <span className="inline-flex items-center gap-2.5">
            <PlatformDot platform={platform} />
            {name}
          </span>
        }
      >
        {note}
      </PanelHeader>
      {account ? (
        <ConnectedView platform={platform} name={name} account={account} />
      ) : (
        <ConnectForm platform={platform} name={name} handleHint={handleHint} />
      )}
    </Panel>
  );
}

function ConnectedView({
  platform,
  name,
  account,
}: {
  platform: PlatformId;
  name: string;
  account: NonNullable<PlatformCardProps["account"]>;
}) {
  const [confirming, setConfirming] = useState(false);
  const [state, action, pending] = useActionState<ActionState, FormData>(disconnectPlatform, null);
  const lastToasted = useRef<ActionState>(null);

  useEffect(() => {
    if (state?.ok && lastToasted.current !== state) {
      lastToasted.current = state;
      toast.success(`Removed your ${name} handle.`);
    }
  }, [state, name]);

  return (
    <div className="flex flex-wrap items-center gap-3">
      <a
        href={account.profileUrl}
        target="_blank"
        rel="noopener noreferrer"
        className="font-semibold underline-offset-4 hover:underline"
      >
        {account.handle}
      </a>
      <Chip tone={STATUS_TONE[account.status]}>{STATUS_LABEL[account.status]}</Chip>
      <Chip tone={account.verified ? "good" : "neutral"}>
        {account.verified ? "Verified" : "Unverified"}
      </Chip>
      <div className="ml-auto flex items-start gap-2">
        <SyncButton
          platform={platform}
          label="Sync now"
          disabled={account.status === "syncing" || pending}
        />
        <form action={action} className="flex items-center gap-2">
          <input type="hidden" name="platform" value={platform} />
          {confirming ? (
            <>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                disabled={pending}
                onClick={() => setConfirming(false)}
              >
                Cancel
              </Button>
              <Button type="submit" variant="destructive" size="sm" disabled={pending}>
                {pending ? "Removing..." : "Confirm remove"}
              </Button>
            </>
          ) : (
            <Button type="button" variant="outline" size="sm" onClick={() => setConfirming(true)}>
              Remove
            </Button>
          )}
        </form>
      </div>
      {state && !state.ok && (
        <Note className="basis-full">
          <p role="alert">{state.error}</p>
        </Note>
      )}
      {account.status === "error" && account.lastError && (
        <Note className="basis-full bg-primary-soft text-primary-ink">
          <p role="alert">{account.lastError}</p>
        </Note>
      )}
      {!account.verified && isSyncedPlatform(platform) && (
        <VerifyPanel platform={platform} name={name} verifyToken={account.verifyToken} />
      )}
      {platform === "leetcode" && (
        <LeetcodeImport handle={account.handle} historyComplete={account.historyComplete} />
      )}
      <p className="basis-full text-sm text-muted-foreground" suppressHydrationWarning>
        {account.lastSyncedAt
          ? `Last synced ${formatRelative(account.lastSyncedAt)}`
          : "Never synced"}
      </p>
      <p className="basis-full text-sm text-muted-foreground">
        Removing a handle also deletes its synced solves.
      </p>
    </div>
  );
}

function ConnectForm({
  platform,
  name,
  handleHint,
}: {
  platform: PlatformId;
  name: string;
  handleHint: string;
}) {
  const [state, action, pending] = useActionState<ActionState, FormData>(connectPlatform, null);
  const lastToasted = useRef<ActionState>(null);
  const inputId = `handle-${platform}`;

  useEffect(() => {
    if (state?.ok && lastToasted.current !== state) {
      lastToasted.current = state;
      toast.success(`Connected your ${name} handle.`);
    }
  }, [state, name]);

  const error = state && !state.ok ? state.error : null;

  return (
    <form action={action} className="grid gap-2">
      <input type="hidden" name="platform" value={platform} />
      <Label htmlFor={inputId}>{name} handle</Label>
      <div className="flex flex-wrap gap-2">
        <Input
          className="h-11 min-w-0 flex-1 basis-48 rounded-full border-0 bg-raised px-4 dark:bg-raised"
          id={inputId}
          name="handle"
          // React resets the form after an action; resetting to the echoed handle keeps what was typed.
          defaultValue={state && !state.ok ? state.handle : undefined}
          placeholder={handleHint}
          autoComplete="off"
          autoCapitalize="none"
          spellCheck={false}
          required
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? `${inputId}-error` : undefined}
          disabled={pending}
        />
        <Button type="submit" disabled={pending}>
          {pending ? "Connecting..." : "Connect"}
        </Button>
      </div>
      {error && (
        <Note className="bg-primary-soft text-primary-ink">
          <p id={`${inputId}-error`} role="alert">
            {error}
          </p>
        </Note>
      )}
    </form>
  );
}
