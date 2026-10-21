"use client";

import { useEffect, useState, useTransition } from "react";
import { Note } from "@/components/kit/note";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { parseNewUsername } from "@/lib/username-change";
import { changeUsername, checkUsername, type UsernameCheckResult } from "./actions";

/** Wait this long after the last keystroke before asking the server whether a name is free. */
const CHECK_DELAY_MS = 400;

export function UsernameForm({ username }: { username: string | null }) {
  const [value, setValue] = useState("");
  // Server replies by username, so a slow reply for an older value can't show for a newer one.
  const [checked, setChecked] = useState<Record<string, UsernameCheckResult>>({});
  const [confirming, setConfirming] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  /** The candidate whose check request failed (network or server error). */
  const [failed, setFailed] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  // Format errors show at once, without a server call.
  const local = value.trim() === "" ? null : parseNewUsername(value, username);
  const candidate = local?.ok ? local.username : null;
  const result = candidate ? checked[candidate] : undefined;
  const free = result?.ok ? result.username : null;

  useEffect(() => {
    if (!candidate || result || failed === candidate) return;
    const timer = setTimeout(async () => {
      try {
        const reply = await checkUsername(candidate);
        setChecked((prev) => ({ ...prev, [candidate]: reply }));
      } catch {
        // Not remembered: editing the field asks again.
        setFailed(candidate);
      }
    }, CHECK_DELAY_MS);
    return () => clearTimeout(timer);
  }, [candidate, result, failed]);

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!free) return;
    if (!confirming) {
      setConfirming(true);
      return;
    }
    setSaveError(null);
    startTransition(async () => {
      try {
        const saved = await changeUsername(free);
        // On success the page re-renders without this form (the one change is used).
        if (!saved.ok) {
          setSaveError(saved.error);
          setConfirming(false);
          setChecked((prev) => ({ ...prev, [free]: saved }));
        }
      } catch {
        setSaveError("Could not save. Check your connection and try again.");
        setConfirming(false);
      }
    });
  }

  const status = !local
    ? null
    : !local.ok
      ? { ok: false, text: local.error }
      : failed === candidate
        ? { ok: false, text: "Could not check that username. Try again." }
        : !result
          ? { ok: true, text: "Checking…" }
          : result.ok
            ? { ok: true, text: `@${result.username} is available.` }
            : { ok: false, text: result.error };

  return (
    <form onSubmit={onSubmit} className="grid gap-3">
      <div className="grid gap-1.5">
        <Label htmlFor="new-username">New username</Label>
        {/* The pill is the field: it carries the focus and invalid rings, so the input has none. */}
        <div className="flex h-11 items-center rounded-full bg-raised pl-4 focus-within:ring-3 focus-within:ring-ring/50 has-[[aria-invalid=true]]:ring-3 has-[[aria-invalid=true]]:ring-destructive/20 dark:has-[[aria-invalid=true]]:ring-destructive/40">
          <span className="text-muted-foreground select-none" aria-hidden>
            @
          </span>
          <Input
            id="new-username"
            name="username"
            maxLength={40}
            autoComplete="off"
            autoCapitalize="off"
            spellCheck={false}
            placeholder="new-username"
            value={value}
            disabled={pending}
            onChange={(e) => {
              setValue(e.target.value);
              setConfirming(false);
              setSaveError(null);
              setFailed(null);
            }}
            aria-invalid={status?.ok === false ? true : undefined}
            aria-describedby="new-username-status"
            className="h-11 rounded-full border-0 bg-transparent pl-0.5 focus-visible:ring-0 aria-invalid:ring-0 dark:bg-transparent"
          />
        </div>
        <p
          id="new-username-status"
          role="status"
          aria-live="polite"
          className={
            status?.ok === false ? "text-sm text-primary-ink" : "text-sm text-muted-foreground"
          }
        >
          {status?.text}
        </p>
      </div>
      {confirming && free && (
        <Note>
          <p>
            You can change your username only once. Your profile moves to{" "}
            <span className="font-mono">/u/{free}</span>
            {username && (
              <>
                , links to <span className="font-mono">/u/{username}</span> stop working, and{" "}
                <span className="font-mono">@{username}</span> becomes free for someone else
              </>
            )}
            .
          </p>
        </Note>
      )}
      {saveError && (
        <Note className="bg-destructive/10 text-destructive">
          <p role="alert">{saveError}</p>
        </Note>
      )}
      <div className="flex flex-wrap items-center gap-3">
        <Button type="submit" disabled={pending || !free}>
          {pending ? "Saving…" : confirming && free ? `Yes, use @${free}` : "Change username"}
        </Button>
        {confirming && !pending && (
          <Button type="button" variant="outline" onClick={() => setConfirming(false)}>
            Cancel
          </Button>
        )}
      </div>
    </form>
  );
}
