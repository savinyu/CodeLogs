import { HeartIcon, MessageSquareIcon } from "lucide-react";
import Link from "next/link";
import { CopyUpi } from "@/components/shell/copy-upi";
import { UpiQr } from "@/components/shell/upi-qr";
import { UpiQrPopover } from "@/components/shell/upi-qr-popover";
import { UPI_ID, upiPayUrl } from "@/lib/support";

/**
 * The page foot: a quiet tip line. Laptops get a QR to scan with a phone, phones get a link that
 * opens the UPI app, and the ID itself copies on any device. A feedback link sits at the end.
 */
export function SiteFooter() {
  return (
    <footer className="mx-auto w-full max-w-[70rem] px-4 pb-8">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-2 border-t border-border pt-5 text-sm text-muted-foreground">
        <span className="inline-flex items-center gap-1.5">
          <HeartIcon aria-hidden="true" className="size-4 text-primary" />
          CodeLogs is free. Tips keep the servers running. UPI:
        </span>
        <UpiQrPopover>
          <UpiQr value={upiPayUrl()} className="size-44" />
        </UpiQrPopover>
        <CopyUpi id={UPI_ID} />
        <a
          href={upiPayUrl()}
          className="hidden rounded-full font-semibold text-primary-ink underline-offset-4 outline-none hover:underline focus-visible:ring-3 focus-visible:ring-ring/50 pointer-coarse:inline"
        >
          Pay in UPI app
        </a>
        <Link
          href="/feedback"
          className="inline-flex items-center gap-1.5 rounded-full font-semibold text-foreground underline-offset-4 outline-none hover:underline focus-visible:ring-3 focus-visible:ring-ring/50 sm:ml-auto"
        >
          <MessageSquareIcon aria-hidden="true" className="size-4 text-muted-foreground" />
          Send feedback
        </Link>
      </div>
    </footer>
  );
}
