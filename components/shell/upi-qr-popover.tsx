"use client";

import { QrCodeIcon } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";

/** "Scan QR" for laptops: the UPI QR (rendered on the server, passed as children) in a popover. */
export function UpiQrPopover({ children }: { children: React.ReactNode }) {
  return (
    <Popover>
      <PopoverTrigger className="inline-flex items-center gap-1.5 rounded-full bg-primary-soft px-3 py-1 text-[0.8rem] font-semibold text-primary-ink outline-none hover:bg-primary hover:text-primary-foreground focus-visible:ring-3 focus-visible:ring-ring/50 data-popup-open:bg-primary data-popup-open:text-primary-foreground pointer-coarse:hidden">
        <QrCodeIcon aria-hidden="true" className="size-3.5" />
        Scan QR
      </PopoverTrigger>
      <PopoverContent
        side="top"
        align="start"
        aria-label="UPI QR code"
        className="grid w-64 justify-items-center gap-3 rounded-[20px] bg-popover p-5 text-center shadow-pop ring-0"
      >
        <p className="font-display text-lg font-semibold">Scan to tip via UPI</p>
        <div className="rounded-row bg-white p-4">{children}</div>
        <p className="text-sm text-muted-foreground">
          Open GPay, PhonePe, Paytm or any UPI app on your phone and scan.
        </p>
      </PopoverContent>
    </Popover>
  );
}
