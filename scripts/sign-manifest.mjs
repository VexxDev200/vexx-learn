/**
 * Sign the OTA manifest locally with the maintainer's Ed25519 private key.
 *
 *   node scripts/sign-manifest.mjs [path/to/manifest.json]      (default: release/updates/manifest.json)
 *   node scripts/sign-manifest.mjs --check [path/to/manifest.json]   (verify only, no key needed)
 *
 * Private key path: env VEXX_OTA_PRIVATE_KEY, else <home>/keys/vexx-learn-ota-private.pem.
 * The key is read only to sign; it is never printed. The result is verified against the public key
 * embedded in the app (electron/ota-public-key.mjs) before the file is written, so a wrong key
 * can never produce a manifest that clients would reject.
 * This script publishes nothing. Re-run it after EVERY change to the manifest.
 */
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { homedir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

import { OTA_PUBLIC_KEY_PEM } from "../electron/ota-public-key.mjs";
import { publicKeyFingerprint, signManifest, verifyManifestSignature } from "../electron/manifest-verify.mjs";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");

export function defaultPrivateKeyPath() {
  return process.env.VEXX_OTA_PRIVATE_KEY || join(homedir(), "keys", "vexx-learn-ota-private.pem");
}

export function defaultManifestPath() {
  return join(ROOT, "release", "updates", "manifest.json");
}

/** Signs the manifest file in place. Throws on any problem (nothing is written in that case). */
export function signManifestFile(manifestPath = defaultManifestPath(), keyPath = defaultPrivateKeyPath(), publicKeyPem = OTA_PUBLIC_KEY_PEM) {
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

export function checkManifestFile(manifestPath = defaultManifestPath(), publicKeyPem = OTA_PUBLIC_KEY_PEM) {
  const manifest = JSON.parse(readFileSync(manifestPath, "utf8"));
  return verifyManifestSignature(manifest, publicKeyPem);
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  const args = process.argv.slice(2);
  const checkOnly = args.includes("--check");
  const file = args.find((a) => !a.startsWith("--")) || defaultManifestPath();
  try {
    if (checkOnly) {
      const r = checkManifestFile(file);
      console.log(`manifest signature: ${r.status}${r.reason ? " (" + r.reason + ")" : ""}`);
      process.exit(r.status === "valid" ? 0 : 1);
    }
    const r = signManifestFile(file);
    console.log(`Signed ${r.manifestPath}`);
    console.log(`keyId: ${r.keyId}  public key sha256: ${r.fingerprint}`);
  } catch (e) {
    console.error("sign-manifest failed:", e.message);
    process.exit(1);
  }
}