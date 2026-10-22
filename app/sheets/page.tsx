import { Suspense } from "react";
import { Page } from "@/components/kit/page";
import { PageHead } from "@/components/kit/page-head";
import { SheetCard } from "@/components/sheets/sheet-card";
import { SheetDetail } from "@/components/sheets/sheet-detail";
import { Skeleton } from "@/components/ui/skeleton";
import { getDashboardData } from "@/lib/dashboard/queries";
import { requireUser } from "@/lib/session";
import { allSheetProgress, DEFAULT_SHEET, SHEETS, type SheetId } from "@/lib/sheets";
import { getSheetState } from "@/lib/sheets/queries";
import { weakTopics } from "@/lib/topics/scoring";

export const metadata = { title: "Sheets" };

async function SheetsContent({ searchParams }: Pick<PageProps<"/sheets">, "searchParams">) {
  const user = await requireUser();
  const [state, dashboard, params] = await Promise.all([
    getSheetState(user.id),
    getDashboardData(user.id),
    searchParams,
  ]);
  const progress = allSheetProgress(state.solvedSlugs, state.tickedSlugs);
  const requested = SHEETS.find((s) => s.id === params.sheet)?.id;
  const selectedId: SheetId = requested ?? state.followed[0] ?? DEFAULT_SHEET;
  const selected = progress.find((p) => p.id === selectedId) ?? progress[0];
  const weakSlugs = new Set(weakTopics(dashboard.topics).map((t) => t.slug));

  return (
    <>
      <div className="mb-5 grid grid-cols-3 gap-3.5 max-[900px]:grid-cols-1">
        {progress.map((p) => (
          <SheetCard
            key={p.id}
            sheet={p}
            selected={p.id === selectedId}
            following={state.followed.includes(p.id)}
          />
        ))}
      </div>
      {selected ? (
        <SheetDetail
          sheet={selected}
          weakSlugs={weakSlugs}
          onlyWeak={params.sections === "weak"}
          historyComplete={state.historyComplete}
        />
      ) : null}
    </>
  );
}

export default function SheetsPage({ searchParams }: PageProps<"/sheets">) {
  return (
    <Page>
      <PageHead
        title="Sheets"
        description="Follow a curated list and LogN ticks off what you have already solved on LeetCode. Every section maps to a topic, so a sheet also shows which weak topic it trains."
      />
      <Suspense
        fallback={
          <div className="grid gap-4">
            <Skeleton className="h-40 w-full rounded-card" />
            <Skeleton className="h-96 w-full rounded-card-lg" />
          </div>
        }
      >
        <SheetsContent searchParams={searchParams} />
      </Suspense>
    </Page>
  );
}
