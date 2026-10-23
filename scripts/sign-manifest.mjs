/**
 * Sign the OTA manifest locally with the maintainer's Ed25519 private key.
 *
 *   node scripts/sign-manifest.mjs <path/to/manifest.json>           (sign in place)
 *   node scripts/sign-manifest.mjs --check <path/to/manifest.json>   (verify only, no key needed;
 *       exit code 1 if unsigned or invalid - used by CI. Also re-hashes the files next to the manifest
 *       (courses, UI bundle, and the exe if it is present and portableSha256 is set) and compares with the manifest. Optional: --pubkey <file> to verify against another public key, for tests)
 *
 * Private key path: env VEXX_OTA_PRIVATE_KEY, else <home>/keys/vexx-learn-ota-private.pem.
 * The key is read only to sign; it is never printed. The result is verified against the public key
 * embedded in the app (electron/ota-public-key.mjs) before the file is written, so a wrong key
 * can never produce a manifest that clients would reject.
 * The manifest path is ALWAYS required (no implicit default): a missing path or an unknown flag is an error
 * (exit 2), so nothing is ever signed by accident. This script publishes nothing. Re-run it after EVERY change to the manifest.
 */
import { createHash } from "node:crypto";
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { homedir } from "node:os";
import { basename, dirname, join, resolve } from "node:path";
import { pathToFileURL } from "node:url";

import { OTA_PUBLIC_KEY_PEM } from "../electron/ota-public-key.mjs";
import { publicKeyFingerprint, signManifest, verifyManifestSignature } from "../electron/manifest-verify.mjs";

export function defaultPrivateKeyPath() {
  return process.env.VEXX_OTA_PRIVATE_KEY || join(homedir(), "keys", "vexx-learn-ota-private.pem");
}

/** Signs the manifest file in place. Throws on any problem (nothing is written in that case). */
export function signManifestFile(manifestPath, keyPath = defaultPrivateKeyPath(), publicKeyPem = OTA_PUBLIC_KEY_PEM) {
  if (typeof manifestPath !== "string" || !manifestPath) throw new Error("manifest path is required");
  if (!existsSync(manifestPath)) throw new Error(`manifest not found: ${manifestPath}`);
  if (!existsSync(keyPath)) throw new Error(`private key not found: ${keyPath} (set VEXX_OTA_PRIVATE_KEY)`);
  const manifest = JSON.parse(readFileSync(manifestPath, "utf8"));
  const signed = signManifest(manifest, readFileSync(keyPath, "utf8"));
  const check = verifyManifestSignature(signed, publicKeyPem);
  if (check.status !== "valid") {
    throw new Error("signature does not verify with the public key embedded in the app: " + (check.reason || check.status));
  }
  writeFileSync(manifestPath, JSON.stringify(signed, null, 2));
  return { manifestPath, keyId: signed.signature.keyId, fingerprint: publicKeyFingerprint(publicKeyPem) };
}

export function checkManifestFile(manifestPath, publicKeyPem = OTA_PUBLIC_KEY_PEM) {
  const manifest = JSON.parse(readFileSync(manifestPath, "utf8"));
  return verifyManifestSignature(manifest, publicKeyPem);
}

/**
 * Compares sha256 of the files lying next to the manifest with the hashes recorded in it.
 * Rebuilds/changes nothing. Returns { ok, problems[], checked[], skipped[] }.
 * - every entry of manifest.files must have a hash and a file next to the manifest;
 * - manifest.uiBundle (if set) must have sha256.uiBundle (or sha256[name]) and the zip must exist;
 * - the portable exe is checked only if portableSha256 is set AND the exe file is found
 *   (exePath, or <manifestDir>/<portableAssetName>, or <manifestDir>/../<portableAssetName>); a missing exe is skipped.
 */
export function checkManifestFiles(manifestPath, { exePath } = {}) {
  const manifest = JSON.parse(readFileSync(manifestPath, "utf8"));
  const dir = dirname(resolve(manifestPath));
  const problems = [];
  const checked = [];
  const skipped = [];
  const sha = manifest.sha256 && typeof manifest.sha256 === "object" ? manifest.sha256 : {};
  const hashOf = (p) => createHash("sha256").update(readFileSync(p)).digest("hex");
  const verifyOne = (label, name, expected) => {
    if (typeof name !== "string" || !name || name !== basename(name) || name.includes("..")) {
      problems.push(`${label}: unsafe file name`);
      return;
    }
    if (typeof expected !== "string" || !/^[0-9a-f]{64}$/i.test(expected)) {
      problems.push(`${label}: no sha256 recorded in manifest for ${name}`);
      return;
    }
    const p = join(dir, name);
    if (!existsSync(p)) {
      problems.push(`${label}: file ${name} is missing next to the manifest`);
      return;
    }
    if (hashOf(p).toLowerCase() !== expected.toLowerCase()) problems.push(`${label}: sha256 of ${name} does not match the manifest`);
    else checked.push(name);
  };
  for (const [track, name] of Object.entries(manifest.files || {})) verifyOne(`course ${track}`, name, sha[track]);
  if (manifest.uiBundle) verifyOne("UI bundle", manifest.uiBundle, sha.uiBundle || sha[manifest.uiBundle]);
  if (manifest.portableSha256) {
    const asset = manifest.portableAssetName || "Vexx-Learn-Portable.exe";
    const candidates = [exePath, join(dir, basename(asset)), join(dir, "..", basename(asset))].filter(Boolean);
    const found = candidates.find((c) => existsSync(c));
    if (!found) skipped.push(`portable exe (${asset}) not present, hash not checked`);
    else if (hashOf(found).toLowerCase() !== String(manifest.portableSha256).toLowerCase()) problems.push("portable exe: sha256 does not match portableSha256");
    else checked.push(basename(found));
  }
  return { ok: problems.length === 0, problems, checked, skipped };
}

/**
 * Strict CLI parsing. Throws on: unknown flag, missing flag value, no/extra manifest path,
 * --pubkey/--exe without --check.
 */
export function parseCliArgs(args) {
  const out = { check: false, pubKeyFile: null, exeFile: null, file: null };
  const positional = [];
  for (let i = 0; i < args.length; i++) {
    const a = args[i];
    if (a === "--check") out.check = true;
    else if (a === "--pubkey" || a === "--exe") {
      const v = args[i + 1];
      if (v === undefined || v.startsWith("--")) throw new Error(`${a} needs a value`);
      if (a === "--pubkey") out.pubKeyFile = v;
      else out.exeFile = v;
      i++;
    } else if (a.startsWith("-")) throw new Error(`unknown flag: ${a}`);
    else positional.push(a);
  }
  if (positional.length === 0) throw new Error("explicit manifest path is required (e.g. release/updates/manifest.json)");
  if (positional.length > 1) throw new Error(`expected exactly one manifest path, got ${positional.length}`);
  if (!out.check && (out.pubKeyFile || out.exeFile)) throw new Error("--pubkey/--exe are only valid together with --check");
  out.file = positional[0];
  return out;
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  let opts;
  try {
    opts = parseCliArgs(process.argv.slice(2));
  } catch (e) {
    console.error("sign-manifest: " + e.message);
    console.error("usage: node scripts/sign-manifest.mjs [--check [--pubkey <pem>] [--exe <file>]] <manifest.json>");
    process.exit(2);
  }
  try {
    if (opts.check) {
      const r = checkManifestFile(opts.file, opts.pubKeyFile ? readFileSync(opts.pubKeyFile, "utf8") : OTA_PUBLIC_KEY_PEM);
      console.log(`manifest signature: ${r.status}${r.reason ? " (" + r.reason + ")" : ""}`);
      const f = checkManifestFiles(opts.file, { exePath: opts.exeFile });
      console.log(`files: ${f.ok ? "ok" : "FAILED"} (${f.checked.length} verified)`);
      for (const p of f.problems) console.log("  - " + p);
      for (const p of f.skipped) console.log("  (skipped) " + p);
      process.exit(r.status === "valid" && f.ok ? 0 : 1);
    }
    const r = signManifestFile(opts.file);
    console.log(`Signed ${r.manifestPath}`);
    console.log(`keyId: ${r.keyId}  public key sha256: ${r.fingerprint}`);
  } catch (e) {
    console.error("sign-manifest failed:", e.message);
    process.exit(1);
  }
}
