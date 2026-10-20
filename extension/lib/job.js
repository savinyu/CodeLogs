// @ts-check
// The request context a platform reader runs against. It paces requests (one at a time, at least
// minDelayMs apart), backs off on 429/403 and turns problems into short human messages. The
// actual page access is injected as `runInPage`, so tests can drive a reader with fixtures.
import { ReaderError, ThrottledError, cleanIdentity, sleep as defaultSleep } from "./common.js";

export const MIN_DELAY_MS = 1500;
export const BACKOFF_MS = [10_000, 20_000];

/**
 * One injected call: the name of a function in inject.js, its JSON arguments and the world.
 * @typedef {{ fn: string, args: unknown[], world?: "ISOLATED" | "MAIN" }} PageCall
 * @typedef {{ url: string, method?: string, body?: string | null, headers?: Record<string, string>, as?: "json" | "text" }} GetOptions
 * @typedef {{ status: number, data: unknown }} PageResponse
 * @typedef {{
 *   name: string,
 *   get: (url: string, opts?: Omit<GetOptions, "url">) => Promise<PageResponse>,
 *   identity: () => Promise<string | null>,
 *   progress: (message: string) => void,
 *   now: () => number,
 * }} ReaderContext
 */

/**
 * @param {{ name: string, identitySteps: PageCall[] }} platform
 * @param {{
 *   runInPage: (call: PageCall) => Promise<unknown>,
 *   sleep?: (ms: number) => Promise<void>,
 *   now?: () => number,
 *   minDelayMs?: number,
 *   backoffMs?: number[],
 *   onProgress?: (message: string) => void,
 * }} options
 * @returns {ReaderContext}
 */
export function createContext(platform, options) {
  const sleep = options.sleep ?? defaultSleep;
  const now = options.now ?? Date.now;
  const minDelayMs = options.minDelayMs ?? MIN_DELAY_MS;
  const backoffMs = options.backoffMs ?? BACKOFF_MS;
  const name = platform.name;
  let lastAt = 0;

  async function pace() {
    if (lastAt !== 0) {
      const wait = lastAt + minDelayMs - now();
      if (wait > 0) await sleep(wait);
    }
  }

  /** @param {PageCall} call */
  async function run(call) {
    try {
      return await options.runInPage(call);
    } catch {
      throw new ReaderError(
        `Could not read ${name} in its browser tab. Reload the ${name} tab, log in, and try again.`,
      );
    } finally {
      lastAt = now();
    }
  }

  return {
    name,
    now,
    progress: options.onProgress ?? (() => {}),

    async get(url, opts = {}) {
      for (let attempt = 0; ; attempt++) {
        await pace();
        const res = /** @type {any} */ (await run({ fn: "fetchInPage", args: [{ url, ...opts }] }));
        const status = typeof res?.status === "number" ? res.status : 0;
        if (status === 0) throw new ReaderError(`Could not reach ${name} from your browser tab.`);
        if (status === 429 || status === 403) {
          const wait = backoffMs[attempt];
          if (wait === undefined) {
            throw new ThrottledError(
              `${name} keeps refusing requests (HTTP ${status}). Wait a few minutes and try again.`,
            );
          }
          options.onProgress?.(`${name} asked us to slow down. Waiting ${wait / 1000} s...`);
          await sleep(wait);
          continue;
        }
        return { status, data: res?.data ?? null };
      }
    },

    async identity() {
      for (const step of platform.identitySteps) {
        await pace();
        const id = cleanIdentity(await run(step));
        if (id) return id;
      }
      return null;
    },
  };
}
