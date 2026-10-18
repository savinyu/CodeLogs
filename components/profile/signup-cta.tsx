import { SignInButtons } from "@/components/auth/sign-in-buttons";

/** Call to action for signed-out visitors (Coach's .cta). */
export function SignupCta() {
  return (
    <div className="mt-7 flex flex-wrap items-center justify-between gap-3.5 rounded-[24px] bg-primary-soft px-6 py-6 text-primary-ink min-[560px]:px-7">
      <div>
        <h2 className="font-display text-[1.625rem] leading-tight font-bold">
          Track your own practice
        </h2>
        <p>Link Codeforces, AtCoder and LeetCode in a minute. No passwords.</p>
      </div>
      <SignInButtons />
    </div>
  );
}
