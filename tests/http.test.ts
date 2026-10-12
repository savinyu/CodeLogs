import { afterEach, describe, expect, it, vi } from "vitest";
import {
  HttpError,
  httpRuntime,
  isRetryableError,
  request,
  requestJson,
} from "@/lib/adapters/http";
import { mockHttp } from "./helpers/mock-http";

afterEach(() => vi.restoreAllMocks());

describe("request", () => {
  it("returns 4xx responses without retrying", async () => {
    const http = mockHttp([{ match: "x.test", status: 400, json: { status: "FAILED" } }]);
    const res = await request("https://x.test/a");
    expect(res.status).toBe(400);
    expect(res.json()).toEqual({ status: "FAILED" });
    expect(http.calls).toHaveLength(1);
  });

  it("retries 503 then succeeds", async () => {
    const http = mockHttp([
      { match: "x.test", status: 503, times: 2 },
      { match: "x.test", json: { ok: 1 } },
    ]);
    await expect(requestJson("https://x.test/a")).resolves.toEqual({ ok: 1 });
    expect(http.calls).toHaveLength(3);
  });

  it("honours retryIf", async () => {
    const limited = { status: "FAILED", comment: "Call limit exceeded" };
    const http = mockHttp([
      { match: "x.test", status: 400, json: limited, times: 1 },
      { match: "x.test", json: { status: "OK" } },
    ]);
    const res = await request("https://x.test/a", {
      retryIf: (r) => r.text.includes("Call limit exceeded"),
    });
    expect(res.json()).toEqual({ status: "OK" });
    expect(http.calls).toHaveLength(2);
  });

  it("throws a retryable network error after retries run out", async () => {
    const http = mockHttp([{ match: "x.test", error: new TypeError("fetch failed") }]);
    const err = await request("https://x.test/a", { retries: 2 }).catch((e: unknown) => e);
    expect(err).toBeInstanceOf(HttpError);
    expect((err as HttpError).kind).toBe("network");
    expect(isRetryableError(err)).toBe(true);
    expect(http.calls).toHaveLength(3);
  });

  it("requestJson throws a non-retryable status error on 404", async () => {
    mockHttp([{ match: "x.test", status: 404, text: "nope" }]);
    const err = await requestJson("https://x.test/a").catch((e: unknown) => e);
    expect(err).toBeInstanceOf(HttpError);
    expect((err as HttpError).status).toBe(404);
    expect(isRetryableError(err)).toBe(false);
  });

  it("paces requests to the same host", async () => {
    mockHttp([{ match: "x.test", json: {} }]);
    let clock = 1_000;
    vi.spyOn(httpRuntime, "now").mockImplementation(() => clock);
    const sleep = vi.mocked(httpRuntime.sleep);
    await request("https://x.test/a", { minIntervalMs: 2000 });
    clock += 500;
    await request("https://x.test/b", { minIntervalMs: 2000 });
    expect(sleep).toHaveBeenCalledWith(1500);
  });

  it("JSON-encodes object bodies", async () => {
    const http = mockHttp([{ match: "x.test", json: {} }]);
    await request("https://x.test/g", { method: "POST", body: { query: "q" } });
    expect(http.calls[0]).toMatchObject({ method: "POST", body: '{"query":"q"}' });
  });
});
