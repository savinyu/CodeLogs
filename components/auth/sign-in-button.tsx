"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { GithubIcon, GoogleIcon } from "@/components/social-icons";
import { signIn } from "@/lib/auth-client";
import type { SocialProvider } from "@/lib/auth-providers";

const PROVIDERS: Record<
  SocialProvider,
  {
    name: string;
    Icon: React.ComponentType<{ className?: string }>;
    variant: React.ComponentProps<typeof Button>["variant"];
  }
> = {
  google: { name: "Google", Icon: GoogleIcon, variant: "default" },
  github: { name: "GitHub", Icon: GithubIcon, variant: "secondary" },
};

export function SignInButton({
  provider,
  size,
  label,
  className,
}: {
  provider: SocialProvider;
  /** Defaults to "Continue with <provider>". */
  label?: string;
  size?: React.ComponentProps<typeof Button>["size"];
  className?: string;
}) {
  const [pending, setPending] = useState(false);
  const { name, Icon, variant } = PROVIDERS[provider];

  async function handleClick() {
    setPending(true);
    try {
      // On success the browser navigates to the provider, so keep the pending state.
      const result = await signIn.social({
        provider,
        callbackURL: "/today",
        errorCallbackURL: "/",
      });
      if (result.error) throw new Error(result.error.message);
    } catch {
      toast.error(`Could not start ${name} sign-in. Please try again.`);
      setPending(false);
    }
  }

  return (
    <Button
      size={size}
      variant={variant}
      className={className}
      onClick={handleClick}
      disabled={pending}
    >
      <Icon />
      {pending ? "Redirecting…" : (label ?? `Continue with ${name}`)}
    </Button>
  );
}
