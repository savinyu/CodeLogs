import { SignInButton } from "@/components/auth/sign-in-button";
import { SignInButtons } from "@/components/auth/sign-in-buttons";
import { SignInPopover } from "@/components/auth/sign-in-popover";
import { signInProviders } from "@/lib/auth-providers";

/** Header sign-in: the lone provider's button, or a "Sign in" popover listing them. */
export function SignInMenu() {
  const providers = signInProviders();
  if (providers.length === 1 && providers[0]) {
    return <SignInButton provider={providers[0]} size="sm" label="Sign in" />;
  }
  return (
    <SignInPopover>
      <SignInButtons stacked />
    </SignInPopover>
  );
}
