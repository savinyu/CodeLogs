"use client";

import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { DropdownMenuItem } from "@/components/ui/dropdown-menu";
import { signOut } from "@/lib/auth-client";

/** A dropdown menu item that signs the user out. Render it inside <DropdownMenuContent>. */
export function SignOutMenuItem() {
  const router = useRouter();

  async function handleClick() {
    try {
      await signOut();
      router.push("/");
      router.refresh();
    } catch {
      toast.error("Could not sign out. Please try again.");
    }
  }

  return <DropdownMenuItem onClick={handleClick}>Sign out</DropdownMenuItem>;
}

/** A plain button that signs the user out, for panels that aren't dropdown menus. */
export function SignOutButton({ className, onDone }: { className?: string; onDone?: () => void }) {
  const router = useRouter();

  async function handleClick() {
    try {
      await signOut();
      onDone?.();
      router.push("/");
      router.refresh();
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
