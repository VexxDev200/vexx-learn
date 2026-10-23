/**
 * Pre-upload guard for the portable exe (used by scripts/gh-release.mjs; kept free of side effects so it can be tested).
 *
 * The exe may only be attached to a GitHub Release if
 *   1. the manifest carries a VALID Ed25519 signature for the public key embedded in the app,
 *   2. the signed manifest has a portableSha256,
 *   3. sha256(exe) === portableSha256   (i.e. it is the SAME file the manifest was signed for),
 *   4. (optional) manifest.appVersion === the version being released.
 * Otherwise updated clients would refuse the exe (or, worse, we would publish something unrelated to the signature).
 */
import { createHash } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import { OTA_PUBLIC_KEY_PEM } from "../electron/ota-public-key.mjs";
import { verifyManifestSignature } from "../electron/manifest-verify.mjs";

/** @returns {{ok: true, sha256: string} | {ok: false, reason: string}} */
export function verifyReleaseExe({ manifestPath, exePath, appVersion, publicKeyPem = OTA_PUBLIC_KEY_PEM }) {
  if (!manifestPath || !existsSync(manifestPath)) return { ok: false, reason: `manifest not found: ${manifestPath}` };
  let manifest;
  try {
    manifest = JSON.parse(readFileSync(manifestPath, "utf8"));
  } catch (e) {
    return { ok: false, reason: `manifest is not valid JSON: ${e.message}` };
  }
  const sig = verifyManifestSignature(manifest, publicKeyPem);
  if (sig.status !== "valid") {
    return { ok: false, reason: `manifest signature is ${sig.status}${sig.reason ? " (" + sig.reason + ")" : ""}: run "npm run release:pack -- --sign"` };
  }
  const expected = typeof manifest.portableSha256 === "string" ? manifest.portableSha256.toLowerCase() : "";
  if (!/^[0-9a-f]{64}$/.test(expected)) {
    return { ok: false, reason: "signed manifest has no portableSha256: build the exe first, then run \"npm run release:pack -- --sign\"" };
  }
  if (appVersion !== undefined && manifest.appVersion !== appVersion) {
    return { ok: false, reason: `manifest.appVersion (${manifest.appVersion}) does not match the release version (${appVersion})` };
  }
  if (!exePath || !existsSync(exePath)) return { ok: false, reason: `exe not found: ${exePath}` };
  const actual = createHash("sha256").update(readFileSync(exePath)).digest("hex");
  if (actual !== expected) {
    return { ok: false, reason: `exe sha256 ${actual} != portableSha256 in the signed manifest ${expected}: upload the SAME exe that was packed, do not rebuild` };
  }
  return { ok: true, sha256: actual };
}