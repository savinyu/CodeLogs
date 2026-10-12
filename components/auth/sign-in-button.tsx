"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { signIn } from "@/lib/auth-client";

export function SignInButton({
  size,
  className,
}: {
  size?: React.ComponentProps<typeof Button>["size"];
  className?: string;
}) {
  const [pending, setPending] = useState(false);

  async function handleClick() {
    setPending(true);
    try {
      // On success the browser navigates to GitHub, so keep the pending state.
      const result = await signIn.social({ provider: "github", callbackURL: "/dashboard" });
      if (result.error) throw new Error(result.error.message);
    } catch {
      toast.error("Could not start GitHub sign-in. Please try again.");
      setPending(false);
    }
  }

  return (
    <Button size={size} className={className} onClick={handleClick} disabled={pending}>
      {pending ? "Redirecting…" : "Sign in with GitHub"}
    </Button>
  );
}
