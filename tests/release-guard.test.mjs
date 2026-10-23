import test from "node:test";
import assert from "node:assert/strict";
import { createHash, generateKeyPairSync } from "node:crypto";
import { cpSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawnSync } from "node:child_process";
import { signManifest } from "../electron/manifest-verify.mjs";
import { verifyReleaseExe } from "../scripts/release-guard.mjs";

const sha = (b) => createHash("sha256").update(b).digest("hex");
const REAL_MANIFEST = "release/updates/manifest.json";
const realHash = () => sha(readFileSync(REAL_MANIFEST));

function keys() {
  const { publicKey, privateKey } = generateKeyPairSync("ed25519");
  return {
    pub: publicKey.export({ type: "spki", format: "pem" }).toString(),
    priv: privateKey.export({ type: "pkcs8", format: "pem" }).toString(),
  };
}
const K = keys();
const OTHER = keys();
const EXE = Buffer.from("the-built-portable-exe");

function layout(manifestFields, { sign = true, key = K.priv, exe = EXE } = {}) {
  const dir = mkdtempSync(join(tmpdir(), "vexx-guard-"));
  const manifestPath = join(dir, "manifest.json");
  const exePath = join(dir, "Vexx-Learn-Portable.exe");
  let manifest = { coursesVersion: "1", appVersion: "9.9.9", uiBundle: null, tracks: [], ...manifestFields };
  if (sign) manifest = signManifest(manifest, key);
  writeFileSync(manifestPath, JSON.stringify(manifest));
  if (exe) writeFileSync(exePath, exe);
  return { dir, manifestPath, exePath };
}

test("guard: signed manifest + exe whose sha256 equals portableSha256 -> allowed", () => {
  const l = layout({ portableSha256: sha(EXE) });
  const r = verifyReleaseExe({ ...l, appVersion: "9.9.9", publicKeyPem: K.pub });
  assert.equal(r.ok, true);
  assert.equal(r.sha256, sha(EXE));
  rmSync(l.dir, { recursive: true, force: true });
});

test("guard: exe differs from the one in the signed manifest (rebuilt/swapped) -> refused", () => {
  const l = layout({ portableSha256: sha(EXE) }, { exe: Buffer.from("a different build") });
  const r = verifyReleaseExe({ ...l, publicKeyPem: K.pub });
  assert.equal(r.ok, false);
  assert.match(r.reason, /!= portableSha256/);
  rmSync(l.dir, { recursive: true, force: true });
});

test("guard: unsigned manifest -> refused (even if the hash matches)", () => {
  const l = layout({ portableSha256: sha(EXE) }, { sign: false });
  const r = verifyReleaseExe({ ...l, publicKeyPem: K.pub });
  assert.equal(r.ok, false);
  assert.match(r.reason, /unsigned/);
  rmSync(l.dir, { recursive: true, force: true });
});

test("guard: signature by a foreign key, or manifest edited after signing -> refused", () => {
  const foreign = layout({ portableSha256: sha(EXE) }, { key: OTHER.priv });
  assert.match(verifyReleaseExe({ ...foreign, publicKeyPem: K.pub }).reason, /invalid/);
  const l = layout({ portableSha256: sha(EXE) });
  const m = JSON.parse(readFileSync(l.manifestPath, "utf8"));
  m.portableSha256 = sha(Buffer.from("evil"));
  writeFileSync(l.manifestPath, JSON.stringify(m));
  assert.equal(verifyReleaseExe({ ...l, publicKeyPem: K.pub }).ok, false);
  rmSync(foreign.dir, { recursive: true, force: true });
  rmSync(l.dir, { recursive: true, force: true });
});

test("guard: signed manifest without portableSha256 (missing / null / malformed) -> refused", () => {
  for (const fields of [{}, { portableSha256: null }, { portableSha256: "nothex" }]) {
    const l = layout(fields);
    const r = verifyReleaseExe({ ...l, publicKeyPem: K.pub });
    assert.equal(r.ok, false);
    assert.match(r.reason, /no portableSha256/);
    rmSync(l.dir, { recursive: true, force: true });
  }
});

test("guard: missing exe, missing manifest and version mismatch -> refused", () => {
  const noExe = layout({ portableSha256: sha(EXE) }, { exe: null });
  assert.match(verifyReleaseExe({ ...noExe, publicKeyPem: K.pub }).reason, /exe not found/);
  assert.match(verifyReleaseExe({ manifestPath: join(noExe.dir, "nope.json"), exePath: noExe.exePath, publicKeyPem: K.pub }).reason, /manifest not found/);
  const l = layout({ portableSha256: sha(EXE) });
  assert.match(verifyReleaseExe({ ...l, appVersion: "1.0.0", publicKeyPem: K.pub }).reason, /appVersion/);
  rmSync(noExe.dir, { recursive: true, force: true });
  rmSync(l.dir, { recursive: true, force: true });
});

test("gh-release.mjs: refuses (exit 1, 'REFUSING') BEFORE any gh call on unsigned / mismatching exe; passes the guard when all matches", () => {
  const before = realHash();
  const root = mkdtempSync(join(tmpdir(), "vexx-ghrel-"));
  mkdirSync(join(root, "scripts"));
  mkdirSync(join(root, "electron"));
  mkdirSync(join(root, "release", "updates"), { recursive: true });
  for (const f of ["gh-release.mjs", "release-guard.mjs"]) cpSync(join("scripts", f), join(root, "scripts", f));
  cpSync("electron/manifest-verify.mjs", join(root, "electron", "manifest-verify.mjs"));
  writeFileSync(join(root, "electron", "ota-public-key.mjs"), `export const OTA_PUBLIC_KEY_PEM = ${JSON.stringify(K.pub)};\nexport const REQUIRE_SIGNED_MANIFEST = false;\n`);
  writeFileSync(join(root, "package.json"), JSON.stringify({ name: "x", version: "9.9.9", type: "module" }));
  writeFileSync(join(root, "update.config.json"), JSON.stringify({ githubOwner: "o", githubRepo: "r" }));
  const empty = join(root, "empty-path");
  mkdirSync(empty);
  const env = Object.fromEntries(Object.entries(process.env).filter(([k]) => !/^path$/i.test(k)));
  env.PATH = empty; // no `gh` can be found, so nothing can ever be published from a test
  const run = () => spawnSync(process.execPath, ["scripts/gh-release.mjs"], { cwd: root, encoding: "utf8", env });
  const put = (manifest, exe) => {
    writeFileSync(join(root, "release", "updates", "manifest.json"), JSON.stringify(manifest));
    writeFileSync(join(root, "release", "Vexx-Learn-Portable.exe"), exe);
  };
  const base = { coursesVersion: "1", appVersion: "9.9.9", uiBundle: null, tracks: [], portableSha256: sha(EXE) };

  put(base, EXE); // unsigned
  let r = run();
  assert.equal(r.status, 1);
  assert.match(r.stderr, /REFUSING to publish/);
  assert.doesNotMatch(r.stdout + r.stderr, /Created release|Uploaded/);

  put(signManifest(base, K.priv), Buffer.from("other exe")); // hash mismatch
  r = run();
  assert.equal(r.status, 1);
  assert.match(r.stderr, /REFUSING to publish/);

  put(signManifest(base, K.priv), EXE); // all matches: guard passes, then gh (absent) fails -> still exit 1 but not a refusal
  r = run();
  assert.match(r.stdout, /matches the signed manifest/);
  assert.doesNotMatch(r.stderr, /REFUSING/);
  assert.equal(r.status, 1);

  rmSync(root, { recursive: true, force: true });
  assert.equal(realHash(), before, "real manifest untouched");
});

test("release.yml: no exe build/upload, read-only permissions, no secrets, runs sign-manifest --check", () => {
  const y = readFileSync(".github/workflows/release.yml", "utf8");
  const code = y.split("\n").filter((l) => !l.trim().startsWith("#")).join("\n");
  assert.match(code, /permissions:\s*\n\s*contents: read/);
  assert.doesNotMatch(code, /contents: write/);
  assert.doesNotMatch(code, /softprops|action-gh-release|electron-builder|npm run build|pack:updates|upload/i);
  assert.doesNotMatch(code, /secrets\./);
  assert.match(code, /node scripts\/sign-manifest\.mjs --check release\/updates\/manifest\.json/);
});