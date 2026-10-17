import { Suspense } from "react";
import { ConnectPrompt } from "@/components/kit/connect-prompt";
import { Page } from "@/components/kit/page";
import { Greeting } from "@/components/today/greeting";
import { ThisWeek } from "@/components/today/this-week";
import { TodaysSet } from "@/components/today/todays-set";
import { WhyThese } from "@/components/today/why-these";
import { YourSheet } from "@/components/today/your-sheet";
import { Skeleton } from "@/components/ui/skeleton";
import { getDashboardData } from "@/lib/dashboard/queries";
import { requireUser } from "@/lib/session";
import { sheetNamesBySlug, SHEETS, sheetProgress } from "@/lib/sheets";
import { getSheetState } from "@/lib/sheets/queries";
import { todaySet } from "@/lib/today/set";
import { getDailyMarks } from "@/lib/today/queries";
import { goalProgress, weekStrip } from "@/lib/today/week";
import { getSolveNext } from "@/lib/topics/recommend";
import { getUserSettings } from "@/lib/user-settings";

export const metadata = { title: "Today" };

export default function TodayPage() {
  return (
    <Page>
      <Suspense fallback={<TodaySkeleton />}>
        <TodayContent />
      </Suspense>
    </Page>
  );
}

async function TodayContent() {
  const user = await requireUser();
  const firstName = user.name.trim().split(/\s+/)[0] || "there";
  const data = await getDashboardData(user.id);

  if (data.accounts.length === 0) {
    return (
      <>
        <Greeting firstName={firstName} pickCount={0} weak />
        <ConnectPrompt />
      </>
    );
  }

  const [settings, topicPicks, sheetState, marks] = await Promise.all([
    getUserSettings(user.id),
    getSolveNext(user.id, data, { keepSolvedSince: data.asOf }),
    getSheetState(user.id),
    getDailyMarks(user.id, data.asOf),
  ]);

  const tracked = sheetNamesBySlug(sheetState.followed);
  const picks = todaySet(topicPicks).map((pick) => ({
    pick,
    marked: marks.has(`${pick.problem.platform}:${pick.problem.externalId}`),
    track:
      pick.problem.platform === "leetcode"
        ? (tracked.get(pick.problem.externalId)?.join(" · ") ?? null)
        : null,
  }));

  const todayTotal = data.activity.find((a) => a.day === data.asOf)?.total ?? 0;
  const goal = goalProgress(todayTotal, settings.dailyGoal);
  const week = weekStrip(data.activity, data.asOf);

  const firstSheet = SHEETS.find((s) => s.id === sheetState.followed[0]);
  const sheet = firstSheet
    ? sheetProgress(firstSheet, sheetState.solvedSlugs, sheetState.tickedSlugs)
    : null;

  return (
    <>
      <Greeting
        firstName={firstName}
        pickCount={picks.length}
        weak={topicPicks.every((t) => t.weak)}
      />
      <div className="grid items-start gap-5 min-[900px]:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)]">
        <TodaysSet picks={picks} goal={goal} />
        <div className="grid min-w-0 gap-5">
          <ThisWeek week={week} />
          {topicPicks.length > 0 ? <WhyThese topics={topicPicks} /> : null}
          <YourSheet
            sheet={sheet}
            weakest={topicPicks[0]?.slug ?? null}
            hasLeetcode={data.accounts.some((a) => a.platform === "leetcode")}
          />
        </div>
      </div>
    </>
  );
}

function TodaySkeleton() {
  return (
    <div aria-hidden="true">
      <div className="mt-6 mb-6 grid gap-3">
        <Skeleton className="h-5 w-40" />
        <Skeleton className="h-14 w-80 max-w-full" />
      </div>
      <div className="grid items-start gap-5 min-[900px]:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)]">
        <Skeleton className="h-[34rem] rounded-card-lg" />
        <div className="grid gap-5">
          <Skeleton className="h-48 rounded-card" />
          <Skeleton className="h-64 rounded-card" />
        </div>
      </div>
    </div>
  );
}
