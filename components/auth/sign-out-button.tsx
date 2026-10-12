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
