// @ts-check
// Verifies a Codeforces or AtCoder handle: reads which user this browser is logged in as, in a
// tab on the platform's own site, and tells CodeLogs. Nothing is synced here (the server reads
// both from their public APIs).
import { NotLoggedInError, ReaderError } from "./common.js";
import { createContext } from "./job.js";
import { pageRunner, withPlatformTab, withVisitedTab } from "./platform-job.js";
import { planVerify } from "./verify-plan.js";
import { checkMe, postUpload } from "./server.js";
import { VERIFIERS } from "./verifiers.js";

/**
 * Without `tabId` it uses an open tab or a background one; with it, only that tab (a visit).
 * @param {{ platformId: string, base: string, token: string, tabId?: number, auto: boolean, setStatus: (patch: Record<string, unknown>) => Promise<void> }} job
 * @returns {Promise<{ ok?: boolean, handle?: string, verified?: boolean, already?: boolean, notConnected?: boolean }>}
 */
export async function runVerifyJob({ platformId, base, token, tabId, auto, setStatus }) {
  const v = /** @type {Record<string, (typeof VERIFIERS)[keyof typeof VERIFIERS]>} */ (VERIFIERS)[
    platformId
  ];
  if (!v) throw new ReaderError("Unknown platform.");

  if (!(await chrome.permissions.contains({ origins: v.permissions }))) {
    throw new ReaderError(
      `CodeLogs needs permission to read ${v.name}. Click Verify again and allow access.`,
    );
  }

  await setStatus({ step: "connect", message: "Checking your CodeLogs connection..." });
  const me = await checkMe(base, token);
  const plan = planVerify(me.handles, platformId, v.name, auto);
  if (plan.action === "done") return plan.result;

  await setStatus({ step: "read", message: `Opening ${v.name}...` });
  /** @param {number} id */
  const readIn = async (id) => {
    const ctx = createContext(v, { runInPage: pageRunner(id) });
    const who = await ctx.identity();
    if (!who) {
      throw new NotLoggedInError(
        `You are not logged in to ${v.name} in this browser. Log in and try again.`,
      );
    }
    return who;
  };
  const loggedInAs =
    tabId === undefined ? await withPlatformTab(v, readIn) : await withVisitedTab(v, tabId, readIn);

  await setStatus({ step: "upload", message: "Verifying with CodeLogs..." });
  return postUpload(base, token, "/api/extension/verify", { platform: platformId, loggedInAs });
}
