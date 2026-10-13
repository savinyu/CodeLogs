import { Badge } from "@/components/ui/badge";

// LeetCode's own labels get its colors; ratings (Codeforces, AtCoder) stay neutral.
const LABEL_CLASS: Record<string, string> = {
  Easy: "border-difficulty-easy/40 bg-difficulty-easy/10 text-difficulty-easy",
  Medium: "border-difficulty-medium/40 bg-difficulty-medium/10 text-difficulty-medium",
  Hard: "border-difficulty-hard/40 bg-difficulty-hard/10 text-difficulty-hard",
};

export function DifficultyBadge({ raw }: { raw: string }) {
  return (
    <Badge variant="outline" className={LABEL_CLASS[raw]}>
      {raw}
    </Badge>
  );
}
