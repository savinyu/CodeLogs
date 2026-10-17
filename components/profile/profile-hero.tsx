import { CheckIcon } from "lucide-react";
import { AddFriendButton } from "@/components/friends/add-friend-button";
import { Chip } from "@/components/kit/chip";
import { PlatformDot } from "@/components/kit/platform-dot";
import { UserAvatar } from "@/components/kit/user-avatar";
import { SOCIAL_META } from "@/components/social-links";
import type { PlatformId } from "@/lib/adapters/types";
import type { Friendship } from "@/lib/friends/queries";
import { PLATFORM_META } from "@/lib/platforms";
import {
  SOCIAL_KINDS,
  socialLinkHref,
  socialLinkLabel,
  type SocialKind,
  type SocialLinks,
} from "@/lib/social-links-shared";

type LinkKind = SocialKind | "github";

/** "Oct 2025" for a YYYY-MM-DD day, in UTC. */
function monthYear(day: string): string {
  return new Date(`${day}T00:00:00Z`).toLocaleDateString("en-US", {
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  });
}

/**
 * The public profile's top block (Coach's .pub-hero): avatar, name, @username, social pills and
 * verified handle chips. `friendship` is set only for a signed-in visitor who isn't the owner.
 */
export function ProfileHero({
  name,
  username,
  image,
  firstActiveDay,
  github,
  links,
  handles,
  friendship,
}: {
  name: string;
  username: string;
  image: string | null;
  /** First day with activity (YYYY-MM-DD), or null. */
  firstActiveDay: string | null;
  /** The GitHub login, shown first and marked as verified. */
  github: string | null;
  links: SocialLinks;
  handles: { platform: PlatformId; handle: string }[];
  friendship?: Friendship;
}) {
  const entries: [LinkKind, string | null | undefined][] = [
    ["github", github],
    ...SOCIAL_KINDS.map((kind): [LinkKind, string | undefined] => [kind, links[kind]]),
  ];
  const socials = entries.filter((e): e is [LinkKind, string] => !!e[1]);

  return (
    <div className="my-7 grid items-center gap-4 min-[641px]:grid-cols-[auto_minmax(0,1fr)] min-[641px]:gap-6">
      <UserAvatar
        name={name}
        image={image}
        size="xl"
        shape="squircle"
        tone="primary"
        className="max-[640px]:size-[84px] max-[640px]:rounded-[28px] max-[640px]:after:rounded-[28px]"
      />
      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-x-5 gap-y-3">
          <h1 className="font-display text-[clamp(2.375rem,6vw,3.75rem)] leading-none font-bold [overflow-wrap:anywhere]">
            {name}
          </h1>
          {friendship !== undefined ? (
            <AddFriendButton username={username} state={friendship} />
          ) : null}
        </div>
        <p className="mt-1.5 text-lg font-semibold text-muted-foreground">
          @{username}
          {firstActiveDay ? <> &middot; solving since {monthYear(firstActiveDay)}</> : null}
        </p>
        {socials.length > 0 ? (
          <ul aria-label="Links" className="mt-3.5 flex list-none flex-wrap gap-2 p-0">
            {socials.map(([kind, value]) => {
              const { name: kindName, Icon } = SOCIAL_META[kind];
              return (
                <li key={kind}>
                  <a
                    href={socialLinkHref(kind, value)}
                    aria-label={`${kindName}: ${socialLinkLabel(kind, value)}`}
                    {...(kind !== "email" && {
                      target: "_blank",
                      rel: "me nofollow noopener noreferrer",
                    })}
                    className="inline-flex items-center gap-2 rounded-full bg-card py-1.5 pr-3.5 pl-2 text-[0.906rem] font-semibold no-underline outline-none hover:bg-muted focus-visible:ring-3 focus-visible:ring-ring/50"
                  >
                    <span className="grid size-6 place-items-center rounded-full bg-raised">
                      <Icon className="size-3.5" />
                    </span>
                    <span className="[overflow-wrap:anywhere]">{socialLinkLabel(kind, value)}</span>
                    {kind === "github" ? (
                      <Chip tone="good" title="GitHub is the login, so it is verified">
                        <CheckIcon className="size-3" aria-hidden />
                        Login
                      </Chip>
                    ) : null}
                  </a>
                </li>
              );
            })}
          </ul>
        ) : null}
        {handles.length > 0 ? (
          <ul aria-label="Verified handles" className="mt-2.5 flex list-none flex-wrap gap-2 p-0">
            {handles.map(({ platform, handle }) => {
              const meta = PLATFORM_META[platform];
              return (
                <li key={platform}>
                  <a
                    href={meta.profileUrl(handle)}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-2 rounded-full bg-card px-3 py-[5px] text-sm font-semibold no-underline outline-none hover:bg-muted focus-visible:ring-3 focus-visible:ring-ring/50"
                  >
                    <PlatformDot platform={platform} />
                    <span className="[overflow-wrap:anywhere]">
                      {meta.name} {handle}
                    </span>
                    <span className="text-good" title="Verified">
                      <CheckIcon className="size-3.5" aria-label="Verified" />
                    </span>
                  </a>
                </li>
              );
            })}
          </ul>
        ) : null}
      </div>
    </div>
  );
}
