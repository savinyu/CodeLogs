import { Suspense } from "react";
import Link from "next/link";
import { Circle, CircleCheck } from "lucide-react";
import { DifficultyBadge } from "@/components/dashboard/difficulty-badge";
import { ProgressBar } from "@/components/sheets/progress-bar";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { requireUser } from "@/lib/session";
import { SHEETS, parseSheetId, sheetProgress, type SheetDifficulty } from "@/lib/sheets";
import { getLeetcodeSolvedSlugs } from "@/lib/sheets/queries";

export const metadata = { title: "Sheets" };

const DIFFICULTIES: { id: SheetDifficulty; className: string }[] = [
  { id: "Easy", className: "text-difficulty-easy" },
  { id: "Medium", className: "text-difficulty-medium" },
  { id: "Hard", className: "text-difficulty-hard" },
];

async function SheetsContent({ searchParams }: Pick<PageProps<"/sheets">, "searchParams">) {
  const user = await requireUser();
  const [{ slugs, historyComplete }, params] = await Promise.all([
    getLeetcodeSolvedSlugs(user.id),
    searchParams,
  ]);
  const id = parseSheetId(params.sheet);
  const sheet = SHEETS.find((s) => s.id === id) ?? SHEETS[0];
  if (!sheet) return null;
  const progress = sheetProgress(sheet, slugs);

  return (
    <>
      <div className="flex flex-col gap-3">
        <h1 className="text-2xl font-semibold tracking-tight">Sheets</h1>
        <nav aria-label="Sheet" className="flex flex-wrap gap-1">
          {SHEETS.map((s) => {
            const active = s.id === id;
            return (
              <Link
                key={s.id}
                href={`/sheets?sheet=${s.id}`}
                aria-current={active ? "page" : undefined}
                className={buttonVariants({ variant: active ? "secondary" : "ghost", size: "sm" })}
              >
                {s.name}
              </Link>
            );
          })}
        </nav>
      </div>

      <section className="flex flex-col gap-3">
        <p className="text-sm text-muted-foreground">{progress.description}</p>
        <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
          <p className="text-lg font-medium tabular-nums">
            {progress.solved} / {progress.total} solved
          </p>
          <p className="flex flex-wrap gap-x-3 text-sm tabular-nums">
            {DIFFICULTIES.map((d) => (
              <span key={d.id} className={d.className}>
                {d.id} {progress.byDifficulty[d.id].solved}/{progress.byDifficulty[d.id].total}
              </span>
            ))}
          </p>
        </div>
        <ProgressBar
          value={progress.solved}
          max={progress.total}
          label={`${progress.name} progress`}
          className="h-3"
        />
        {historyComplete === null ? (
          <p className="text-sm text-muted-foreground">
            <Link href="/connect" className="underline underline-offset-4">
              Connect your LeetCode handle
            </Link>{" "}
            to track sheets.
          </p>
        ) : historyComplete === false ? (
          <p className="text-sm text-muted-foreground">
            LeetCode only shares your 20 most recent solves, so some problems you&apos;ve solved may
            show as unsolved.{" "}
            <Link href="/connect" className="underline underline-offset-4">
              Import your full history on the Connect page.
            </Link>
          </p>
        ) : null}
      </section>

      <div className="flex flex-col gap-3">
        {progress.sections.map((section) => (
          <details
            key={section.name}
            open={section.solved < section.total}
            className="group rounded-xl border bg-card"
          >
            <summary className="flex cursor-pointer list-none flex-col gap-2 rounded-xl p-4 outline-none focus-visible:ring-3 focus-visible:ring-ring/50 [&::-webkit-details-marker]:hidden">
              <span className="flex items-baseline justify-between gap-2">
                <span className="min-w-0 truncate font-medium">{section.name}</span>
                <span className="shrink-0 text-sm text-muted-foreground tabular-nums">
                  {section.solved}/{section.total}
                </span>
              </span>
              <ProgressBar
                value={section.solved}
                max={section.total}
                label={`${section.name} progress`}
                className="h-1"
              />
            </summary>
            <ul className="flex flex-col divide-y border-t">
              {section.problems.map((p) => (
                <li key={p.slug} className="flex items-center gap-2 px-4 py-2 text-sm">
                  {p.status ? (
                    <CircleCheck className="size-4 shrink-0 text-difficulty-easy" aria-hidden />
                  ) : (
                    <Circle className="size-4 shrink-0 text-muted-foreground" aria-hidden />
                  )}
                  <span className="sr-only">{p.status ? "Solved" : "Not solved"}</span>
                  <a
                    href={p.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="min-w-0 flex-1 truncate underline-offset-4 hover:underline"
                  >
                    {p.title}
                  </a>
                  {p.premium && <Badge variant="outline">Premium</Badge>}
                  <DifficultyBadge platform="leetcode" raw={p.difficulty} />
                </li>
              ))}
            </ul>
          </details>
        ))}
      </div>

      <p className="text-sm text-muted-foreground">
        Problem list from{" "}
        <a
          href={progress.source.url}
          target="_blank"
          rel="noopener noreferrer"
          className="underline underline-offset-4"
        >
          {progress.source.label}
        </a>{" "}
        (MIT license).
      </p>
    </>
  );
}

export default function SheetsPage({ searchParams }: PageProps<"/sheets">) {
  return (
    <main className="mx-auto flex w-full max-w-5xl flex-col gap-6 px-4 py-10">
      <Suspense
        fallback={
          <>
            <Skeleton className="h-8 w-40" />
            <Skeleton className="h-20 w-full rounded-xl" />
            <Skeleton className="h-48 w-full rounded-xl" />
          </>
        }
      >
        <SheetsContent searchParams={searchParams} />
      </Suspense>
    </main>
  );
}
