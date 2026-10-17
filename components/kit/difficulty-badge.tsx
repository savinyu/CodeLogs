import { cn } from "cn";
import type { PlatformId } from "@/lib/adapters/types";
import {
  difficultyTier,
  displayAtcoderDifficulty,
  type DifficultyTier,
} from "@/lib/sync/difficulty";

// LeetCode's colors: green, amber, red. Codeforces ratings and AtCoder difficulties get the same
// colors by tier.
const TIER: Record<DifficultyTier, { label: string; className: string }> = {
  easy: {
    label: "Easy",
    className: "text-difficulty-easy",
  },
  medium: {
    label: "Medium",
    className: "text-difficulty-medium",
  },
  hard: {
    label: "Hard",
    className: "text-difficulty-hard",
  },
};

export function DifficultyBadge({ platform, raw }: { platform: PlatformId; raw: string }) {
  const tier = difficultyTier(platform, raw);
  const meta = tier ? TIER[tier] : null;
  const text = label(platform, raw);
  // A numeric badge names its tier on hover, so the meaning isn't carried by color alone.
  const kind = platform === "atcoder" ? "difficulty" : "rating";
  const title = meta && meta.label !== text ? `${meta.label} (${kind} ${text})` : undefined;
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full bg-muted px-2.5 py-0.5 text-[0.78rem] font-semibold whitespace-nowrap",
        meta?.className,
      )}
      title={title}
    >
      {text}
    </span>
  );
}

function label(platform: PlatformId, raw: string): string {
  if (platform !== "atcoder") return raw;
  const value = Number(raw);
  return Number.isFinite(value) ? String(displayAtcoderDifficulty(value)) : raw;
}
