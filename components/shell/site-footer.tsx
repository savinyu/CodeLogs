import { HeartIcon } from "lucide-react";
import { CopyUpi } from "@/components/shell/copy-upi";
import { UPI_ID, upiPayUrl } from "@/lib/support";

/** The page foot: a quiet tip line with the UPI ID (copy on any device, open the UPI app on phones). */
export function SiteFooter() {
  return (
    <footer className="mx-auto w-full max-w-[70rem] px-4 pb-8">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-2 border-t border-border pt-5 text-sm text-muted-foreground">
        <span className="inline-flex items-center gap-1.5">
          <HeartIcon aria-hidden="true" className="size-4 text-primary" />
          CodeLogs is free. If it helps you, tip via UPI:
        </span>
        <CopyUpi id={UPI_ID} />
        <a
          href={upiPayUrl()}
          className="hidden rounded-full font-semibold text-primary-ink underline-offset-4 outline-none hover:underline focus-visible:ring-3 focus-visible:ring-ring/50 pointer-coarse:inline"
        >
          Pay in UPI app
        </a>
      </div>
    </footer>
  );
}
