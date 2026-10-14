import type { PlatformId } from "@/lib/adapters/types";
import type { PlatformTags } from "@/lib/dashboard/types";
import { PLATFORM_META } from "@/lib/platforms";
import { InfoTip } from "@/components/info-tip";
import { TagBarChart } from "./tag-bar-chart";

const TOP = 10;
const GAPS = 10;

export function TagCharts({ tags, connected }: { tags: PlatformTags[]; connected: PlatformId[] }) {
  const atcoder = connected.includes("atcoder");

  return (
    <div className="space-y-6">
      {tags.length === 0 && !atcoder ? (
        <p className="text-sm text-muted-foreground">No topic data yet.</p>
      ) : null}

      {tags.length > 0 ? (
        <>
          <div className={tags.length === 2 ? "grid gap-8 lg:grid-cols-2" : "grid gap-8"}>
            {tags.map((pt) => {
              const solved = pt.tags.filter((t) => t.solved > 0).slice(0, TOP);
              const gaps = pt.tags.filter((t) => t.solved === 0).slice(0, GAPS);
              return (
                <section key={pt.platform} className="min-w-0 space-y-3">
                  <h3 className="flex items-center gap-1.5 text-sm font-medium">
                    {PLATFORM_META[pt.platform].name}
                    <InfoTip label={`About ${PLATFORM_META[pt.platform].name} tags`}>
                      {pt.source === "tracked"
                        ? "Tags on the problems you've solved"
                        : "Lifetime counts reported by LeetCode"}
                    </InfoTip>
                  </h3>
                  {solved.length > 0 ? (
                    <TagBarChart platform={pt.platform} tags={solved} />
                  ) : (
                    <p className="text-sm text-muted-foreground">No tagged solves yet.</p>
                  )}
                  {gaps.length > 0 ? (
                    <div className="space-y-1.5">
                      <p className="text-xs text-muted-foreground">
                        Gaps: popular tags you haven&apos;t solved
                      </p>
                      <ul className="flex flex-wrap gap-1.5">
                        {gaps.map((g) => (
                          <li
                            key={g.tag}
                            className="rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground"
                          >
                            {g.label}
                          </li>
                        ))}
                      </ul>
                    </div>
                  ) : null}
                </section>
              );
            })}
          </div>
          <p className="text-xs text-muted-foreground">
            A problem can have several tags, so counts add up to more than your total.
          </p>
        </>
      ) : null}

      {atcoder ? (
        <p className="text-xs text-muted-foreground">
          AtCoder doesn&apos;t publish problem tags, so AtCoder solves aren&apos;t counted here.
        </p>
      ) : null}
    </div>
  );
}
