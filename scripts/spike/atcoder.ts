// M0 spike: AtCoder via kenkoooo AtCoder Problems API.
import { fetchJson, saveFixture, saveDump, report, sleep, type ProbeResult } from "./lib";

const API = "https://kenkoooo.com/atcoder/atcoder-api/v3";
const RES = "https://kenkoooo.com/atcoder/resources";

interface Sub {
  id: number;
  epoch_second: number;
  problem_id: string;
  contest_id: string;
  user_id: string;
  language: string;
  point: number;
  length: number;
  result: string;
  execution_time: number | null;
}
interface Model {
  difficulty?: number;
  slope?: number;
  intercept?: number;
  variance?: number;
  discrimination?: number;
  irt_loglikelihood?: number;
  irt_users?: number;
  is_experimental?: boolean;
}
interface Problem { id: string; contest_id: string; title: string; [k: string]: unknown }

const probes: ProbeResult[] = [];
const findings: string[] = [];
let first = true;

async function call<T>(name: string, url: string, init: RequestInit = {}, note?: string) {
  if (!first) await sleep(1100);
  first = false;
  const r = await fetchJson<T>(url, init);
  probes.push({ name, url, status: r.status, ms: r.ms, ok: r.status >= 200 && r.status < 300 && (r.body !== null || !!init.headers), note });
  return r;
}

async function main() {
  // 1. empty user
  const empty = await call<unknown>("submissions-empty(savinyu)", `${API}/user/submissions?user=savinyu&from_second=0`);
  await saveFixture("atcoder", "submissions-empty", { status: empty.status, body: empty.body, rawText: empty.text.slice(0, 2000) });
  findings.push(`Empty account savinyu: HTTP ${empty.status}, raw body ${JSON.stringify(empty.text.slice(0, 100))} (no error; an unknown user presumably looks identical, so kenkoooo cannot verify a handle exists).`);

  // 2. chokudai pagination
  const pages: Sub[][] = [];
  const pageStats: unknown[] = [];
  let cursor = 0;
  for (let i = 0; i < 5; i++) {
    const r = await call<Sub[]>(`submissions-chokudai-p${i + 1}`, `${API}/user/submissions?user=chokudai&from_second=${cursor}`);
    const rows = Array.isArray(r.body) ? r.body : [];
    pages.push(rows);
    const eps = rows.map((x) => x.epoch_second);
    const sorted = eps.every((e, j) => j === 0 || eps[j - 1]! <= e);
    pageStats.push({
      page: i + 1, from_second: cursor, rows: rows.length,
      min: eps.length ? Math.min(...eps) : null, max: eps.length ? Math.max(...eps) : null, sortedAsc: sorted,
    });
    if (rows.length < 500) break;
    cursor = rows[rows.length - 1]!.epoch_second; // inclusive rule
  }
  console.table(pageStats);
  findings.push("Per-page stats: " + JSON.stringify(pageStats));

  // boundary analysis page1 -> page2
  const p1 = pages[0] ?? [];
  const p2 = pages[1] ?? [];
  let boundaryRows: Sub[] = [];
  if (p1.length === 500 && p2.length) {
    const last = p1[p1.length - 1]!.epoch_second;
    const p1ids = new Set(p1.map((x) => x.id));
    const dup = p2.filter((x) => p1ids.has(x.id));
    const sameEpochInP1 = p1.filter((x) => x.epoch_second === last).length;
    const extra = await call<Sub[]>("submissions-chokudai-boundary(+1)", `${API}/user/submissions?user=chokudai&from_second=${last + 1}`);
    const plus = Array.isArray(extra.body) ? extra.body : [];
    const plusIds = new Set(plus.map((x) => x.id));
    const lost = p2.filter((x) => !p1ids.has(x.id) && !plusIds.has(x.id) && x.epoch_second === last);
    const lostAny = p2.filter((x) => !p1ids.has(x.id) && !plusIds.has(x.id));
    findings.push(
      `Boundary (last epoch ${last}): page1 has ${sameEpochInP1} row(s) at that epoch; inclusive page2 duplicates ${dup.length} id(s) of page1 (all at epoch ${[...new Set(dup.map((x) => x.epoch_second))].join(",")}).`,
      `+1 cursor test: ${lost.length} id(s) with epoch==${last} would be LOST by using last+1 (present in inclusive page2, not in page1, not in +1 page); ${lostAny.length} total ids in inclusive page2 missing from +1 page and page1 (expected 0 beyond tail truncation).`,
      lost.length > 0
        ? "Conclusion: last+1 loses rows sharing the boundary second; use from_second = last epoch (inclusive) and dedupe by submission id."
        : "Conclusion: no rows were lost at this boundary with last+1, but that is data-dependent (multiple submissions can share one second); inclusive cursor + dedupe by id is the safe rule.",
    );
    boundaryRows = [...p1.slice(-5), ...p2.slice(0, 10)];
  }
  await saveFixture("atcoder", "submissions-page", p1.slice(0, 60));
  await saveFixture("atcoder", "submissions-boundary", boundaryRows);

  const all = pages.flat();
  const uniq = new Map(all.map((x) => [x.id, x]));
  const results = [...new Set(all.map((x) => x.result))].sort();
  const acProblems = new Set(all.filter((x) => x.result === "AC").map((x) => x.problem_id));
  findings.push(`Fetched ${all.length} rows (${uniq.size} unique ids) over ${pages.length} pages; result values: ${results.join(", ")}; unique AC problem_ids: ${acProblems.size}.`);
  await saveDump("atcoder", "chokudai-submissions", [...uniq.values()]);

  // 3. catalogs
  const pr = await call<Problem[]>("problems.json", `${RES}/problems.json`);
  const mr = await call<Record<string, Model>>("problem-models.json", `${RES}/problem-models.json`);
  const cr = await call<unknown[]>("contests.json", `${RES}/contests.json`);
  const problems = pr.body ?? [];
  const models = mr.body ?? {};
  await saveDump("atcoder", "resources/problems", problems);
  await saveDump("atcoder", "resources/problem-models", models);
  await saveDump("atcoder", "resources/contests", cr.body ?? []);
  const ids = new Set(p1.slice(0, 60).map((x) => x.problem_id));
  await saveFixture("atcoder", "problems-sample", problems.filter((p) => ids.has(p.id)));
  await saveFixture("atcoder", "problem-models-sample", Object.fromEntries(Object.entries(models).filter(([k]) => ids.has(k))));
  const noModel = problems.filter((p) => !(p.id in models)).length;
  const diffs = Object.values(models).map((m) => m.difficulty).filter((d): d is number => typeof d === "number");
  const noDiff = Object.keys(models).length - diffs.length;
  const problemKeys = [...new Set(problems.flatMap((p) => Object.keys(p)))];
  const modelKeys = [...new Set(Object.values(models).flatMap((m) => Object.keys(m)))];
  const contestKeys = [...new Set((cr.body ?? []).flatMap((c) => Object.keys(c as object)))];
  const tagLike = [...problemKeys, ...modelKeys, ...contestKeys].filter((k) => /tag|topic|categor/i.test(k));
  findings.push(
    `Catalogs: ${problems.length} problems, ${Object.keys(models).length} model entries, ${(cr.body ?? []).length} contests. Problems without model: ${noModel}; models without difficulty: ${noDiff}; difficulty min ${Math.min(...diffs)} max ${Math.max(...diffs)}; negative difficulties: ${diffs.filter((d) => d < 0).length}.`,
    `Problem keys: ${problemKeys.join(",")}; model keys: ${modelKeys.join(",")}; contest keys: ${contestKeys.join(",")}. Tag/topic-like keys: ${tagLike.length ? tagLike.join(",") : "none"}.`,
    `Sample AC problems (${acProblems.size}) with model: ${[...acProblems].filter((p) => p in models).length}.`,
  );

  // 4. profile page (single atcoder.jp request)
  await sleep(1100);
  const t0 = Date.now();
  const res = await fetch("https://atcoder.jp/users/chokudai", {
    headers: { "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36", Accept: "text/html" },
    signal: AbortSignal.timeout(30_000),
  });
  const html = await res.text();
  probes.push({ name: "atcoder.jp/users/chokudai", url: "https://atcoder.jp/users/chokudai", status: res.status, ms: Date.now() - t0, ok: res.ok });
  const rowRe = /<tr[^>]*>\s*<th[^>]*>\s*Affiliation\s*<\/th>\s*<td[^>]*>([\s\S]*?)<\/td>\s*<\/tr>/i;
  const m = rowRe.exec(html);
  const rowMatch = /<tr[^>]*>\s*<th[^>]*>\s*Affiliation\s*<\/th>[\s\S]*?<\/tr>/i.exec(html);
  const extracted = m ? m[1]!.replace(/<[^>]+>/g, "").replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/\s+/g, " ").trim() : null;
  await saveFixture("atcoder", "profile-snippet.html", { status: res.status, affiliationRowHtml: rowMatch ? rowMatch[0] : null, extracted });
  findings.push(
    `atcoder.jp/users/chokudai: HTTP ${res.status}, page ${html.length} bytes; Affiliation row ${rowMatch ? "found" : "NOT found"}; extracted=${JSON.stringify(extracted)}. Non-existent-user behaviour cannot be inferred from a 200 (AtCoder is believed to return 404, unverified, no second request made). Per-account verification by affiliation token is possible via regex on the th/td row.`,
  );

  // 5. ac_rank
  const ac = await call<unknown>("ac_rank(chokudai)", `${API}/user/ac_rank?user=chokudai`);
  findings.push(`ac_rank shape: ${JSON.stringify(ac.body)}`);

  await report("atcoder", probes, findings);
}

main().catch((e) => { console.error(e); process.exit(1); });
