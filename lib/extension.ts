/**
 * The LogN extension's Chrome Web Store page. Set it to null to make Connect explain loading the
 * unpacked `extension/` folder instead.
 */
export const EXTENSION_STORE_URL: string | null =
  "https://chromewebstore.google.com/detail/logn/cnhphpfejpffijadknkhiaifgmpgmmch";

// The extension is plain JS and hard-codes these strings: keep them in sync with
// extension/lib/connect.js.
/** Attribute on the /extension/connect page's root element: "signed-out" or "ready". */
export const CONNECT_MARKER_ATTR = "data-logn-connect";
/** CustomEvent the extension dispatches on `document`; `detail` is "ok" or an error message. */
export const CONNECT_EVENT = "logn:extension-connect";
/** sessionStorage key with the same result, for a page that hydrates after the event fired. */
export const CONNECT_RESULT_KEY = "logn:extension-connect";
