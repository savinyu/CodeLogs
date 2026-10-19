"use client";

import { useActionState, useEffect, useRef } from "react";
import { toast } from "sonner";
import { Note } from "@/components/kit/note";
import { Button } from "@/components/ui/button";
import type { SyncedPlatformId } from "@/lib/adapters/types";
import { VERIFY_FIELD } from "@/lib/verification";
import { checkVerification, startVerification, type VerifyState } from "./verify-actions";

export function VerifyPanel({
  platform,
  name,
  verifyToken,
}: {
  platform: SyncedPlatformId;
  name: string;
  verifyToken: string | null;
}) {
  const [startState, startAction, starting] = useActionState<VerifyState, FormData>(
    startVerification,
    null,
  );
  const [checkState, checkAction, checking] = useActionState<VerifyState, FormData>(
    checkVerification,
    null,
  );
  const lastToasted = useRef<VerifyState>(null);
  const field = VERIFY_FIELD[platform];

  useEffect(() => {
    if (checkState?.ok && lastToasted.current !== checkState) {
      lastToasted.current = checkState;
      toast.success(`Verified your ${name} handle.`);
    }
  }, [checkState, name]);

  const error =
    (checkState && !checkState.ok && checkState.error) ||
    (startState && !startState.ok && startState.error) ||
    null;

  async function copy() {
    if (!verifyToken) return;
    try {
      await navigator.clipboard.writeText(verifyToken);
      toast.success("Copied the code.");
    } catch {
      toast.error("Couldn't copy. Select the code and copy it by hand.");
    }
  }

  return (
    <div className="grid basis-full gap-2 text-sm">
      {!verifyToken ? (
        <form action={startAction} className="flex flex-wrap items-center gap-3">
          <input type="hidden" name="platform" value={platform} />
          <p className="text-muted-foreground">
            Verify this handle to show it on your public profile.
          </p>
          <Button type="submit" variant="outline" size="sm" disabled={starting}>
            {starting ? "Getting code..." : "Verify"}
          </Button>
        </form>
      ) : (
        <ol className="grid list-inside list-decimal gap-3 rounded-item bg-raised p-4 text-muted-foreground">
          <li>
            Copy your code:{" "}
            <code className="rounded-item bg-raised px-2 py-1 font-mono break-all text-foreground">
              {verifyToken}
            </code>{" "}
            <Button type="button" variant="outline" size="xs" onClick={copy}>
              Copy
            </Button>
          </li>
          <li>
            Paste it into your {field.label} on{" "}
            <a
              href={field.settingsUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="text-foreground underline underline-offset-4"
            >
              {name}
            </a>
            . {field.hint}
          </li>
          <li>
            <form action={checkAction} className="inline-flex flex-wrap items-center gap-2">
              <input type="hidden" name="platform" value={platform} />
              <Button type="submit" size="sm" disabled={checking}>
                {checking ? "Checking..." : "Check"}
              </Button>
              <span>You can remove the code once you are verified.</span>
            </form>
          </li>
        </ol>
      )}
      {error && (
        <Note className="bg-primary-soft text-primary-ink">
          <p role="alert">{error}</p>
        </Note>
      )}
    </div>
  );
}
