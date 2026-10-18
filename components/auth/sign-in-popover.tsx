"use client";

import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";

/** The "Sign in" button and the popover that holds the provider buttons. */
export function SignInPopover({ children }: { children: React.ReactNode }) {
  return (
    <Popover>
      <PopoverTrigger render={<Button size="sm" />}>Sign in</PopoverTrigger>
      <PopoverContent
        align="end"
        aria-label="Sign in"
        className="w-[min(16rem,calc(100vw-2rem))] gap-3 rounded-[20px] bg-popover p-4 shadow-pop ring-0"
      >
        {children}
      </PopoverContent>
    </Popover>
  );
}
