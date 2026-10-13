"use client";

import { useRef, useState, useTransition } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { parseLeetcodeProblemsAll } from "@/lib/leetcode-import";
import { importLeetcodeSolves } from "./import-actions";

const MAX_FILE_BYTES = 10 * 1024 * 1024;
const PROBLEMS_URL = "https://leetcode.com/api/problems/all/";

export function LeetcodeImport({
  handle,
  historyComplete,
}: {
  handle: string;
  historyComplete: boolean;
}) {
  const [open, setOpen] = useState(!historyComplete);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const inputRef = useRef<HTMLInputElement>(null);

  async function onFile(file: File | undefined) {
    if (!file) return;
    setError(null);
    if (file.size > MAX_FILE_BYTES) {
      setError("That file is over 10 MB. Choose the .json you saved from the link above.");
      return;
    }
    let json: unknown;
    try {
      json = JSON.parse(await file.text());
    } catch {
      setError("That file isn't JSON. Save the page from the link above as a .json file.");
      return;
    }
    const parsed = parseLeetcodeProblemsAll(json);
    if (!parsed.ok) {
      setError(parsed.error);
      return;
    }
    startTransition(async () => {
      const result = await importLeetcodeSolves({
        userName: parsed.userName,
        slugs: parsed.slugs,
        numSolved: parsed.numSolved,
      });
      if (inputRef.current) inputRef.current.value = "";
      if (!result.ok) {
        setError(result.error);
        return;
      }
      const skipped =
        result.skipped > 0 ? `, ${result.skipped} skipped (not in the catalog yet)` : "";
      toast.success(
        `Imported ${result.imported} solves (${result.alreadyKnown} already known)${skipped}.`,
      );
      if (!result.complete && result.lifetime !== null) {
        toast.info(
          `Still partial: ${result.known} of ${result.lifetime} solves known. Sync, then import again.`,
        );
      }
      setOpen(false);
    });
  }

  const picker = (
    <div className="flex flex-col gap-2">
      <ol className="list-decimal space-y-1 pl-5 text-xs text-muted-foreground">
        <li>
          While logged in to LeetCode as {handle}, open{" "}
          <a
            href={PROBLEMS_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="text-foreground underline underline-offset-2"
          >
            leetcode.com/api/problems/all
          </a>{" "}
          and save the page (Ctrl/Cmd+S) as a .json file.
        </li>
        <li>Choose that file below.</li>
      </ol>
      <div className="flex flex-wrap items-center gap-2">
        <input
          ref={inputRef}
          type="file"
          accept=".json,application/json"
          className="sr-only"
          id="lc-import-file"
          disabled={pending}
          onChange={(e) => void onFile(e.target.files?.[0])}
        />
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={pending}
          onClick={() => inputRef.current?.click()}
        >
          {pending ? "Importing..." : "Choose file"}
        </Button>
        <span className="text-xs text-muted-foreground">
          The file is read in your browser. Only the list of solved problem names is sent, never
          cookies.
        </span>
      </div>
      {error && (
        <p role="alert" className="text-xs text-destructive">
          {error}
        </p>
      )}
    </div>
  );

  return (
    <div className="flex basis-full flex-col gap-2 border-t pt-3">
      {historyComplete ? (
        <div className="flex flex-wrap items-center gap-2">
          <p className="text-xs text-muted-foreground">
            Full history imported. Sync at least once every 20 solves to keep it complete.
          </p>
          {!open && (
            <Button type="button" variant="ghost" size="xs" onClick={() => setOpen(true)}>
              Re-import
            </Button>
          )}
        </div>
      ) : (
        <p className="text-sm font-medium">Import your full LeetCode history</p>
      )}
      {open && picker}
    </div>
  );
}
