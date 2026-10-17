"use client";

import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";

/** Coach's (i) glyph button; shows `children` on hover, focus or tap. */
export function InfoTip({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <Popover>
      <PopoverTrigger
        openOnHover
        delay={100}
        aria-label={label}
        className="inline-grid size-6 shrink-0 cursor-help place-items-center rounded-full bg-muted text-muted-foreground outline-none hover:bg-foreground hover:text-background focus-visible:ring-3 focus-visible:ring-ring/50 data-popup-open:bg-foreground data-popup-open:text-background"
      >
        <svg width="14" height="14" viewBox="0 0 14 14" aria-hidden="true">
          <circle cx="7" cy="3.4" r="1.3" className="fill-current" />
          <path
            d="M7 6.3v5"
            strokeWidth="2"
            strokeLinecap="round"
            className="fill-none stroke-current"
          />
        </svg>
      </PopoverTrigger>
      <PopoverContent
        side="bottom"
        align="start"
        className="w-auto max-w-80 gap-0 rounded-[14px] bg-foreground px-4 py-3 text-[0.906rem] leading-snug font-medium text-background shadow-pop ring-0"
      >
        {children}
      </PopoverContent>
    </Popover>
  );
}
