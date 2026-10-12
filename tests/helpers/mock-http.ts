// Routes adapter HTTP calls to saved fixtures. Usage:
//   const http = mockHttp([{ match: "user.status", json: loadFixture("codeforces/user-status.json") }]);
//   ... call the adapter ...
//   expect(http.calls).toHaveLength(1);
// Unmatched URLs fail the test, so an adapter can't silently hit the network.

import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { vi } from "vitest";
import { httpRuntime, resetHttpPacing } from "@/lib/adapters/http";

const fixturesDir = fileURLToPath(new URL("../../fixtures/", import.meta.url));

export function loadFixture<T = unknown>(path: string): T {
  return JSON.parse(readFileSync(fixturesDir + path, "utf8")) as T;
}

export interface MockRoute {
  /** Substring of the URL, or a predicate on the URL and POST body (e.g. a GraphQL query name). */
  match: string | ((url: string, body: string | undefined) => boolean);
  status?: number;
  json?: unknown;
  text?: string;
  /** Throw instead of responding (simulates a network error). */
  error?: Error;
  /** Serve this route at most N times; later calls fall through to the next matching route. */
  times?: number;
}

export interface MockCall {
  url: string;
  method: string;
  body: string | undefined;
}

export function mockHttp(routes: MockRoute[]) {
  resetHttpPacing();
  const used = new Map<MockRoute, number>();
  const calls: MockCall[] = [];

  vi.spyOn(httpRuntime, "sleep").mockResolvedValue(undefined);
  vi.spyOn(httpRuntime, "fetch").mockImplementation(async (url, init) => {
    const body = typeof init.body === "string" ? init.body : undefined;
    calls.push({ url, method: init.method ?? "GET", body });
    const route = routes.find((r) => {
      const n = used.get(r) ?? 0;
      if (r.times !== undefined && n >= r.times) return false;
      return typeof r.match === "string" ? url.includes(r.match) : r.match(url, body);
    });
    if (!route) throw new Error(`mockHttp: no route for ${init.method ?? "GET"} ${url}`);
    used.set(route, (used.get(route) ?? 0) + 1);
    if (route.error) throw route.error;
    const text = route.text ?? JSON.stringify(route.json ?? null);
    return new Response(text, {
      status: route.status ?? 200,
      headers: { "Content-Type": route.text !== undefined ? "text/html" : "application/json" },
    });
  });

  return { calls };
}
