import { afterEach, describe, expect, it, vi } from "vitest";
import { ReaderError } from "../extension/lib/common.js";
import { createContext, type PageCall } from "../extension/lib/job.js";
import {
  INJECTED,
  fetchInPage,
  readCookie,
  readGlobal,
  readInitialData,
  readJsonField,
  readLinkHandle,
} from "../extension/lib/inject.js";

const steps: PageCall[] = [
  { fn: "readCookie", args: ["u"] },
  { fn: "readGlobal", args: [["a"]], world: "MAIN" },
];

function setup(
  responses: Array<{ status: number; data?: unknown } | Error>,
  identities: unknown[] = [],
) {
  const queue = [...responses];
  const ids = [...identities];
  const calls: PageCall[] = [];
  const delays: number[] = [];
  let t = 1_000_000;
  const ctx = createContext(
    { name: "Foo", identitySteps: steps },
    {
      runInPage: async (call) => {
        calls.push(call);
        if (call.fn !== "fetchInPage") return ids.shift() ?? null;
        const next = queue.shift();
        if (next instanceof Error) throw next;
        return next ?? { status: 200, data: null };
      },
      sleep: async (ms) => {
        delays.push(ms);
        t += ms;
      },
      now: () => t,
    },
  );
  return { ctx, calls, delays };
}

describe("createContext", () => {
  it("spaces requests at least 1500 ms apart", async () => {
    const { ctx, delays } = setup([
      { status: 200, data: 1 },
      { status: 200, data: 2 },
      { status: 200, data: 3 },
    ]);
    await ctx.get("/a");
    await ctx.get("/b");
    await ctx.get("/c");
    expect(delays).toEqual([1500, 1500]);
  });

  it("backs off 10 s then 20 s on 429 and then gives up with a clear message", async () => {
    const { ctx, delays } = setup([{ status: 429 }, { status: 429 }, { status: 429 }]);
    await expect(ctx.get("/a")).rejects.toThrow(/Foo keeps refusing requests \(HTTP 429\)/);
    expect(delays.filter((d) => d >= 10_000)).toEqual([10_000, 20_000]);
  });

  it("recovers when the retry succeeds, and treats 403 like 429", async () => {
    const { ctx, delays } = setup([{ status: 403 }, { status: 200, data: { ok: true } }]);
    expect(await ctx.get("/a")).toEqual({ status: 200, data: { ok: true } });
    expect(delays).toContain(10_000);
  });

  it("does not retry other errors, it returns the status", async () => {
    const { ctx, calls } = setup([{ status: 404, data: null }]);
    expect(await ctx.get("/a")).toEqual({ status: 404, data: null });
    expect(calls).toHaveLength(1);
  });

  it("turns a dead tab or network error into a short message", async () => {
    const dead = setup([new Error("Frame was removed")]);
    await expect(dead.ctx.get("/a")).rejects.toThrow(ReaderError);
    await expect(setup([{ status: 0 }]).ctx.get("/a")).rejects.toThrow(/Could not reach Foo/);
  });

  it("runs identity steps in order and cleans the answer", async () => {
    const first = setup([], [null, "me_1"]);
    expect(await first.ctx.identity()).toBe("me_1");
    expect(first.calls.map((c) => c.fn)).toEqual(["readCookie", "readGlobal"]);
    // an email-looking value is dropped
    const leaky = setup([], ["me@example.com", null]);
    expect(await leaky.ctx.identity()).toBeNull();
  });
});

describe("injected functions", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("exposes every function the readers name", async () => {
    const { READERS } = await import("../extension/lib/registry.js");
    const names = Object.values(READERS).flatMap((r) => r.identitySteps.map((s) => s.fn));
    for (const name of [...names, "fetchInPage"]) expect(INJECTED).toHaveProperty(name);
  });

  it("readJsonField returns only the one field", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({
        ok: true,
        json: async () => ({
          data: { uuid: "u-1", email: "me@example.com", user_access_token: "secret" },
        }),
      })),
    );
    expect(await readJsonField("/x", ["data", "uuid"])).toBe("u-1");
    expect(await readJsonField("/x", ["data", "missing"])).toBeNull();
    expect(await readJsonField("/x", ["data"])).toBeNull();
  });

  it("readJsonField sends the given method", async () => {
    const fetchMock = vi.fn(async () => ({
      ok: true,
      json: async () => ({ user_name: "gfg.user" }),
    }));
    vi.stubGlobal("fetch", fetchMock);
    expect(await readJsonField("/profile/", ["user_name"], "POST")).toBe("gfg.user");
    expect(fetchMock).toHaveBeenCalledWith(
      "/profile/",
      expect.objectContaining({ method: "POST" }),
    );
  });

  it("readJsonField is null for logged-out and failing responses", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({ ok: true, json: async () => ({ data: {} }) })),
    );
    expect(await readJsonField("/x", ["data", "uuid"])).toBeNull();
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({ ok: false, json: async () => ({}) })),
    );
    expect(await readJsonField("/x", ["a"])).toBeNull();
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => {
        throw new Error("net");
      }),
    );
    expect(await readJsonField("/x", ["a"])).toBeNull();
  });

  it("fetchInPage returns status and parsed data, never throws", async () => {
    const fetchMock = vi.fn(async () => ({
      status: 200,
      json: async () => ({ a: 1 }),
      text: async () => "t",
    }));
    vi.stubGlobal("fetch", fetchMock);
    expect(await fetchInPage({ url: "/x" })).toEqual({ status: 200, data: { a: 1 } });
    expect(await fetchInPage({ url: "/x", as: "text" })).toEqual({ status: 200, data: "t" });
    await fetchInPage({ url: "/x", method: "POST", body: "{}", headers: { A: "b" } });
    expect(fetchMock).toHaveBeenLastCalledWith("/x", {
      method: "POST",
      credentials: "include",
      headers: { A: "b" },
      body: "{}",
    });
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => {
        throw new Error("net");
      }),
    );
    expect((await fetchInPage({ url: "/x" })).status).toBe(0);
  });

  it("readCookie reads one cookie and decodes it", () => {
    vi.stubGlobal("document", { cookie: "authtoken=SECRET; gfguserName=some%2Euser; other=1" });
    expect(readCookie("gfguserName")).toBe("some.user");
    expect(readCookie("nope")).toBeNull();
  });

  it("readGlobal walks window and returns strings only", () => {
    vi.stubGlobal("window", {
      __INTERVIEWBIT__: { user: { username: "ib_user", email: "me@example.com" } },
    });
    expect(readGlobal(["__INTERVIEWBIT__", "user", "username"])).toBe("ib_user");
    expect(readGlobal(["__INTERVIEWBIT__", "user"])).toBeNull();
    expect(readGlobal(["missing", "x"])).toBeNull();
  });

  it("readLinkHandle finds a profile link in the header", () => {
    const link = (href: string) => ({ getAttribute: () => href });
    vi.stubGlobal("location", { origin: "https://www.geeksforgeeks.org" });
    vi.stubGlobal("document", {
      querySelectorAll: () => [
        link("/courses"),
        link("https://www.geeksforgeeks.org/profile/Some%20One?tab=1"),
      ],
    });
    expect(readLinkHandle("^/(?:profile|user)/([^/?#]+)")).toBe("Some One");
    expect(readLinkHandle("^/users/([^/]+)")).toBeNull();
  });

  it("readInitialData reads a URL-encoded redux state", () => {
    const state = { community: { profile: { username: "hr_user", email: "x@y.z" } } };
    vi.stubGlobal("document", {
      getElementById: () => ({ textContent: encodeURIComponent(JSON.stringify(state)) }),
    });
    expect(readInitialData(["community", "profile", "username"])).toBe("hr_user");
    expect(readInitialData(["community", "profile"])).toBeNull();
  });
});
