"use client";

import { useActionState, useState } from "react";
import { Note } from "@/components/kit/note";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { deleteConfirmationPhrase } from "@/lib/account-export-shared";
import { deleteAccount, type DeleteAccountState } from "./actions";

export function DeleteAccountForm({ username }: { username: string | null }) {
  const [state, action, pending] = useActionState<DeleteAccountState, FormData>(
    deleteAccount,
    null,
  );
  const [value, setValue] = useState("");
  const [confirming, setConfirming] = useState(false);
  const phrase = deleteConfirmationPhrase(username);
  const matches = value.trim() === phrase;

  // The first submit (click or Enter) only shows the warning; the second one deletes.
  function onSubmit(e: React.FormEvent) {
    if (confirming) return;
    e.preventDefault();
    if (matches) setConfirming(true);
  }

  return (
    <form action={action} onSubmit={onSubmit} className="grid gap-3">
      <div className="grid gap-1.5">
        <Label htmlFor="delete-confirmation">
          {/* One span: Label is a flex row, which would space out the parts. */}
          <span>
            Type <span className="font-semibold">{phrase}</span> to confirm
          </span>
        </Label>
        <Input
          id="delete-confirmation"
          name="confirmation"
          autoComplete="off"
          autoCapitalize="off"
          spellCheck={false}
          value={value}
          className="h-11 rounded-full border-0 bg-raised px-4 dark:bg-raised"
          onChange={(e) => {
            setValue(e.target.value);
            setConfirming(false);
          }}
        />
      </div>
      {confirming && matches && (
        <Note className="bg-destructive/10 text-destructive">
          <p role="alert">
            <span className="font-semibold">All your data will be deleted.</span> Your account,
            connected handles, synced solves, stats, sheet progress, friends and public profile are
            removed for good. This cannot be undone.
          </p>
        </Note>
      )}
      {state?.ok === false && (
        <Note className="bg-destructive/10 text-destructive">
          <p role="alert">{state.error}</p>
        </Note>
      )}
      <div className="flex flex-wrap items-center gap-3">
        <Button type="submit" variant="destructive" disabled={pending || !matches}>
          {pending ? "Deleting…" : confirming ? "Confirm, delete everything" : "Delete my account"}
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
