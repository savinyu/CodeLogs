"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { PlatformId } from "@/lib/adapters/types";
import { connectPlatform, disconnectPlatform, type ActionState } from "./actions";
import { SyncButton } from "./sync-button";

type Status = "pending" | "syncing" | "ok" | "partial" | "error";

const STATUS_LABEL: Record<Status, string> = {
  pending: "Pending",
  syncing: "Syncing",
  ok: "Synced",
  partial: "Partial",
  error: "Error",
};

const STATUS_VARIANT: Record<Status, "default" | "secondary" | "destructive" | "outline"> = {
  pending: "outline",
  syncing: "secondary",
  ok: "default",
  partial: "secondary",
  error: "destructive",
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
    <Card>
      <CardHeader>
        <CardTitle>{name}</CardTitle>
        {note && <CardDescription>{note}</CardDescription>}
      </CardHeader>
      <CardContent>
        {account ? (
          <ConnectedView platform={platform} name={name} account={account} />
        ) : (
          <ConnectForm platform={platform} name={name} handleHint={handleHint} />
        )}
      </CardContent>
    </Card>
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
        className="font-medium underline-offset-4 hover:underline"
      >
        {account.handle}
      </a>
      <Badge variant={STATUS_VARIANT[account.status]}>{STATUS_LABEL[account.status]}</Badge>
      <Badge variant={account.verified ? "default" : "outline"}>
        {account.verified ? "Verified" : "Unverified"}
      </Badge>
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
        <p role="alert" className="basis-full text-sm text-destructive">
          {state.error}
        </p>
      )}
      {account.status === "error" && account.lastError && (
        <p role="alert" className="basis-full text-sm text-destructive">
          {account.lastError}
        </p>
      )}
      <p className="basis-full text-xs text-muted-foreground" suppressHydrationWarning>
        {account.lastSyncedAt
          ? `Last synced ${formatRelative(account.lastSyncedAt)}`
          : "Never synced"}
      </p>
      <p className="basis-full text-xs text-muted-foreground">
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
      <div className="flex gap-2">
        <Input
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
        <p id={`${inputId}-error`} role="alert" className="text-sm text-destructive">
          {error}
        </p>
      )}
    </form>
  );
}
