// @ts-check
// Verifies a Codeforces or AtCoder handle, or connects one when none is connected yet: reads which
// user this browser is logged in as, in a tab on the platform's own site, and tells LogN.
// Nothing is synced here (the server reads both from their public APIs).
import { NotLoggedInError, ReaderError } from "./common.js";
import { createContext } from "./job.js";
import { pageRunner, withPlatformTab, withVisitedTab } from "./platform-job.js";
import { skipsRemoved } from "./schedule.js";
import { planVerify } from "./verify-plan.js";
import { checkMe, postUpload } from "./server.js";
import { VERIFIERS } from "./verifiers.js";

/**
 * Without `tabId` it uses an open tab or a background one; with it, only that tab (a visit).
 * `manual`: the user clicked this platform, so a platform they removed on LogN is connected again;
 * otherwise it is skipped before any tab is opened.
 * @param {{ platformId: string, base: string, token: string, tabId?: number, manual: boolean, setStatus: (patch: Record<string, unknown>) => Promise<void> }} job
 * @returns {Promise<{ ok?: boolean, handle?: string, verified?: boolean, already?: boolean, created?: boolean, skipped?: boolean }>}
 */
export async function runVerifyJob({ platformId, base, token, tabId, manual, setStatus }) {
  const v = /** @type {Record<string, (typeof VERIFIERS)[keyof typeof VERIFIERS]>} */ (VERIFIERS)[
    platformId
  ];
  if (!v) throw new ReaderError("Unknown platform.");

  if (!(await chrome.permissions.contains({ origins: v.permissions }))) {
    throw new ReaderError(
      `LogN needs permission to read ${v.name}. Click Verify again and allow access.`,
    );
  }

  await setStatus({ step: "connect", message: "Checking your LogN connection..." });
  const me = await checkMe(base, token);
  if (skipsRemoved(me, platformId, manual)) return { skipped: true };
  const plan = planVerify(me.handles, platformId);
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

  await setStatus({ step: "upload", message: "Verifying with LogN..." });
  return postUpload(base, token, "/api/extension/verify", {
    platform: platformId,
    loggedInAs,
    manual,
  });
}
