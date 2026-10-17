import Link from "next/link";
import { buttonVariants } from "@/components/ui/button";

/** Shown only to the owner on their own public page (Coach's .owner-banner). */
export function OwnerBanner({ hiddenCount }: { hiddenCount: number }) {
  return (
    <div className="mt-4 mb-2 flex flex-wrap items-center gap-x-4 gap-y-3 rounded-[18px] bg-track-soft px-[18px] py-3.5 text-[0.9375rem]">
      <p className="min-w-[15rem] flex-1">
        <b>You are seeing what visitors see.</b> Only verified handles appear. Weak-topic scores,
        Solve next, the daily goal, sheets and your friend list stay private.
        {hiddenCount > 0 ? (
          <>
            {" "}
            <Link href="/connect" className="font-semibold underline underline-offset-2">
              {hiddenCount} connected {hiddenCount === 1 ? "handle is" : "handles are"} hidden
              because {hiddenCount === 1 ? "it is" : "they are"} not verified.
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
