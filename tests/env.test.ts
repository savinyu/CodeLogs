import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const VALID_ENV = {
  DATABASE_URL: "postgres://user:pass@localhost:5432/codelogs",
  GITHUB_CLIENT_ID: "client-id",
  GITHUB_CLIENT_SECRET: "client-secret",
  BETTER_AUTH_SECRET: "a".repeat(32),
  BETTER_AUTH_URL: "http://localhost:3000",
};

// env() caches its result at module level, so load a fresh copy per test.
async function loadEnv() {
  vi.resetModules();
  const mod = await import("@/lib/env");
  return mod.env;
}

describe("env()", () => {
  beforeEach(() => {
    for (const [key, value] of Object.entries(VALID_ENV)) vi.stubEnv(key, value);
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("returns the parsed env when everything is valid", async () => {
    const env = await loadEnv();
    expect(env()).toEqual(VALID_ENV);
  });

  it("throws an error naming DATABASE_URL when it is missing", async () => {
    vi.stubEnv("DATABASE_URL", undefined);
    const env = await loadEnv();
    expect(() => env()).toThrow(/DATABASE_URL/);
  });

  it("throws when BETTER_AUTH_SECRET is shorter than 32 characters", async () => {
    vi.stubEnv("BETTER_AUTH_SECRET", "a".repeat(31));
    const env = await loadEnv();
    expect(() => env()).toThrow(/BETTER_AUTH_SECRET/);
  });
});
