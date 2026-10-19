import { SignInButton } from "@/components/auth/sign-in-button";
import { signInProviders } from "@/lib/auth-providers";
import { cn } from "cn";

/** One sign-in button per configured provider. */
export function SignInButtons({
  size,
  stacked,
  className,
  callbackURL,
}: {
  size?: React.ComponentProps<typeof SignInButton>["size"];
  /** Full-width buttons in a column (for popovers). */
  stacked?: boolean;
  className?: string;
  callbackURL?: string;
}) {
  return (
    <div className={cn("flex gap-2.5", stacked ? "flex-col" : "flex-wrap", className)}>
      {signInProviders().map((provider) => (
        <SignInButton
          key={provider}
          provider={provider}
          size={size}
          callbackURL={callbackURL}
          className={stacked ? "w-full" : undefined}
        />
      ))}
    </div>
  );
}
