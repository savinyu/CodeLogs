"use client";

import { InfoIcon } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";

/** An "i" icon that shows `children` on hover, focus or tap. */
export function InfoTip({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <Popover>
      <PopoverTrigger
        openOnHover
        delay={100}
        aria-label={label}
        className="inline-flex size-4 items-center justify-center rounded-full text-muted-foreground hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
      >
        <InfoIcon className="size-3.5" />
      </PopoverTrigger>
      <PopoverContent side="top" className="w-auto max-w-64 p-2 text-xs">
        {children}
      </PopoverContent>
    </Popover>
  );
}
