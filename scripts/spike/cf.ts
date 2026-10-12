// M0 spike: Codeforces official API.
import { fetchJson, saveFixture, saveDump, report, sleep, type ProbeResult } from "./lib";

const BASE = "https://codeforces.com/api";
const HANDLE = "savinyu";
const probes: ProbeResult[] = [];
const findings: string[] = [];

interface Problem {
  contestId?: number;
  index: string;
  name?: string;
  rating?: number;
  tags?: string[];
}
interface Sub {
  id: number;
  contestId?: number;
  verdict?: string;
  problem: Problem;
}
interface Resp<T> {
  status: string;
  result?: T;
  comment?: string;
}

async function call<T>(name: string, path: string, note?: (b: Resp<T> | null) => string) {
  const url = `${BASE}/${path}`;
  const r = await fetchJson<Resp<T>>(url);
  probes.push({
    name,
    url,
    status: r.status,
    ms: r.ms,
    ok: r.status === 200 && r.body?.status === "OK",
    note: note?.(r.body) ?? r.body?.comment,
  });
  await sleep(2100);
  return r;
}

const key = (p: Problem) => `${p.contestId}${p.index}`;

// 1. user.info
const ui = await call<Array<Record<string, unknown>>>("user.info", `user.info?handles=${HANDLE}`);
await saveFixture("codeforces", "user-info", ui.body);
const u = ui.body?.result?.[0] ?? {};
findings.push(
  `user.info organization field = ${JSON.stringify(u.organization)} (present: ${"organization" in u}); other keys: ${Object.keys(u).join(", ")}`,
);

// 2. user.status full
const us = await call<Sub[]>("user.status (full)", `user.status?handle=${HANDLE}`, (b) => `rows=${b?.result?.length}`);
await saveFixture("codeforces", "user-status", us.body);
const subs = us.body?.result ?? [];
const accepted = new Map<string, Problem>();
for (const s of subs) if (s.verdict === "OK") accepted.set(key(s.problem), s.problem);
const accArr = [...accepted.values()];
const noRating = accArr.filter((p) => p.rating == null).length;
const noTags = accArr.filter((p) => !p.tags || p.tags.length === 0).length;
const gym = accArr.filter((p) => (p.contestId ?? 0) >= 100000).length;
const sortedDesc = subs.every((s, i) => i === 0 || (subs[i - 1]?.id ?? 0) > s.id);
findings.push(
  `user.status full history in one call: ${subs.length} submissions, ${accepted.size} unique accepted problems; accepted lacking rating=${noRating}, lacking tags=${noTags}, gym (contestId>=100000)=${gym}; sorted newest-first strictly by id: ${sortedDesc}`,
);
const verdicts: Record<string, number> = {};
for (const s of subs) verdicts[s.verdict ?? "undefined"] = (verdicts[s.verdict ?? "undefined"] ?? 0) + 1;
findings.push(`verdict distribution: ${JSON.stringify(verdicts)}`);
const sizeKb = Math.round(JSON.stringify(us.body).length / 1024);
findings.push(`user-status raw JSON size ~${sizeKb} KB (compact)`);

// 3. incremental
const inc = await call<Sub[]>("user.status (from=1,count=5)", `user.status?handle=${HANDLE}&from=1&count=5`, (b) => `rows=${b?.result?.length}`);
const incIds = (inc.body?.result ?? []).map((s) => s.id);
const fullIds = subs.slice(0, 5).map((s) => s.id);
const same = JSON.stringify(incIds) === JSON.stringify(fullIds);
findings.push(`incremental from=1&count=5 ids=${incIds.join(",")}; match first 5 of full=${same}`);

// 4. problemset
const ps = await call<{ problems: Problem[]; problemStatistics: Array<{ contestId?: number; index: string }> }>(
  "problemset.problems",
  "problemset.problems",
  (b) => `problems=${b?.result?.problems.length}`,
);
await saveDump("codeforces", "problemset", ps.body);
const probs = ps.body?.result?.problems ?? [];
const stats = ps.body?.result?.problemStatistics ?? [];
const psNoRating = probs.filter((p) => p.rating == null).length;
const psNoTags = probs.filter((p) => !p.tags || p.tags.length === 0).length;
findings.push(`problemset: ${probs.length} problems, ${psNoRating} lack rating, ${psNoTags} lack tags`);
const inCatalog = new Set(probs.map(key));
const missing = [...accepted.keys()].filter((k) => !inCatalog.has(k));
findings.push(`accepted problems not found in problemset catalog: ${missing.length}${missing.length ? " (" + missing.slice(0, 10).join(", ") + ")" : ""}`);
const wanted = new Set<string>([...accepted.keys(), ...probs.slice(0, 30).map(key)]);
const idx = probs.map((p, i) => [p, i] as const).filter(([p]) => wanted.has(key(p))).map(([, i]) => i);
await saveFixture("codeforces", "problemset-sample", {
  status: "OK",
  result: { problems: idx.map((i) => probs[i]), problemStatistics: idx.map((i) => stats[i]).filter(Boolean) },
});

// 5. tags
const tagCount = new Map<string, number>();
for (const p of probs) for (const t of p.tags ?? []) tagCount.set(t, (tagCount.get(t) ?? 0) + 1);
const tags = [...tagCount].sort((a, b) => b[1] - a[1]).map(([tag, count]) => ({ tag, count }));
await saveFixture("codeforces", "tags", tags);
findings.push(`distinct tags in catalog: ${tags.length}; top: ${tags.slice(0, 5).map((t) => `${t.tag}(${t.count})`).join(", ")}`);

// 6. error probe
const er = await call<unknown>("user.status (unknown handle)", "user.status?handle=this_handle_should_not_exist_zz9");
await saveFixture("codeforces", "error-unknown-handle", { httpStatus: er.status, body: er.body, rawText: er.body ? undefined : er.text.slice(0, 500) });
findings.push(`unknown handle: HTTP ${er.status}, status=${er.body?.status}, comment=${JSON.stringify(er.body?.comment)}`);

// 6b. valid-length but nonexistent handle
await sleep(0);
const er2 = await call<unknown>("user.status (nonexistent valid-length handle)", "user.status?handle=zz9_nobody_here_qq");
await saveFixture("codeforces", "error-unknown-handle-valid-length", { httpStatus: er2.status, body: er2.body });
findings.push(`nonexistent but well-formed handle: HTTP ${er2.status}, status=${er2.body?.status}, comment=${JSON.stringify(er2.body?.comment)}`);
await report("codeforces", probes, findings);
