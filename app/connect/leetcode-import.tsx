"use client";

import { useRef, useState, useTransition, type ClipboardEvent, type DragEvent } from "react";
import { cn } from "cn";
import { toast } from "sonner";
import { Note } from "@/components/kit/note";
import { Button } from "@/components/ui/button";
import { parseLeetcodeImportText } from "@/lib/leetcode-import";
import { importLeetcodeSolves } from "./import-actions";

const MAX_TEXT_LENGTH = 10 * 1024 * 1024;
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
  const [dragging, setDragging] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const dropRef = useRef<HTMLDivElement>(null);

  function importText(text: string) {
    setError(null);
    if (text.length > MAX_TEXT_LENGTH) {
      setError("That's over 10 MB. Copy only the page at the link above.");
      return;
    }
    const parsed = parseLeetcodeImportText(text);
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
      // Keep the picker open while the history is still partial, so the user can import again.
      setOpen(!result.complete);
    });
  }

  async function onFile(file: File | undefined) {
    if (!file) return;
    if (file.size > MAX_TEXT_LENGTH) {
      setError("That file is over 10 MB. Choose the page you saved from the link above.");
      return;
    }
    const text = await file.text();
    if (inputRef.current) inputRef.current.value = "";
    importText(text);
  }

  async function onPasteClick() {
    let text: string;
    try {
      text = await navigator.clipboard.readText();
    } catch {
      setError("Couldn't read the clipboard. Click the box below and press Cmd/Ctrl+V instead.");
      dropRef.current?.focus();
      return;
    }
    if (text.trim() === "") {
      setError("The clipboard is empty. Copy the page at the link above first.");
      return;
    }
    importText(text);
  }

  function onPaste(e: ClipboardEvent<HTMLDivElement>) {
    const text = e.clipboardData.getData("text/plain");
    if (!text) return;
    e.preventDefault();
    if (!pending) importText(text);
  }

  function onDrop(e: DragEvent<HTMLDivElement>) {
    e.preventDefault();
    setDragging(false);
    if (pending) return;
    const file = e.dataTransfer.files[0];
    if (file) void onFile(file);
    else {
      const text = e.dataTransfer.getData("text/plain");
      if (text) importText(text);
    }
  }

  const picker = (
    <div className="flex flex-col gap-2">
      <ol className="list-decimal space-y-1 pl-5 text-sm text-muted-foreground">
        <li>
          While logged in to LeetCode as {handle}, open{" "}
          <a
            href={PROBLEMS_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="text-foreground underline underline-offset-2"
          >
            leetcode.com/api/problems/all
          </a>
          .
        </li>
        <li>Select everything on that page and copy it (Cmd/Ctrl+A, then Cmd/Ctrl+C).</li>
        <li>Come back here and click Paste, or click the box and press Cmd/Ctrl+V.</li>
      </ol>
      <div
        ref={dropRef}
        tabIndex={0}
        role="group"
        aria-label="Paste or drop your LeetCode problems page here"
        onPaste={onPaste}
        onDragOver={(e) => {
          e.preventDefault();
          setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={onDrop}
        className={cn(
          "flex flex-col gap-2 rounded-item border border-dashed border-border bg-raised p-4 outline-none focus-visible:ring-2 focus-visible:ring-ring",
          dragging && "border-primary bg-primary-soft",
        )}
      >
        <div className="flex flex-wrap items-center gap-2">
          <Button type="button" size="sm" disabled={pending} onClick={() => void onPasteClick()}>
            {pending ? "Importing..." : "Paste"}
          </Button>
          <input
            ref={inputRef}
            type="file"
            accept=".json,.html,.htm,.txt,application/json,text/html,text/plain"
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
            Choose file
          </Button>
          <span className="text-sm text-muted-foreground">
            or drop a saved page here (.json, or the .html that Cmd/Ctrl+S saves).
          </span>
        </div>
        <span className="text-sm text-muted-foreground">
          It&apos;s read in your browser. Only the list of solved problem names is sent, never
          cookies.
        </span>
      </div>
      {error && (
        <Note className="bg-primary-soft text-primary-ink">
          <p role="alert">{error}</p>
        </Note>
      )}
    </div>
  );

  return (
    <div className="flex basis-full flex-col gap-3 border-t border-border pt-4">
      {historyComplete ? (
        <div className="flex flex-wrap items-center gap-2">
          <p className="text-sm text-muted-foreground">
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
