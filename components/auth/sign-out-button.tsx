"use client";

import { toast } from "sonner";
import { DropdownMenuItem } from "@/components/ui/dropdown-menu";
import { signOut } from "@/lib/auth-client";

/** A dropdown menu item that signs the user out. Render it inside <DropdownMenuContent>. */
export function SignOutMenuItem() {
  async function handleClick() {
    try {
      const result = await signOut();
      if (result.error) throw new Error(result.error.message);
      // Hard navigation, so the client router cache can't show signed-in pages on Back.
      // eslint-disable-next-line @next/next/no-location-assign-relative-destination
      window.location.assign("/");
    } catch {
      toast.error("Could not sign out. Please try again.");
    }
  }

  return <DropdownMenuItem onClick={handleClick}>Sign out</DropdownMenuItem>;
}

/** A plain button that signs the user out, for panels that aren't dropdown menus. */
export function SignOutButton({ className, onDone }: { className?: string; onDone?: () => void }) {
  async function handleClick() {
    try {
      const result = await signOut();
      if (result.error) throw new Error(result.error.message);
      onDone?.();
      // eslint-disable-next-line @next/next/no-location-assign-relative-destination
      window.location.assign("/");
    } catch {
      toast.error("Could not sign out. Please try again.");
    }
  }

  return (
    <button type="button" className={className} onClick={handleClick}>
      Sign out
    </button>
  );
}
