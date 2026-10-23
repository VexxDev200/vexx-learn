import test from "node:test";
import assert from "node:assert/strict";
import { createHash, generateKeyPairSync } from "node:crypto";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { checkAndApplyUpdates } from "../electron/update.mjs";
import { OTA_PUBLIC_KEY_PEM, REQUIRE_SIGNED_MANIFEST } from "../electron/ota-public-key.mjs";
import { canonicalize, publicKeyFingerprint, signManifest, verifyManifestSignature } from "../electron/manifest-verify.mjs";
import { checkManifestFile, signManifestFile } from "../scripts/sign-manifest.mjs";

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