import test from "node:test";
import assert from "node:assert/strict";
import { isAllowedUpdateBaseUrl, sanitizeSettingsPatch } from "../electron/security-policy.mjs";
import { loadMain } from "./helpers/loadMain.mjs";

const CFG = { githubOwner: "acme", githubRepo: "learn" };
const GOOD = "https://raw.githubusercontent.com/acme/learn/main/release/updates";

test("updateBaseUrl: accepts empty and allowlisted https URLs", () => {
  assert.equal(isAllowedUpdateBaseUrl("", CFG), true);
  assert.equal(isAllowedUpdateBaseUrl(GOOD, CFG), true);
  assert.equal(isAllowedUpdateBaseUrl("https://github.com/acme/learn/releases/download/v1", CFG), true);
  assert.equal(isAllowedUpdateBaseUrl("https://objects.githubusercontent.com/x/y", CFG), true);
});

test("updateBaseUrl: rejects http, file, javascript, data, unknown hosts", () => {
  for (const bad of [
    "http://raw.githubusercontent.com/acme/learn/main/release/updates",
    "file:///C:/Windows/System32",
    "javascript:alert(1)",
    "data:text/html,<script>1</script>",
    "ftp://raw.githubusercontent.com/acme/learn/",
    "https://evil.example.com/acme/learn/main",
    "https://raw.githubusercontent.com.evil.com/acme/learn/main",
    "https://evil.com/raw.githubusercontent.com/acme/learn/main",
    "https://user:pw@raw.githubusercontent.com/acme/learn/main",
    "https://raw.githubusercontent.com:8443/acme/learn/main",
    "//raw.githubusercontent.com/acme/learn/main",
    "not a url",
    "https://raw.githubusercontent.com/acme/learn/main\n.evil",
    null,
    42,
  ]) {
    assert.equal(isAllowedUpdateBaseUrl(bad, CFG), false, String(bad));
  }
});

test("updateBaseUrl: raw.githubusercontent.com must stay inside the configured owner/repo", () => {
  assert.equal(isAllowedUpdateBaseUrl("https://raw.githubusercontent.com/attacker/learn/main/x", CFG), false);
  assert.equal(isAllowedUpdateBaseUrl("https://raw.githubusercontent.com/acme/other/main/x", CFG), false);
  assert.equal(isAllowedUpdateBaseUrl("https://raw.githubusercontent.com/acme/learn-evil/main/x", CFG), false);
});

test("sanitizeSettingsPatch: keeps known keys, drops unknown/invalid ones", () => {
  const { patch, rejected } = sanitizeSettingsPatch(
    { theme: "neon", editorFontSize: 16, updateBaseUrl: "http://evil.test/", __proto__x: 1, hack: true, accent: "nope" },
    CFG
  );
  assert.deepEqual(patch, { theme: "neon", editorFontSize: 16 });
  assert.deepEqual(rejected.sort(), ["__proto__x", "accent", "hack", "updateBaseUrl"]);
  assert.deepEqual(sanitizeSettingsPatch(null, CFG).patch, {});
});

test("IPC settings:set rejects bad updateBaseUrl and does not persist it", async () => {
  const m = await loadMain();
  try {
    const set = m.handlers.get("settings:set");
    const get = m.handlers.get("settings:get");
    const before = (await get({})).updateBaseUrl;
    for (const bad of ["http://raw.githubusercontent.com/x/y/main", "file:///C:/x", "javascript:alert(1)", "https://evil.example.com/a/b"]) {
      const res = await set({}, { updateBaseUrl: bad, theme: "midnight" });
      assert.equal(res.updateBaseUrl, before, "unchanged for " + bad);
      assert.equal(res.theme, "midnight", "other valid keys still saved");
      assert.equal((await get({})).updateBaseUrl, before);
    }
    // a URL derived from the app's own configured repo is accepted
    const src = await m.handlers.get("updates:source")({});
    if (src.coursesBaseUrl) {
      const res = await set({}, { updateBaseUrl: src.coursesBaseUrl });
      assert.equal(res.updateBaseUrl, src.coursesBaseUrl);
    }
  } finally {
    m.restore();
  }
});