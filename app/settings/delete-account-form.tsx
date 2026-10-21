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
  const phrase = deleteConfirmationPhrase(username);

  return (
    <form action={action} className="grid gap-3">
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
          onChange={(e) => setValue(e.target.value)}
        />
      </div>
      {state?.ok === false && (
        <Note className="bg-destructive/10 text-destructive">
          <p role="alert">{state.error}</p>
        </Note>
      )}
      <div>
        <Button type="submit" variant="destructive" disabled={pending || value.trim() !== phrase}>
          {pending ? "Deleting…" : "Delete my account"}
        </Button>
      </div>
    </form>
  );
}
