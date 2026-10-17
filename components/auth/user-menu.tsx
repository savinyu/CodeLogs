import Link from "next/link";
import { SignInButton } from "@/components/auth/sign-in-button";
import { SignOutMenuItem } from "@/components/auth/sign-out-button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { initials } from "@/components/kit/user-avatar";
import { getCurrentUser } from "@/lib/session";

/** Reads the session, so it must render inside <Suspense>. */
export async function UserMenu() {
  const user = await getCurrentUser();
  if (!user) return <SignInButton />;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        aria-label="Open user menu"
        className="rounded-full outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
      >
        <Avatar>
          {user.image ? <AvatarImage src={user.image} alt="" /> : null}
          <AvatarFallback>{initials(user.name)}</AvatarFallback>
        </Avatar>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56">
        <DropdownMenuGroup>
          <DropdownMenuLabel className="flex flex-col gap-0.5 py-1.5">
            <span className="truncate text-sm font-medium text-foreground">{user.name}</span>
            {user.username ? <span className="truncate">@{user.username}</span> : null}
          </DropdownMenuLabel>
        </DropdownMenuGroup>
        <DropdownMenuSeparator />
        <DropdownMenuItem render={<Link href="/sheets" />}>Sheets</DropdownMenuItem>
        <DropdownMenuItem render={<Link href="/settings" />}>Settings</DropdownMenuItem>
        <SignOutMenuItem />
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
