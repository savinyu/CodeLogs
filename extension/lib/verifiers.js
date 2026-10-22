// @ts-check
// Codeforces and AtCoder are synced by the server from their public APIs; the extension only
// proves the handle is yours by reading which user this browser is logged in as. These objects
// have the shape of a reader (name, origin, homeUrl, permissions, identitySteps) so the tab
// helpers and createContext() work on them, but there is no `read`.

/** @type {{ id: "codeforces", name: string, origin: string, homeUrl: string, permissions: string[], visitPrefix: string, identitySteps: import("./job.js").PageCall[] }} */
export const codeforces = {
  id: "codeforces",
  name: "Codeforces",
  origin: "https://codeforces.com",
  homeUrl: "https://codeforces.com/",
  permissions: ["https://codeforces.com/*"],
  visitPrefix: "https://codeforces.com/",
  // The header's "HANDLE | Logout" block; logged out it shows Enter | Register instead.
  identitySteps: [
    {
      fn: "readSelectorLinkHandle",
      args: [".lang-chooser a[href^='/profile/']", "^/profile/([^/?#]+)/?$"],
    },
  ],
};

/** @type {{ id: "atcoder", name: string, origin: string, homeUrl: string, permissions: string[], visitPrefix: string, identitySteps: import("./job.js").PageCall[] }} */
export const atcoder = {
  id: "atcoder",
  name: "AtCoder",
  origin: "https://atcoder.jp",
  homeUrl: "https://atcoder.jp/home",
  permissions: ["https://atcoder.jp/*"],
  visitPrefix: "https://atcoder.jp/",
  // Every page has `var userScreenName = "...";` ("" when logged out).
  identitySteps: [{ fn: "readGlobal", args: [["userScreenName"]], world: "MAIN" }],
};

export const VERIFIERS = { codeforces, atcoder };
