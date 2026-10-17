// Screenshots a page in headless Chrome over the DevTools protocol (v2 visual checks), and
// reports anything wider than the viewport. Uses Node's built-in WebSocket; no dependencies.
//
//   pnpm dev:shot <url> <out.png> [--width 1280] [--height 900] [--full] [--dark]
//                 [--cookie .preview/<user>.cookie] [--wait 2500]
import { spawn } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync, writeFileSync, existsSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const CHROME = "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
const [url, out] = process.argv.slice(2);
if (!url || !out) {
  console.error(
    "Usage: pnpm dev:shot <url> <out.png> [--width N] [--height N] [--full] [--dark] [--cookie file] [--wait ms]",
  );
  process.exit(1);
}
const flag = (name: string) => process.argv.includes(`--${name}`);
const opt = (name: string, fallback: number) => {
  const i = process.argv.indexOf(`--${name}`);
  return i > 0 ? Number(process.argv[i + 1]) : fallback;
};
const width = opt("width", 1280);
const height = opt("height", 900);
const wait = opt("wait", 2500);
const cookieIndex = process.argv.indexOf("--cookie");
const cookieFile = cookieIndex > 0 ? process.argv[cookieIndex + 1] : undefined;

const profile = mkdtempSync(join(tmpdir(), "codelogs-shot-"));
const chrome = spawn(CHROME, [
  "--headless=new",
  "--disable-gpu",
  "--hide-scrollbars",
  "--no-first-run",
  "--remote-debugging-port=0",
  `--user-data-dir=${profile}`,
  "about:blank",
]);

try {
  const portFile = join(profile, "DevToolsActivePort");
  for (let i = 0; i < 100 && !existsSync(portFile); i++)
    await new Promise((r) => setTimeout(r, 100));
  const port = readFileSync(portFile, "utf8").split("\n")[0];
  const targets = (await (await fetch(`http://127.0.0.1:${port}/json`)).json()) as {
    type: string;
    webSocketDebuggerUrl: string;
  }[];
  const page = targets.find((t) => t.type === "page");
  if (!page) throw new Error("No page target");

  const ws = new WebSocket(page.webSocketDebuggerUrl);
  await new Promise((resolve, reject) => {
    ws.onopen = resolve;
    ws.onerror = reject;
  });
  let nextId = 0;
  const pending = new Map<number, (result: unknown) => void>();
  const listeners: ((method: string) => void)[] = [];
  ws.onmessage = (event) => {
    const msg = JSON.parse(String(event.data));
    if (msg.id !== undefined) pending.get(msg.id)?.(msg.result ?? msg.error);
    else listeners.forEach((l) => l(msg.method));
  };
  const send = <T = Record<string, unknown>>(method: string, params: object = {}) =>
    new Promise<T>((resolve) => {
      const id = ++nextId;
      pending.set(id, resolve as (r: unknown) => void);
      ws.send(JSON.stringify({ id, method, params }));
    });

  await send("Page.enable");
  await send("Network.enable");
  if (cookieFile) {
    const [name, ...rest] = readFileSync(cookieFile, "utf8").trim().split("=");
    const { hostname } = new URL(url);
    await send("Network.setCookie", { name, value: rest.join("="), domain: hostname, path: "/" });
  }
  await send("Emulation.setDeviceMetricsOverride", {
    width,
    height,
    deviceScaleFactor: 1,
    mobile: width < 500,
  });
  await send("Emulation.setEmulatedMedia", {
    features: [{ name: "prefers-color-scheme", value: flag("dark") ? "dark" : "light" }],
  });
  const loaded = new Promise<void>((resolve) =>
    listeners.push((m) => m === "Page.loadEventFired" && resolve()),
  );
  const nav = await send<{ errorText?: string }>("Page.navigate", { url });
  if (nav.errorText) throw new Error(`Could not load ${url}: ${nav.errorText}`);
  await loaded;
  await new Promise((r) => setTimeout(r, wait));

  const overflow = await send<{ result: { value: string[] } }>("Runtime.evaluate", {
    returnByValue: true,
    expression: `(() => {
      const w = document.documentElement.clientWidth;
      // Inside a sideways scroller or a clipped box, extra width is intended.
      const contained = (el) => {
        for (let p = el.parentElement; p && p !== document.body; p = p.parentElement) {
          if (["auto", "scroll", "hidden", "clip"].includes(getComputedStyle(p).overflowX)) return true;
        }
        return false;
      };
      return [...document.querySelectorAll("body *")]
        .filter((el) => el.getBoundingClientRect().right > w + 1
          && getComputedStyle(el).position !== "fixed" && !contained(el))
        .slice(0, 8)
        .map((el) => el.tagName.toLowerCase() + (el.id ? "#" + el.id : "") + "." + String(el.className).split(" ").slice(0, 3).join("."));
    })()`,
  });
  const metrics = await send<{ cssContentSize: { width: number; height: number } }>(
    "Page.getLayoutMetrics",
  );
  const shot = await send<{ data: string }>("Page.captureScreenshot", {
    format: "png",
    captureBeyondViewport: flag("full"),
    ...(flag("full") && {
      clip: { x: 0, y: 0, width, height: Math.ceil(metrics.cssContentSize.height), scale: 1 },
    }),
  });
  writeFileSync(out, Buffer.from(shot.data, "base64"));
  const wide = overflow.result.value;
  console.log(`Saved ${out} (${width}px${flag("dark") ? ", dark" : ""}).`);
  console.log(
    wide.length ? `Wider than the viewport: ${wide.join(", ")}` : "No horizontal overflow.",
  );
  ws.close();
} finally {
  const exited = new Promise((resolve) => chrome.once("exit", resolve));
  chrome.kill();
  await exited;
  rmSync(profile, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 });
}
