import test from "node:test";
import assert from "node:assert/strict";
import { createHash, generateKeyPairSync } from "node:crypto";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { spawnSync } from "node:child_process";
import { join } from "node:path";
import { checkAndApplyUpdates } from "../electron/update.mjs";
import { OTA_PUBLIC_KEY_PEM, REQUIRE_SIGNED_MANIFEST } from "../electron/ota-public-key.mjs";
import { canonicalize, publicKeyFingerprint, signManifest, verifyManifestSignature } from "../electron/manifest-verify.mjs";
import { checkManifestFile, checkManifestFiles, signManifestFile } from "../scripts/sign-manifest.mjs";

const OWNER = "test-owner";
const REPO = "test-repo";
const TRACKS = ["python", "java", "cpp", "csharp", "security"];

function newKeys() {
  const { publicKey, privateKey } = generateKeyPairSync("ed25519");
  return {
    pub: publicKey.export({ type: "spki", format: "pem" }),
    priv: privateKey.export({ type: "pkcs8", format: "pem" }),
  };
}
const KEYS_A = newKeys();
const KEYS_B = newKeys();

const sha = (buf) => createHash("sha256").update(buf).digest("hex");
const trackBody = (t) => Buffer.from(JSON.stringify({ track: t, lessons: [] }));

function makeEnv() {
  const base = mkdtempSync(join(tmpdir(), "vexx-sig-test-"));
  const appRoot = join(base, "app");
  const userData = join(base, "userData");
  mkdirSync(appRoot, { recursive: true });
  mkdirSync(userData, { recursive: true });
  writeFileSync(join(appRoot, "update.config.json"), JSON.stringify({ githubOwner: OWNER, githubRepo: REPO }));
  return { appRoot, userData };
}

/** A plain (unsigned) courses manifest with correct hashes. */
function baseManifest(extra = {}) {
  const files = {};
  const sha256 = {};
  for (const t of TRACKS) {
    files[t] = `${t}.json`;
    sha256[t] = sha(trackBody(t));
  }
  return { coursesVersion: 5, appVersion: null, files, sha256, ...extra };
}

function mockFetch(manifest, extraFiles = {}) {
  const real = globalThis.fetch;
  globalThis.fetch = async (url) => {
    const u = String(url);
    if (u.includes("/manifest.json")) return new Response(JSON.stringify(manifest), { status: 200 });
    for (const t of TRACKS) if (u.endsWith(`/${t}.json`)) return new Response(trackBody(t), { status: 200 });
    for (const [name, body] of Object.entries(extraFiles)) if (u.endsWith(`/${name}`)) return new Response(body, { status: 200 });
    return new Response("not found", { status: 404 });
  };
  return () => { globalThis.fetch = real; };
}

async function run(manifest, opts = {}, extraFiles = {}) {
  const { appRoot, userData } = makeEnv();
  const restore = mockFetch(manifest, extraFiles);
  const warnings = [];
  const realWarn = console.warn;
  console.warn = (...a) => warnings.push(a.join(" "));
  try {
    const res = await checkAndApplyUpdates({ appRoot, userData, settings: {}, appVersion: "0.2.11", ...opts });
    return { res, warnings, userData };
  } finally {
    console.warn = realWarn;
    restore();
  }
}

test("strict mode is OFF by default (0.2.11 clients do not verify signatures)", () => {
  assert.equal(REQUIRE_SIGNED_MANIFEST, false);
  assert.match(OTA_PUBLIC_KEY_PEM, /BEGIN PUBLIC KEY/);
  assert.match(publicKeyFingerprint(OTA_PUBLIC_KEY_PEM), /^[0-9a-f]{64}$/);
});

test("canonicalize is independent of key order and ignores nothing else", () => {
  assert.equal(canonicalize({ b: 1, a: { d: [3, { y: 1, x: 2 }], c: null } }), '{"a":{"c":null,"d":[3,{"x":2,"y":1}]},"b":1}');
});

test("SIGNED manifest with the correct key passes and courses are applied", async () => {
  const signed = signManifest(baseManifest(), KEYS_A.priv);
  const { res, warnings, userData } = await run(signed, { otaPublicKeyPem: KEYS_A.pub });
  assert.equal(res.error, null, "no error: " + res.error);
  assert.equal(res.manifestSignature, "valid");
  assert.equal(res.coursesUpdated, true);
  assert.ok(existsSync(join(userData, "courses-cache")));
  assert.equal(warnings.filter((w) => /not signed/i.test(w)).length, 0);
});

test("TAMPERED signed manifest is rejected (nothing applied)", async () => {
  const signed = signManifest(baseManifest(), KEYS_A.priv);
  const tampered = { ...signed, coursesVersion: 6 };
  const { res, userData } = await run(tampered, { otaPublicKeyPem: KEYS_A.pub });
  assert.equal(res.manifestSignature, "invalid");
  assert.match(String(res.error), /signature invalid/i);
  assert.equal(res.coursesUpdated, false);
  assert.equal(existsSync(join(userData, "courses-cache", "python.json")), false);

  // swapping a hash (attacker serves own file + own hash) is also caught
  const evil = { ...signed, sha256: { ...signed.sha256, python: sha(Buffer.from("evil")) } };
  const r2 = await run(evil, { otaPublicKeyPem: KEYS_A.pub });
  assert.match(String(r2.res.error), /signature invalid/i);

  // stripped-down signature object is invalid, not "unsigned"
  const r3 = await run({ ...signed, signature: { alg: "ed25519" } }, { otaPublicKeyPem: KEYS_A.pub });
  assert.equal(r3.res.manifestSignature, "invalid");
});

test("manifest signed with a WRONG key is rejected (injected key and the real embedded key)", async () => {
  const signedByB = signManifest(baseManifest(), KEYS_B.priv);
  const r1 = await run(signedByB, { otaPublicKeyPem: KEYS_A.pub });
  assert.match(String(r1.res.error), /signature invalid/i);
  assert.equal(r1.res.coursesUpdated, false);

  // default (embedded) key: a signature from any other key must not pass
  const r2 = await run(signedByB, {});
  assert.equal(r2.res.manifestSignature, "invalid");
  assert.equal(r2.res.coursesUpdated, false);

  // same keyId forged onto a different key's signature value
  const forged = { ...signedByB, signature: { ...signedByB.signature, keyId: signManifest({}, KEYS_A.priv).signature.keyId } };
  const r3 = await run(forged, { otaPublicKeyPem: KEYS_A.pub });
  assert.equal(r3.res.manifestSignature, "invalid");
});

test("UNSIGNED manifest is accepted with a warning (strict off) and refused when strict is on", async () => {
  const { res, warnings } = await run(baseManifest(), { otaPublicKeyPem: KEYS_A.pub });
  assert.equal(res.error, null, "no error: " + res.error);
  assert.equal(res.manifestSignature, "unsigned");
  assert.equal(res.coursesUpdated, true);
  assert.ok(warnings.some((w) => /not signed/i.test(w)), "warning logged");

  const strict = await run(baseManifest(), { otaPublicKeyPem: KEYS_A.pub, requireSignedManifest: true });
  assert.match(String(strict.res.error), /not signed/i);
  assert.equal(strict.res.coursesUpdated, false);
});

test("file hash is mandatory when the manifest carries one (signed or not)", async () => {
  const bad = baseManifest();
  bad.sha256.java = "0".repeat(64);
  const unsigned = await run(bad, { otaPublicKeyPem: KEYS_A.pub });
  assert.match(String(unsigned.res.error), /Checksum mismatch for java/);
  assert.equal(unsigned.res.coursesUpdated, false);

  const signedBad = await run(signManifest(bad, KEYS_A.priv), { otaPublicKeyPem: KEYS_A.pub });
  assert.match(String(signedBad.res.error), /Checksum mismatch for java/);

  // a SIGNED manifest must not omit a hash for a file we are about to install
  const noHash = baseManifest();
  delete noHash.sha256.cpp;
  const r = await run(signManifest(noHash, KEYS_A.priv), { otaPublicKeyPem: KEYS_A.pub });
  assert.match(String(r.res.error), /no checksum for cpp/);
});

test("UI bundle: hash mismatch is rejected before anything is extracted", async () => {
  const zip = Buffer.from("not-really-a-zip");
  const m = baseManifest({ coursesVersion: 0, appVersion: "9.9.9", uiBundle: "app-ui.zip" });
  m.sha256.uiBundle = "0".repeat(64);
  const r = await run(m, { otaPublicKeyPem: KEYS_A.pub }, { "app-ui.zip": zip });
  assert.match(String(r.res.error), /UI bundle checksum mismatch/);
  assert.equal(r.res.uiUpdated, false);
  assert.equal(existsSync(join(r.userData, "app-ui", "active.json")), false);

  const m2 = baseManifest({ coursesVersion: 0, appVersion: "9.9.9", uiBundle: "app-ui.zip" });
  const r2 = await run(signManifest(m2, KEYS_A.priv), { otaPublicKeyPem: KEYS_A.pub }, { "app-ui.zip": zip });
  assert.match(String(r2.res.error), /no checksum for the UI bundle/);
});

test("sign-manifest script: signs a file, result verifies, wrong embedded key is refused", () => {
  const dir = mkdtempSync(join(tmpdir(), "vexx-signscript-"));
  const manifestPath = join(dir, "manifest.json");
  const keyPath = join(dir, "k.pem");
  writeFileSync(keyPath, KEYS_A.priv);
  writeFileSync(manifestPath, JSON.stringify(baseManifest(), null, 2));

  assert.equal(checkManifestFile(manifestPath, KEYS_A.pub).status, "unsigned");
  const out = signManifestFile(manifestPath, keyPath, KEYS_A.pub);
  assert.equal(out.fingerprint, publicKeyFingerprint(KEYS_A.pub));
  assert.equal(checkManifestFile(manifestPath, KEYS_A.pub).status, "valid");
  assert.equal(checkManifestFile(manifestPath, KEYS_B.pub).status, "invalid");
  // re-signing after an edit works and the previous signature is replaced
  const edited = JSON.parse(readFileSync(manifestPath, "utf8"));
  edited.coursesVersion = 9;
  writeFileSync(manifestPath, JSON.stringify(edited));
  assert.equal(checkManifestFile(manifestPath, KEYS_A.pub).status, "invalid");
  signManifestFile(manifestPath, keyPath, KEYS_A.pub);
  assert.equal(checkManifestFile(manifestPath, KEYS_A.pub).status, "valid");

  // private key that does not match the embedded/expected public key -> nothing written
  const before = readFileSync(manifestPath, "utf8");
  assert.throws(() => signManifestFile(manifestPath, keyPath, KEYS_B.pub), /does not verify/);
  assert.equal(readFileSync(manifestPath, "utf8"), before);
});

test("verifyManifestSignature rejects non-object manifests", () => {
  for (const bad of [null, "x", 5, []]) assert.equal(verifyManifestSignature(bad, KEYS_A.pub).status, "invalid");
});
test("CLI --check (what CI runs): fails on an unsigned manifest, passes on a signed one", () => {
  const dir = mkdtempSync(join(tmpdir(), "vexx-cli-check-"));
  const manifestPath = join(dir, "manifest.json");
  const keyPath = join(dir, "k.pem");
  const pubPath = join(dir, "pub.pem");
  writeFileSync(keyPath, KEYS_A.priv);
  writeFileSync(pubPath, KEYS_A.pub);
  writeFileSync(manifestPath, JSON.stringify(baseManifest(), null, 2));
  for (const t of TRACKS) writeFileSync(join(dir, `${t}.json`), trackBody(t)); // files next to the manifest, as in release/updates
  const cli = (...args) => spawnSync(process.execPath, ["scripts/sign-manifest.mjs", "--check", ...args], { encoding: "utf8" });

  const unsigned = cli(manifestPath, "--pubkey", pubPath);
  assert.equal(unsigned.status, 1, "unsigned -> exit 1");
  assert.match(unsigned.stdout, /unsigned/);
  // also fails against the REAL embedded key (what CI uses)
  assert.equal(cli(manifestPath).status, 1);

  signManifestFile(manifestPath, keyPath, KEYS_A.pub);
  const ok = cli(manifestPath, "--pubkey", pubPath);
  assert.equal(ok.status, 0, "signed -> exit 0");
  assert.match(ok.stdout, /valid/);
  // signed by A, embedded key is different -> invalid, exit 1
  assert.equal(cli(manifestPath).status, 1);
  // tampered after signing -> exit 1
  const m = JSON.parse(readFileSync(manifestPath, "utf8"));
  m.coursesVersion = 99;
  writeFileSync(manifestPath, JSON.stringify(m));
  assert.equal(cli(manifestPath, "--pubkey", pubPath).status, 1);
});
function makeRelease({ exe = false } = {}) {
  const dir = mkdtempSync(join(tmpdir(), "vexx-rel-"));
  const manifest = baseManifest({ uiBundle: "app-ui.zip", portableAssetName: "Vexx-Learn-Portable.exe", portableSha256: null });
  for (const t of TRACKS) writeFileSync(join(dir, `${t}.json`), trackBody(t));
  const zip = Buffer.from("PK-fake-zip-bytes");
  writeFileSync(join(dir, "app-ui.zip"), zip);
  manifest.sha256.uiBundle = sha(zip);
  const exeBytes = Buffer.from("fake-exe");
  if (exe) manifest.portableSha256 = sha(exeBytes);
  const keyPath = join(dir, "k.pem");
  const pubPath = join(dir, "pub.pem");
  const manifestPath = join(dir, "manifest.json");
  writeFileSync(keyPath, KEYS_A.priv);
  writeFileSync(pubPath, KEYS_A.pub);
  writeFileSync(manifestPath, JSON.stringify(manifest, null, 2));
  signManifestFile(manifestPath, keyPath, KEYS_A.pub);
  const cli = (...extra) =>
    spawnSync(process.execPath, ["scripts/sign-manifest.mjs", "--check", manifestPath, "--pubkey", pubPath, ...extra], { encoding: "utf8" });
  return { dir, manifestPath, cli, exeBytes };
}

test("CLI --check also re-hashes files next to the manifest: good release passes", () => {
  const r = makeRelease();
  const out = r.cli();
  assert.equal(out.status, 0, out.stdout);
  assert.match(out.stdout, /files: ok \(6 verified\)/);
});

test("CLI --check fails on a SUBSTITUTED app-ui.zip even though the manifest signature is still valid", () => {
  const r = makeRelease();
  writeFileSync(join(r.dir, "app-ui.zip"), Buffer.from("PK-evil-zip"));
  const out = r.cli();
  assert.equal(out.status, 1);
  assert.match(out.stdout, /signature: valid/);
  assert.match(out.stdout, /UI bundle: sha256 of app-ui\.zip does not match/);
});

test("CLI --check fails on a substituted course file, a missing file, and a missing hash", () => {
  let r = makeRelease();
  writeFileSync(join(r.dir, "python.json"), "{}");
  assert.match(r.cli().stdout, /course python: sha256 of python\.json does not match/);
  assert.equal(r.cli().status, 1);

  r = makeRelease();
  rmSync(join(r.dir, "java.json"));
  assert.match(r.cli().stdout, /course java: file java\.json is missing/);
  assert.equal(r.cli().status, 1);

  // removing a hash from the manifest invalidates the signature AND would be flagged by the file check
  r = makeRelease();
  const m = JSON.parse(readFileSync(r.manifestPath, "utf8"));
  delete m.sha256.cpp;
  writeFileSync(r.manifestPath, JSON.stringify(m));
  const out = r.cli();
  assert.equal(out.status, 1);
  assert.match(out.stdout, /no sha256 recorded/);
});

test("CLI --check: exe is checked only when portableSha256 is set; absent exe is skipped, wrong exe fails", () => {
  const none = makeRelease();
  assert.equal(none.cli().status, 0, "portableSha256 null -> exe ignored");

  const r = makeRelease({ exe: true });
  const skipped = r.cli();
  assert.equal(skipped.status, 0, skipped.stdout);
  assert.match(skipped.stdout, /skipped.*portable exe/);

  const exePath = join(r.dir, "x.exe");
  writeFileSync(exePath, r.exeBytes);
  assert.equal(r.cli("--exe", exePath).status, 0);
  writeFileSync(exePath, Buffer.from("tampered-exe"));
  const bad = r.cli("--exe", exePath);
  assert.equal(bad.status, 1);
  assert.match(bad.stdout, /portable exe: sha256 does not match/);
});

test("checkManifestFiles rejects path traversal in file names", () => {
  const r = makeRelease();
  const m = JSON.parse(readFileSync(r.manifestPath, "utf8"));
  m.files.python = "../python.json";
  writeFileSync(r.manifestPath, JSON.stringify(m));
  const res = checkManifestFiles(r.manifestPath);
  assert.equal(res.ok, false);
  assert.match(res.problems.join("\n"), /unsafe file name/);
});
const REAL_MANIFEST = "release/updates/manifest.json";
const realManifestHash = () => sha(readFileSync(REAL_MANIFEST));

test("sign-manifest CLI refuses to run without an explicit manifest path or with unknown flags (exit 2, nothing signed)", () => {
  const before = realManifestHash();
  const run = (...args) => spawnSync(process.execPath, ["scripts/sign-manifest.mjs", ...args], { encoding: "utf8" });
  const dir = mkdtempSync(join(tmpdir(), "vexx-cli-strict-"));
  const mp = join(dir, "manifest.json");
  writeFileSync(mp, JSON.stringify(baseManifest()));
  const mpBefore = readFileSync(mp, "utf8");
  const pubPath = join(dir, "pub.pem");
  writeFileSync(pubPath, KEYS_A.pub);

  const bad = [
    [],                                   // no path: must NOT default to release/updates/manifest.json
    ["--check"],                          // check without path
    ["--sign", mp],                       // unknown flag (sign mode)
    ["--check", "--bogus", mp],           // unknown flag (check mode)
    ["-x", mp],                           // unknown short flag
    [mp, mp + ".other"],                  // two paths
    ["--check", mp, "--pubkey"],          // flag without value
    [mp, "--pubkey", pubPath],            // --pubkey without --check
  ];
  for (const args of bad) {
    const r = run(...args);
    assert.equal(r.status, 2, `args ${JSON.stringify(args.map((a) => a.replace(dir, "<tmp>")))} -> exit ${r.status}: ${r.stderr}`);
    assert.match(r.stderr, /sign-manifest:/);
  }
  assert.equal(readFileSync(mp, "utf8"), mpBefore, "temp manifest untouched");
  assert.equal(realManifestHash(), before, "real release/updates/manifest.json untouched");
});

test("sign-manifest CLI: explicit path signs ONLY that file (private key from env, real manifest untouched)", () => {
  const before = realManifestHash();
  const dir = mkdtempSync(join(tmpdir(), "vexx-cli-explicit-"));
  const mp = join(dir, "manifest.json");
  const keyPath = join(dir, "k.pem");
  writeFileSync(keyPath, KEYS_A.priv);
  writeFileSync(mp, JSON.stringify(baseManifest()));
  // the embedded key differs from KEYS_A, so signing is refused (wrong key) and the file stays unchanged
  const r = spawnSync(process.execPath, ["scripts/sign-manifest.mjs", mp], {
    encoding: "utf8",
    env: { ...process.env, VEXX_OTA_PRIVATE_KEY: keyPath },
  });
  assert.equal(r.status, 1);
  assert.match(r.stderr, /does not verify/);
  assert.equal(JSON.parse(readFileSync(mp, "utf8")).signature, undefined);
  assert.equal(realManifestHash(), before);
});

test("pack-updates.mjs --sign still works end to end (explicit path), in a throw-away copy of the repo layout", () => {
  const before = realManifestHash();
  const root = mkdtempSync(join(tmpdir(), "vexx-pack-"));
  for (const sub of ["scripts", "electron"]) mkdirSync(join(root, sub), { recursive: true });
  for (const f of ["scripts/pack-updates.mjs", "scripts/sign-manifest.mjs"]) writeFileSync(join(root, f), readFileSync(f));
  for (const f of ["manifest-verify.mjs", "update-config.mjs", "ota-public-key.mjs"]) writeFileSync(join(root, "electron", f), readFileSync(join("electron", f)));
  // the copy trusts the TEST public key, so the real private key is never needed
  writeFileSync(join(root, "electron", "ota-public-key.mjs"), `export const OTA_PUBLIC_KEY_PEM = ${JSON.stringify(KEYS_A.pub)};\nexport const REQUIRE_SIGNED_MANIFEST = false;\n`);
  writeFileSync(join(root, "package.json"), JSON.stringify({ name: "x", version: "9.9.9" }));
  writeFileSync(join(root, "update.config.json"), JSON.stringify({ githubOwner: OWNER, githubRepo: REPO }));
  const data = join(root, "src", "content", "data");
  mkdirSync(data, { recursive: true });
  for (const t of TRACKS) writeFileSync(join(data, `${t}.json`), trackBody(t));
  writeFileSync(join(data, "bundle-manifest.json"), JSON.stringify({ coursesVersion: 7 }));
  const keyPath = join(root, "k.pem");
  writeFileSync(keyPath, KEYS_A.priv);
  const env = { ...process.env, VEXX_OTA_PRIVATE_KEY: keyPath };
  const exeBytes = Buffer.from("built-portable-exe");
  mkdirSync(join(root, "release"), { recursive: true });
  writeFileSync(join(root, "release", "Vexx-Learn-Portable.exe"), exeBytes);

  const plain = spawnSync(process.execPath, ["scripts/pack-updates.mjs"], { cwd: root, encoding: "utf8", env });
  assert.equal(plain.status, 0, plain.stderr);
  const m = join(root, "release", "updates", "manifest.json");
  assert.equal(JSON.parse(readFileSync(m, "utf8")).signature, undefined, "no --sign -> unsigned");

  const signed = spawnSync(process.execPath, ["scripts/pack-updates.mjs", "--sign"], { cwd: root, encoding: "utf8", env });
  assert.equal(signed.status, 0, signed.stderr + signed.stdout);
  const signedManifest = JSON.parse(readFileSync(m, "utf8"));
  assert.equal(signedManifest.signature.alg, "ed25519");
  assert.equal(signedManifest.portableSha256, sha(exeBytes), "exe hash filled from the built exe BEFORE signing, and covered by the signature");
  const chk = spawnSync(process.execPath, ["scripts/sign-manifest.mjs", "--check", m], { cwd: root, encoding: "utf8" });
  assert.equal(chk.status, 0, chk.stdout);
  assert.match(chk.stdout, /signature: valid/);
  assert.equal(realManifestHash(), before, "real manifest untouched");

  // no built exe: --sign is refused (previous signed manifest stays); --allow-no-exe opts out for courses/UI-only releases
  rmSync(join(root, "release", "Vexx-Learn-Portable.exe"));
  const refused = spawnSync(process.execPath, ["scripts/pack-updates.mjs", "--sign"], { cwd: root, encoding: "utf8", env });
  assert.equal(refused.status, 1);
  assert.match(refused.stderr, /Refusing to sign/);
  assert.ok(JSON.parse(readFileSync(m, "utf8")).signature, "previous signed manifest not clobbered by the refused run");
  const allowed = spawnSync(process.execPath, ["scripts/pack-updates.mjs", "--sign", "--allow-no-exe"], { cwd: root, encoding: "utf8", env });
  assert.equal(allowed.status, 0, allowed.stderr);
  const noExe = JSON.parse(readFileSync(m, "utf8"));
  assert.equal(noExe.portableSha256, null);
  assert.ok(noExe.signature);
  const chk2 = spawnSync(process.execPath, ["scripts/sign-manifest.mjs", "--check", m], { cwd: root, encoding: "utf8" });
  assert.equal(chk2.status, 0, chk2.stdout);
  assert.match(chk2.stdout, /no portableSha256/);
});

test("ship.mjs packs with --sign (local release flow produces a signed manifest incl. the exe hash)", () => {
  const src = readFileSync("scripts/ship.mjs", "utf8");
  assert.match(src, /pack-updates\.mjs",\s*"--sign"/);
});
