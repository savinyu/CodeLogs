import Link from "next/link";
import { buttonVariants } from "@/components/ui/button";
import type { PlatformId } from "@/lib/adapters/types";
import { PLATFORM_META } from "@/lib/platforms";

/** Shown only to the owner on their own public page (Coach's .owner-banner). */
export function OwnerBanner({ hidden }: { hidden: PlatformId[] }) {
  const names = hidden.map((p) => PLATFORM_META[p].name);
  const list =
    names.length <= 1 ? names.join("") : `${names.slice(0, -1).join(", ")} and ${names.at(-1)}`;
  const one = names.length === 1;
  return (
    <div className="mt-4 mb-2 flex flex-wrap items-center gap-x-4 gap-y-3 rounded-[18px] bg-track-soft px-[18px] py-3.5 text-[0.9375rem]">
      <p className="min-w-[15rem] flex-1">
        <b>You are seeing what visitors see.</b> Only verified handles appear. Weak-topic scores,
        Solve next, the daily goal, sheets and your friend list stay private.
        {hidden.length > 0 ? (
          <>
            {" "}
            <Link href="/connect" className="font-semibold underline underline-offset-2">
              Your {list} {one ? "handle is" : "handles are"} hidden because{" "}
              {one ? "it isn't" : "they aren't"} verified yet. Verify on Connect.
            </Link>
          </>
        ) : null}
      </p>
      <Link href="/today" className={buttonVariants({ size: "sm" })}>
        Back to Today
      </Link>
    </div>
  );
}
