import test from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { existsSync, mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { checkAndApplyUpdates, loadPendingAppUpdate, savePendingAppUpdate } from "../electron/update.mjs";

const OWNER = "test-owner";
const REPO = "test-repo";
const EXE = Buffer.from("fake-portable-exe-bytes");
const EXE_SHA = createHash("sha256").update(EXE).digest("hex");
const EXE_URL = `https://github.com/${OWNER}/${REPO}/releases/download/v9.9.9/Vexx-Learn-Portable.exe`;

function makeEnv() {
  const base = mkdtempSync(join(tmpdir(), "vexx-update-test-"));
  const appRoot = join(base, "app");
  const userData = join(base, "userData");
  mkdirSync(appRoot, { recursive: true });
  mkdirSync(userData, { recursive: true });
  writeFileSync(join(appRoot, "update.config.json"), JSON.stringify({ githubOwner: OWNER, githubRepo: REPO }));
  return { appRoot, userData };
}

function mockFetch(manifest) {
  const real = globalThis.fetch;
  globalThis.fetch = async (url) => {
    const u = String(url);
    if (u.includes("/manifest.json")) return new Response(JSON.stringify(manifest), { status: 200 });
    if (u.startsWith("https://api.github.com/repos/")) {
      return new Response(
        JSON.stringify({
          tag_name: "v9.9.9",
          html_url: "https://github.com/x",
          assets: [{ name: "Vexx-Learn-Portable.exe", browser_download_url: EXE_URL }],
        }),
        { status: 200 }
      );
    }
    if (u === EXE_URL) return new Response(EXE, { status: 200 });
    return new Response("not found", { status: 404 });
  };
  return () => { globalThis.fetch = real; };
}

test("savePendingAppUpdate(userData, info) persists and loadPendingAppUpdate reads it back", () => {
  const { userData } = makeEnv();
  savePendingAppUpdate(userData, { version: "1.2.3", path: "x" });
  assert.equal(loadPendingAppUpdate(userData).version, "1.2.3");
});

test("portable exe update is saved as pending (no TypeError, no error)", async () => {
  const { appRoot, userData } = makeEnv();
  const restore = mockFetch({ coursesVersion: 0, appVersion: "9.9.9", files: {}, sha256: {}, portableSha256: EXE_SHA });
  try {
    const res = await checkAndApplyUpdates({ appRoot, userData, settings: {}, appVersion: "0.2.11" });
    assert.equal(res.error, null, "no error: " + res.error);
    assert.equal(res.appDownloaded, true);
    assert.ok(existsSync(join(userData, "pending-app-update.json")), "pending-app-update.json written");
    const pending = loadPendingAppUpdate(userData);
    assert.equal(pending.version, "9.9.9");
    assert.equal(pending.url, EXE_URL);
    assert.ok(existsSync(pending.path));
  } finally {
    restore();
  }
});

test("portable exe with wrong checksum is rejected and not saved as pending", async () => {
  const { appRoot, userData } = makeEnv();
  const restore = mockFetch({ coursesVersion: 0, appVersion: "9.9.9", files: {}, sha256: {}, portableSha256: "0".repeat(64) });
  try {
    const res = await checkAndApplyUpdates({ appRoot, userData, settings: {}, appVersion: "0.2.11" });
    assert.match(String(res.error), /checksum/i);
    assert.equal(loadPendingAppUpdate(userData), null);
  } finally {
    restore();
  }
});