import { Badge } from "@/components/ui/badge";
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
    className: "border-difficulty-easy/40 bg-difficulty-easy/10 text-difficulty-easy",
  },
  medium: {
    label: "Medium",
    className: "border-difficulty-medium/40 bg-difficulty-medium/10 text-difficulty-medium",
  },
  hard: {
    label: "Hard",
    className: "border-difficulty-hard/40 bg-difficulty-hard/10 text-difficulty-hard",
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
    <Badge variant="outline" className={meta?.className} title={title}>
      {text}
    </Badge>
  );
}

function label(platform: PlatformId, raw: string): string {
  if (platform !== "atcoder") return raw;
  const value = Number(raw);
  return Number.isFinite(value) ? String(displayAtcoderDifficulty(value)) : raw;
}
