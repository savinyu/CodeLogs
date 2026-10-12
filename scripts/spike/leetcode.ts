// M0 spike: LeetCode public GraphQL (anonymous only, low volume).
import { fetchJson, saveFixture, saveDump, report, sleep, type ProbeResult } from "./lib";

const URL_ = "https://leetcode.com/graphql";
const USER = "CptDailyBird";
const BROWSER_UA =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36";
const MAX_REQUESTS = 35;

const probes: ProbeResult[] = [];
const findings: string[] = [];
let count = 0;

// deno-lint-ignore no-explicit-any
type Any = any;

async function gql(name: string, query: string, variables?: Record<string, unknown>) {
  if (count >= MAX_REQUESTS) throw new Error("request budget exhausted");
  if (count > 0) await sleep(1000);
  count++;
  const r = await fetchJson<Any>(URL_, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Referer: "https://leetcode.com",
      "User-Agent": BROWSER_UA,
    },
    body: JSON.stringify({ query, variables }),
  });
  const errs = r.body?.errors;
  const ok = r.status === 200 && !errs;
  probes.push({
    name,
    url: URL_,
    status: r.status,
    ms: r.ms,
    ok,
    note: errs ? `errors: ${JSON.stringify(errs).slice(0, 200)}` : undefined,
  });
  return r;
}

const iso = (s: number) => new Date(s * 1000).toISOString();

async function main() {
  // 1 profile
  const qProfile = `query { matchedUser(username: "${USER}") { username profile { realName aboutMe ranking userAvatar } } }`;
  const p = await gql("profile", qProfile);
  await saveFixture("leetcode", "profile", p.body);
  const prof = p.body?.data?.matchedUser?.profile;
  findings.push(
    `profile: aboutMe ${prof && "aboutMe" in prof ? `returned (value ${JSON.stringify(prof.aboutMe)})` : "NOT returned"}; realName=${JSON.stringify(prof?.realName)}, ranking=${prof?.ranking}`,
  );

  // 2 stats
  const qStats = `query { allQuestionsCount { difficulty count } matchedUser(username: "${USER}") { submitStatsGlobal { acSubmissionNum { difficulty count submissions } } } }`;
  const s = await gql("stats", qStats);
  await saveFixture("leetcode", "stats", s.body);
  findings.push(
    `stats: allQuestionsCount=${JSON.stringify(s.body?.data?.allQuestionsCount)}; ac=${JSON.stringify(s.body?.data?.matchedUser?.submitStatsGlobal?.acSubmissionNum)}`,
  );

  // 3 tag counts
  const lvl = "{ tagName tagSlug problemsSolved }";
  const qTags = `query { matchedUser(username: "${USER}") { tagProblemCounts { advanced ${lvl} intermediate ${lvl} fundamental ${lvl} } } }`;
  const t = await gql("tag-counts", qTags);
  await saveFixture("leetcode", "tag-counts", t.body);
  const tpc = t.body?.data?.matchedUser?.tagProblemCounts ?? {};
  const slugs: Record<string, { tagName: string; problemsSolved: number; level: string }> = {};
  for (const level of ["advanced", "intermediate", "fundamental"]) {
    for (const x of tpc[level] ?? []) {
      slugs[x.tagSlug] = { tagName: x.tagName, problemsSolved: x.problemsSolved, level };
    }
  }
  await saveFixture("leetcode", "tag-slugs", slugs);
  findings.push(`tag-counts: ${Object.keys(slugs).length} distinct tag slugs across 3 levels`);

  // 4 calendar
  const cal = (y?: number) =>
    `query { matchedUser(username: "${USER}") { userCalendar${y ? `(year: ${y})` : ""} { activeYears streak totalActiveDays submissionCalendar } } }`;
  const c = await gql("calendar", cal());
  await saveFixture("leetcode", "calendar", c.body);
  const describeCal = (uc: Any, label: string) => {
    if (!uc) return `${label}: no userCalendar`;
    let m: Record<string, number> = {};
    try {
      m = JSON.parse(uc.submissionCalendar);
    } catch {
      return `${label}: submissionCalendar not parseable`;
    }
    const keys = Object.keys(m).map(Number).sort((a, b) => a - b);
    const utc = keys.every((k) => k % 86400 === 0);
    return `${label}: ${keys.length} days, ${keys.length ? iso(keys[0]!).slice(0, 10) + " .. " + iso(keys[keys.length - 1]!).slice(0, 10) : "empty"}, keys all UTC-midnight=${utc}, streak=${uc.streak}, totalActiveDays=${uc.totalActiveDays}, activeYears=${JSON.stringify(uc.activeYears)}`;
  };
  const uc = c.body?.data?.matchedUser?.userCalendar;
  findings.push(describeCal(uc, "calendar(default)"));
  const years: number[] = uc?.activeYears ?? [];
  const earlier = years.slice().sort((a, b) => a - b).find((y) => y < Math.max(...years));
  if (earlier) {
    const cy = await gql("calendar-year", cal(earlier));
    await saveFixture("leetcode", "calendar-year", cy.body);
    findings.push(describeCal(cy.body?.data?.matchedUser?.userCalendar, `calendar(year=${earlier})`));
  } else {
    findings.push("calendar-year: no earlier activeYear, skipped");
  }

  // 5 recent AC
  const qRecent = `query { recentAcSubmissionList(username: "${USER}", limit: 20) { id title titleSlug timestamp } }`;
  const r = await gql("recent-ac", qRecent);
  await saveFixture("leetcode", "recent-ac", r.body);
  const list: Any[] = r.body?.data?.recentAcSubmissionList ?? [];
  const slugCounts = new Map<string, number>();
  for (const x of list) slugCounts.set(x.titleSlug, (slugCounts.get(x.titleSlug) ?? 0) + 1);
  const dups = [...slugCounts].filter(([, n]) => n > 1);
  const ts = list.map((x) => Number(x.timestamp)).sort((a, b) => a - b);
  findings.push(
    `recent-ac: ${list.length} items, ${ts.length ? iso(ts[0]!) + " .. " + iso(ts[ts.length - 1]!) : "none"}; ${slugCounts.size} distinct slugs; repeated slugs: ${dups.length ? JSON.stringify(dups) : "none"}`,
  );

  // 6 question details
  const details: Any[] = [];
  for (const slug of [...slugCounts.keys()].slice(0, 20)) {
    const q = `query { question(titleSlug: "${slug}") { questionId questionFrontendId title titleSlug difficulty isPaidOnly topicTags { name slug } } }`;
    const d = await gql(`question:${slug}`, q);
    details.push(d.body);
  }
  await saveFixture("leetcode", "question-details", details);
  findings.push(`question-details: ${details.length} requests, all with data=${details.every((d) => d?.data?.question)}`);

  // 7 catalog
  const qList = (limit: number) =>
    `query problemsetQuestionList { problemsetQuestionList: questionList(categorySlug: "", limit: ${limit}, skip: 0, filters: {}) { total: totalNum questions: data { frontendQuestionId: questionFrontendId title titleSlug difficulty paidOnly: isPaidOnly topicTags { name slug } } } }`;
  let maxLimit = 0;
  let total = 0;
  let page: Any = null;
  const c100 = await gql("catalog-100", qList(100));
  if (c100.body?.data?.problemsetQuestionList) {
    maxLimit = 100;
    page = c100.body;
    total = page.data.problemsetQuestionList.total;
    await sleep(1000);
    const c1000 = await gql("catalog-1000", qList(1000));
    const lst = c1000.body?.data?.problemsetQuestionList;
    if (lst && lst.questions?.length > 100) {
      maxLimit = 1000;
      page = c1000.body;
      total = lst.total;
      findings.push(`catalog: limit 1000 returned ${lst.questions.length} questions in ${c1000.ms} ms`);
    } else {
      findings.push(
        `catalog: limit 1000 failed or capped (status ${c1000.status}, got ${lst?.questions?.length}, errors ${JSON.stringify(c1000.body?.errors)?.slice(0, 200)})`,
      );
    }
  } else {
    findings.push(`catalog: questionList errored: ${JSON.stringify(c100.body?.errors ?? c100.text.slice(0, 200))}`);
    const v2 = await gql(
      "catalog-v2",
      `query { problemsetQuestionListV2(limit: 100, skip: 0) { totalLength questions { questionFrontendId title titleSlug difficulty paidOnly topicTags { name slug } } } }`,
    );
    findings.push(`catalog v2: status ${v2.status}, ${JSON.stringify(v2.body?.errors ?? v2.body?.data).slice(0, 300)}`);
    page = v2.body;
  }
  if (page) {
    const trimmed = structuredClone(page);
    const l = trimmed?.data?.problemsetQuestionList;
    if (l?.questions) l.questions = l.questions.slice(0, 30);
    await saveFixture("leetcode", "catalog-page", trimmed);
    await saveDump("leetcode", "catalog-page-full", page);
  }
  if (maxLimit) {
    findings.push(
      `catalog: total=${total}, max working limit=${maxLimit}, requests for full catalog=${Math.ceil(total / maxLimit)}`,
    );
  }

  // 8 unknown user
  const e = await gql(
    "error-unknown-user",
    `query { matchedUser(username: "this_user_should_not_exist_zz9") { username } }`,
  );
  await saveFixture("leetcode", "error-unknown-user", { status: e.status, body: e.body ?? e.text });
  findings.push(`unknown user: HTTP ${e.status}, body ${e.text.slice(0, 300)}`);

  findings.push(`total requests: ${count}`);
  await report("leetcode", probes, findings);
}

main().catch(async (err) => {
  findings.push(`FATAL: ${err}`);
  await report("leetcode", probes, findings);
  process.exit(1);
});
