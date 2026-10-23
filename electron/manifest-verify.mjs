/**
 * OTA manifest signing (Ed25519).
 *
 * The signature covers the canonical JSON of the whole manifest EXCEPT the `signature` field itself:
 *   canonical = JSON with object keys sorted recursively, no whitespace.
 * Manifest field: "signature": { "alg": "ed25519", "keyId": "<first 16 hex of sha256(SPKI DER)>", "value": "<base64>" }
 *
 * Old clients (0.2.11) ignore the `signature` field, so signed manifests stay backwards compatible.
 */
import { createHash, createPrivateKey, createPublicKey, sign, verify } from "node:crypto";

export const SIGNATURE_ALG = "ed25519";

/** Deterministic JSON: keys sorted recursively, same output on signer and verifier. */
export function canonicalize(value) {
  if (value === null || typeof value !== "object") return JSON.stringify(value);
  if (Array.isArray(value)) return "[" + value.map((v) => canonicalize(v === undefined ? null : v)).join(",") + "]";
  const keys = Object.keys(value).filter((k) => value[k] !== undefined).sort();
  return "{" + keys.map((k) => JSON.stringify(k) + ":" + canonicalize(value[k])).join(",") + "}";
}

function manifestPayload(manifest) {
  const { signature: _ignored, ...rest } = manifest;
  return Buffer.from(canonicalize(rest), "utf8");
}

/** sha256 (hex) of the public key in SPKI DER form - the "fingerprint" shown to humans. */
export function publicKeyFingerprint(publicKeyPem) {
  const der = createPublicKey(publicKeyPem).export({ type: "spki", format: "der" });
  return createHash("sha256").update(der).digest("hex");
}

export function publicKeyId(publicKeyPem) {
  return publicKeyFingerprint(publicKeyPem).slice(0, 16);
}

/** Returns a copy of the manifest with a fresh `signature` field. */
export function signManifest(manifest, privateKeyPem) {
  const priv = createPrivateKey(privateKeyPem);
  const pubPem = createPublicKey(priv).export({ type: "spki", format: "pem" });
  const { signature: _old, ...rest } = manifest;
  const value = sign(null, manifestPayload(rest), priv).toString("base64");
  return { ...rest, signature: { alg: SIGNATURE_ALG, keyId: publicKeyId(pubPem), value } };
}

/**
 * @returns {{status: "valid"|"unsigned"|"invalid", reason?: string}}
 *  unsigned = no signature field at all; invalid = signature present but does not verify with this key.
 */
export function verifyManifestSignature(manifest, publicKeyPem) {
  if (!manifest || typeof manifest !== "object" || Array.isArray(manifest)) {
    return { status: "invalid", reason: "manifest is not an object" };
  }
  const sig = manifest.signature;
  if (sig === undefined || sig === null) return { status: "unsigned" };
  if (typeof sig !== "object" || sig.alg !== SIGNATURE_ALG || typeof sig.value !== "string") {
    return { status: "invalid", reason: "malformed signature field" };
  }
  try {
    if (sig.keyId && sig.keyId !== publicKeyId(publicKeyPem)) {
      return { status: "invalid", reason: "signed with an unknown key" };
    }
    const ok = verify(null, manifestPayload(manifest), createPublicKey(publicKeyPem), Buffer.from(sig.value, "base64"));
    return ok ? { status: "valid" } : { status: "invalid", reason: "signature does not match manifest" };
  } catch (e) {
    return { status: "invalid", reason: "verification error: " + (e?.message || e) };
  }
}