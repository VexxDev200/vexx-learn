import test from "node:test";
import assert from "node:assert/strict";
import { createHash, generateKeyPairSync } from "node:crypto";
import { existsSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  canOpenPath,
  checkAndApplyUpdates,
  loadPendingAppUpdate,
  pendingUpdatesDir,
  savePendingAppUpdate,
  verifyPendingAppUpdate,
} from "../electron/update.mjs";
import { signManifest } from "../electron/manifest-verify.mjs";
import { loadMain } from "./helpers/loadMain.mjs";

const OWNER = "test-owner";
const REPO = "test-repo";
const EXE = Buffer.from("genuine-portable-exe-bytes");
const EXE_SHA = createHash("sha256").update(EXE).digest("hex");
const GOOD_URL = `https://github.com/${OWNER}/${REPO}/releases/download/v9.9.9/Vexx-Learn-Portable.exe`;

const { publicKey, privateKey } = generateKeyPairSync("ed25519");
const PUB = publicKey.export({ type: "spki", format: "pem" });
const PRIV = privateKey.export({ type: "pkcs8", format: "pem" });

function makeEnv() {
  const base = mkdtempSync(join(tmpdir(), "vexx-s4-"));
  const appRoot = join(base, "app");
  const userData = join(base, "userData");
  mkdirSync(appRoot, { recursive: true });
  mkdirSync(userData, { recursive: true });
  writeFileSync(join(appRoot, "update.config.json"), JSON.stringify({ githubOwner: OWNER, githubRepo: REPO }));
  return { appRoot, userData };
}

/** opts: { url, tag, bytes, finalUrl } - what the fake GitHub API / CDN serve */
function mockFetch(manifest, opts = {}) {
  const real = globalThis.fetch;
  const calls = { exeDownloads: 0 };
  const url = opts.url ?? GOOD_URL;
  globalThis.fetch = async (u) => {
    const s = String(u);
    if (s.includes("/manifest.json")) return new Response(JSON.stringify(manifest), { status: 200 });
    if (s.startsWith("https://api.github.com/repos/")) {
      return new Response(
        JSON.stringify({
          tag_name: opts.tag ?? "v9.9.9",
          html_url: "https://github.com/x",
          assets: [{ name: "Vexx-Learn-Portable.exe", browser_download_url: url }],
        }),
        { status: 200 }
      );
    }
    if (s === url) {
      calls.exeDownloads++;
      const res = new Response(opts.bytes ?? EXE, { status: 200 });
      if (opts.finalUrl) Object.defineProperty(res, "url", { value: opts.finalUrl });
      return res;
    }
    return new Response("not found", { status: 404 });
  };
  return { calls, restore: () => { globalThis.fetch = real; } };
}

const baseManifest = (extra = {}) => ({ coursesVersion: 0, appVersion: "9.9.9", files: {}, sha256: {}, portableSha256: EXE_SHA, ...extra });
const signed = (m) => signManifest(m, PRIV);

async function run(manifest, opts = {}, runOpts = {}) {
  const env = makeEnv();
  const m = mockFetch(manifest, opts);
  const warnings = [];
  const realWarn = console.warn;
  console.warn = (...a) => warnings.push(a.join(" "));
  try {
    const res = await checkAndApplyUpdates({
      ...env,
      settings: {},
      appVersion: "0.2.11",
      otaPublicKeyPem: PUB,
      ...runOpts,
    });
    return { res, calls: m.calls, warnings, ...env };
  } finally {
    console.warn = realWarn;
    m.restore();
  }
}

const dirFiles = (userData) => (existsSync(pendingUpdatesDir(userData)) ? readdirSync(pendingUpdatesDir(userData)) : []);

test("signed manifest + correct portableSha256: exe downloaded, hash recorded, no .part left", async () => {
  const { res, userData } = await run(signed(baseManifest()));
  assert.equal(res.error, null, String(res.error));
  assert.equal(res.manifestSignature, "valid");
  assert.equal(res.appDownloaded, true);
  const pending = loadPendingAppUpdate(userData);
  assert.equal(pending.sha256, EXE_SHA);
  assert.equal(pending.size, EXE.length);
  assert.deepEqual(readFileSync(pending.path), EXE);
  assert.deepEqual(dirFiles(userData), ["Vexx-Learn-Portable-9.9.9.exe"]);
});

test("SIGNED manifest WITHOUT portableSha256 (missing or null): exe is NOT downloaded, no pending, no crash", async () => {
  for (const mk of [() => { const m = baseManifest(); delete m.portableSha256; return m; }, () => baseManifest({ portableSha256: null })]) {
    const { res, calls, userData, warnings } = await run(signed(mk()));
    assert.equal(res.error, null, String(res.error));
    assert.equal(res.appDownloaded, false);
    assert.equal(res.appDownloadSkipped, "no_portable_sha256");
    assert.equal(calls.exeDownloads, 0, "exe must not even be requested");
    assert.equal(loadPendingAppUpdate(userData), null);
    assert.deepEqual(dirFiles(userData), []);
    assert.ok(warnings.some((w) => /no portableSha256/.test(w)));
  }
});

test("strict mode also requires the exe hash", async () => {
  const { res } = await run(signed(baseManifest({ portableSha256: null })), {}, { requireSignedManifest: true });
  assert.equal(res.appDownloadSkipped, "no_portable_sha256");
});

test("UNSIGNED manifest without a hash keeps working (0.2.11-compatible flow), with a warning", async () => {
  const m = baseManifest();
  delete m.portableSha256;
  const { res, warnings, userData } = await run(m);
  assert.equal(res.error, null, String(res.error));
  assert.equal(res.appDownloaded, true);
  assert.ok(warnings.some((w) => /NOT be hash-verified/.test(w)));
  assert.equal(loadPendingAppUpdate(userData).sha256, null);
});

test("wrong checksum (unsigned or signed): exe deleted, no .part, no pending record", async () => {
  for (const mk of [(m) => m, signed]) {
    const { res, userData } = await run(mk(baseManifest({ portableSha256: "0".repeat(64) })));
    assert.match(String(res.error), /checksum/i);
    assert.equal(res.appDownloaded, false);
    assert.equal(loadPendingAppUpdate(userData), null);
    assert.deepEqual(dirFiles(userData), [], "nothing left behind");
  }
});

test("malformed portableSha256 is rejected", async () => {
  const { res, calls } = await run(baseManifest({ portableSha256: "nothex" }));
  assert.match(String(res.error), /malformed/);
  assert.equal(calls.exeDownloads, 0);
});

test("signed manifest: appVersion must match the release the hash belongs to", async () => {
  const { res, calls } = await run(signed(baseManifest()), { tag: "v9.9.10" });
  assert.equal(res.appDownloadSkipped, "version_mismatch");
  assert.equal(calls.exeDownloads, 0);
});

test("a pre-existing corrupted/planted exe is never reused when a hash is known: it is replaced", async () => {
  const env = makeEnv();
  mkdirSync(pendingUpdatesDir(env.userData), { recursive: true });
  const planted = join(pendingUpdatesDir(env.userData), "Vexx-Learn-Portable-9.9.9.exe");
  writeFileSync(planted, "planted-evil-bytes");
  savePendingAppUpdate(env.userData, { version: "9.9.9", path: planted, url: GOOD_URL, sha256: null });
  const m = mockFetch(signed(baseManifest()));
  try {
    const res = await checkAndApplyUpdates({ ...env, settings: {}, appVersion: "0.2.11", otaPublicKeyPem: PUB });
    assert.equal(res.error, null, String(res.error));
    assert.equal(m.calls.exeDownloads, 1, "re-downloaded");
    assert.deepEqual(readFileSync(planted), EXE, "planted file replaced with the genuine, verified exe");
    assert.equal(loadPendingAppUpdate(env.userData).sha256, EXE_SHA);
  } finally {
    m.restore();
  }
});

test("a good, already-verified exe is reused without another download", async () => {
  const env = makeEnv();
  const manifest = signed(baseManifest());
  let m = mockFetch(manifest);
  try {
    await checkAndApplyUpdates({ ...env, settings: {}, appVersion: "0.2.11", otaPublicKeyPem: PUB });
    assert.equal(m.calls.exeDownloads, 1);
  } finally { m.restore(); }
  m = mockFetch(manifest);
  try {
    const res = await checkAndApplyUpdates({ ...env, settings: {}, appVersion: "0.2.11", otaPublicKeyPem: PUB });
    assert.equal(res.appDownloaded, true);
    assert.equal(m.calls.exeDownloads, 0);
  } finally { m.restore(); }
});

test("release asset outside the configured repo, odd tag names, and off-GitHub redirects are all refused", async () => {
  const evil = await run(baseManifest(), { url: "https://github.com/attacker/other/releases/download/v9.9.9/x.exe" });
  assert.match(String(evil.res.error), /not inside the configured GitHub repository/);
  assert.equal(evil.calls.exeDownloads, 0);

  const tag = await run(baseManifest(), { tag: "v..\\..\\..\\evil" });
  assert.match(String(tag.res.error), /unexpected characters/);
  assert.equal(tag.calls.exeDownloads, 0);

  const redirect = await run(baseManifest(), { finalUrl: "https://evil.example/Vexx.exe" });
  assert.match(String(redirect.res.error), /non-GitHub host/);
  assert.deepEqual(dirFiles(redirect.userData), []);
  assert.equal(loadPendingAppUpdate(redirect.userData), null);

  const httpRedirect = await run(baseManifest(), { finalUrl: "http://objects.githubusercontent.com/x" });
  assert.match(String(httpRedirect.res.error), /non-GitHub host/);

  // a legitimate GitHub CDN redirect is fine
  const cdn = await run(baseManifest(), { finalUrl: "https://objects.githubusercontent.com/github-production-release-asset/abc" });
  assert.equal(cdn.res.error, null, String(cdn.res.error));
});

test("launch gate: exe tampered after download is deleted and cannot be opened", async () => {
  const { userData } = await run(signed(baseManifest()));
  const pending = loadPendingAppUpdate(userData);
  assert.equal(canOpenPath(userData, pending.path).ok, true);
  assert.ok(verifyPendingAppUpdate(userData));

  writeFileSync(pending.path, Buffer.alloc(EXE.length, 0x41)); // same size, different bytes
  const gate = canOpenPath(userData, pending.path);
  assert.equal(gate.ok, false);
  assert.equal(existsSync(pending.path), false, "tampered exe deleted");
  assert.equal(loadPendingAppUpdate(userData), null, "pending record cleared");
  assert.equal(verifyPendingAppUpdate(userData), null);
});

test("launch gate: other files in pending-updates are refused; files elsewhere are unaffected", async () => {
  const { userData } = await run(signed(baseManifest()));
  const stray = join(pendingUpdatesDir(userData), "Other.exe");
  writeFileSync(stray, "x");
  const g = canOpenPath(userData, stray);
  assert.equal(g.ok, false);
  assert.match(g.reason, /not the recorded pending update/);
  const elsewhere = join(userData, "notes.txt");
  writeFileSync(elsewhere, "x");
  assert.equal(canOpenPath(userData, elsewhere).ok, true);
});

test("IPC: updater:pending-app and shell:open-path enforce the hash (tamper -> null / blocked, genuine -> opens)", async () => {
  const m = await loadMain();
  try {
    const dir = pendingUpdatesDir(m.userData);
    mkdirSync(dir, { recursive: true });
    const exe = join(dir, "Vexx-Learn-Portable-9.9.9.exe");
    writeFileSync(exe, EXE);
    savePendingAppUpdate(m.userData, { version: "9.9.9", path: exe, url: GOOD_URL, sha256: EXE_SHA, size: EXE.length });

    const pendingApp = m.handlers.get("updater:pending-app");
    const openPath = m.handlers.get("shell:open-path");
    assert.equal((await pendingApp({})).version, "9.9.9");
    assert.equal(await openPath({}, exe), "");
    assert.deepEqual(m.shellCalls.openPath, [exe]);

    writeFileSync(exe, Buffer.alloc(EXE.length, 0x42));
    const r = await openPath({}, exe);
    assert.match(String(r), /blocked/);
    assert.deepEqual(m.shellCalls.openPath, [exe], "tampered exe never reached shell.openPath");
    assert.equal(await pendingApp({}), null);
    assert.equal(statSyncSafe(exe), false);
  } finally {
    m.restore();
  }
});

function statSyncSafe(p) {
  try { statSync(p); return true; } catch { return false; }
}