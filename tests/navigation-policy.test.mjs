import test from "node:test";
import assert from "node:assert/strict";
import { EventEmitter } from "node:events";
import { attachNavigationGuards, decideNavigation } from "../electron/navigation-policy.mjs";
import { loadMain } from "./helpers/loadMain.mjs";

const APP_URL = "file:///C:/Users/x/AppData/Roaming/vexx-learn/ui/index.html";

function fakeContents(url = APP_URL) {
  const c = new EventEmitter();
  c.getURL = () => url;
  c.openHandler = null;
  c.setWindowOpenHandler = (fn) => { c.openHandler = fn; };
  return c;
}
function fakeShell() {
  const calls = [];
  return { calls, openExternal: async (u) => { calls.push(u); } };
}
function navigate(c, event, url) {
  const e = { prevented: false, preventDefault() { this.prevented = true; } };
  c.emit(event, e, url);
  return e;
}
const tick = () => new Promise((r) => setImmediate(r));

const HOSTILE = [
  "file:///C:/Windows/System32/cmd.exe",
  "file:///C:/Users/x/AppData/Roaming/vexx-learn/ui/other.html",
  "http://example.com/",
  "javascript:alert(1)",
  "data:text/html,<script>1</script>",
  "blob:null/1234",
  "chrome://gpu",
  "ftp://example.com/",
  "https://user:pw@example.com/",
  "",
  "not a url",
];

test("decideNavigation: same document allowed, plain https external, everything else denied", () => {
  assert.equal(decideNavigation(APP_URL, APP_URL), "allow");
  assert.equal(decideNavigation(APP_URL + "#/lesson/3", APP_URL), "allow");
  assert.equal(decideNavigation("http://127.0.0.1:5173/", "http://127.0.0.1:5173/#x"), "allow");
  assert.equal(decideNavigation("https://example.com/docs?q=1", APP_URL), "external");
  for (const bad of HOSTILE) assert.equal(decideNavigation(bad, APP_URL), "deny", bad);
  for (const bad of [undefined, null, 5, {}, ["https://example.com"]]) assert.equal(decideNavigation(bad, APP_URL), "deny");
  // unknown current URL must never make a navigation "same document"
  assert.equal(decideNavigation("file:///x", undefined), "deny");
  assert.equal(decideNavigation("", ""), "deny");
});

test("will-navigate: foreign targets are prevented; https goes to the system browser only", async () => {
  const c = fakeContents();
  const sh = fakeShell();
  attachNavigationGuards(c, sh);
  for (const bad of HOSTILE) {
    const e = navigate(c, "will-navigate", bad);
    assert.equal(e.prevented, true, bad);
  }
  await tick();
  assert.deepEqual(sh.calls, [], "no external open for non-https targets");

  const ok = navigate(c, "will-navigate", "https://example.com/page");
  assert.equal(ok.prevented, true, "never navigate the app window to a remote page");
  await tick();
  assert.deepEqual(sh.calls, ["https://example.com/page"]);

  const same = navigate(c, "will-navigate", APP_URL);
  assert.equal(same.prevented, false, "reload of the app page is fine");
});

test("will-redirect: prevented unless same document; never opens a browser", async () => {
  const c = fakeContents();
  const sh = fakeShell();
  attachNavigationGuards(c, sh);
  assert.equal(navigate(c, "will-redirect", "https://example.com/").prevented, true);
  assert.equal(navigate(c, "will-redirect", "file:///C:/x").prevented, true);
  assert.equal(navigate(c, "will-redirect", APP_URL).prevented, false);
  await tick();
  assert.deepEqual(sh.calls, []);
});

test("window.open: always denied (no new window); https opened externally, everything else dropped", async () => {
  const c = fakeContents();
  const sh = fakeShell();
  attachNavigationGuards(c, sh);
  for (const bad of HOSTILE) assert.deepEqual(c.openHandler({ url: bad }), { action: "deny" }, bad);
  assert.deepEqual(c.openHandler({ url: "https://example.com/a" }), { action: "deny" });
  await tick();
  assert.deepEqual(sh.calls, ["https://example.com/a"]);
});

test("openExternal failure does not crash the guard", async () => {
  const c = fakeContents();
  attachNavigationGuards(c, { openExternal: async () => { throw new Error("boom"); } });
  assert.deepEqual(c.openHandler({ url: "https://example.com/" }), { action: "deny" });
  navigate(c, "will-navigate", "https://example.com/");
  await tick();
});

test("will-attach-webview is prevented", () => {
  const c = fakeContents();
  attachNavigationGuards(c, fakeShell());
  assert.equal(navigate(c, "will-attach-webview", "x").prevented, true);
});

test("main.mjs wires the guards to every created webContents", async () => {
  const m = await loadMain();
  try {
    const hook = m.appListeners.get("web-contents-created");
    assert.equal(typeof hook, "function", "main.mjs must register web-contents-created");
    const c = fakeContents("http://127.0.0.1:5173/");
    hook({}, c);
    assert.equal(typeof c.openHandler, "function");
    assert.equal(navigate(c, "will-navigate", "file:///C:/Windows/win.ini").prevented, true);
    assert.deepEqual(c.openHandler({ url: "file:///C:/Windows/win.ini" }), { action: "deny" });
    const ok = navigate(c, "will-navigate", "https://example.org/x");
    assert.equal(ok.prevented, true);
    await tick();
    assert.deepEqual(m.shellCalls.openExternal, ["https://example.org/x"], "uses the same shell as shell:open");
  } finally {
    m.restore();
  }
});