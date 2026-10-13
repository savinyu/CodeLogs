"use client";

import { useActionState, useState } from "react";
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
          Type <span className="font-mono font-semibold">{phrase}</span> to confirm
        </Label>
        <Input
          id="delete-confirmation"
          name="confirmation"
          autoComplete="off"
          autoCapitalize="off"
          spellCheck={false}
          value={value}
          onChange={(e) => setValue(e.target.value)}
        />
      </div>
      {state?.ok === false && (
        <p role="alert" className="text-sm text-destructive">
          {state.error}
        </p>
      )}
      <div>
        <Button type="submit" variant="destructive" disabled={pending || value.trim() !== phrase}>
          {pending ? "Deleting…" : "Delete my account"}
        </Button>
      </div>
    </form>
  );
}
