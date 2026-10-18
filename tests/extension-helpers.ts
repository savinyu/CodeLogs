// A stand-in for the platform tab: answers the extension's injected calls from fixtures, so a
// platform reader can run end to end without a browser. Not a test file (no ".test.").
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { createContext, type PageCall } from "../extension/lib/job.js";

const fixturesDir = fileURLToPath(new URL("../fixtures/", import.meta.url));

export function loadText(path: string): string {
  return readFileSync(fixturesDir + path, "utf8");
}

export interface FakeRoute {
  /** Substring of the request URL. */
  match: string;
  status?: number;
  data?: unknown;
  /** Serve this route at most N times; later calls fall through to the next match. */
  times?: number;
}

export interface FakePageOptions {
  /** What the identity steps return, one entry per identity() call (the last entry repeats). */
  identity?: Array<string | null>;
  routes: FakeRoute[];
}

export function fakePage(options: FakePageOptions) {
  const requests: Array<{ url: string; method?: string; body?: string | null }> = [];
  const identityCalls: string[] = [];
  const delays: number[] = [];
  const served = new Map<FakeRoute, number>();
  let identityRound = 0;

  const runInPage = async (call: PageCall): Promise<unknown> => {
    if (call.fn === "fetchInPage") {
      const req = call.args[0] as { url: string; method?: string; body?: string | null };
      requests.push({ url: req.url, method: req.method, body: req.body });
      for (const route of options.routes) {
        if (!req.url.includes(route.match)) continue;
        const n = served.get(route) ?? 0;
        if (route.times !== undefined && n >= route.times) continue;
        served.set(route, n + 1);
        return { status: route.status ?? 200, data: route.data ?? null };
      }
      throw new Error(`Unmatched request in test: ${req.url}`);
    }
    // An identity step: the first step of each round answers; later steps only run if it didn't.
    identityCalls.push(call.fn);
    const list = options.identity ?? [];
    const value = list[Math.min(identityRound, list.length - 1)] ?? null;
    if (value !== null) {
      identityRound++;
    }
    return value;
  };

  const context = (platform: { name: string; identitySteps: PageCall[] }) =>
    createContext(platform, {
      runInPage,
      sleep: async (ms) => {
        delays.push(ms);
      },
      now: () => Date.UTC(2026, 9, 18, 12, 0, 0),
      onProgress: () => {},
    });

  return { runInPage, context, requests, identityCalls, delays };
}
