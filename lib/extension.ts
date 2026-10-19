/**
 * The CodeLogs extension's Chrome Web Store page. Null until it is published; until then Connect
 * explains how to load the unpacked `extension/` folder.
 */
export const EXTENSION_STORE_URL: string | null = null;

// The extension is plain JS and hard-codes these strings: keep them in sync with
// extension/lib/connect.js.
/** Attribute on the /extension/connect page's root element: "signed-out" or "ready". */
export const CONNECT_MARKER_ATTR = "data-codelogs-connect";
/** CustomEvent the extension dispatches on `document`; `detail` is "ok" or an error message. */
export const CONNECT_EVENT = "codelogs:extension-connect";
/** sessionStorage key with the same result, for a page that hydrates after the event fired. */
export const CONNECT_RESULT_KEY = "codelogs:extension-connect";
