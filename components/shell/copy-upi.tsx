"use client";

import { CopyIcon } from "lucide-react";
import { toast } from "sonner";

/** The UPI ID as a pill that copies itself. */
export function CopyUpi({ id }: { id: string }) {
  async function copy() {
    try {
      await navigator.clipboard.writeText(id);
      toast.success("Copied the UPI ID.");
    } catch {
      toast.error("Couldn't copy. Select the UPI ID and copy it by hand.");
    }
  }

  return (
    <button
      type="button"
      onClick={copy}
      aria-label={`Copy UPI ID ${id}`}
      className="inline-flex items-center gap-1.5 rounded-full bg-muted px-3 py-1 font-mono text-[0.8rem] text-foreground outline-none select-all hover:bg-raised focus-visible:ring-3 focus-visible:ring-ring/50"
    >
      {id}
      <CopyIcon aria-hidden="true" className="size-3.5 text-muted-foreground" />
    </button>
  );
}
