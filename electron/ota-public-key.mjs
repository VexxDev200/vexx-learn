/**
 * OTA manifest verification key (Ed25519, PUBLIC part only - safe to commit).
 * The matching private key lives only on the maintainer's machine (see AUDIT.md, Round 1b).
 */
export const OTA_PUBLIC_KEY_PEM = `-----BEGIN PUBLIC KEY-----
MCowBQYDK2VwAyEA0rxddMabSLHdH8BSD6BzUH2Dtey3bRkFe/MLTa4P5oA=
-----END PUBLIC KEY-----
`;

/**
 * When true, manifests without a valid signature are refused. Keep false while clients older than
 * the first signing-aware release (0.2.11 and earlier) are still in the field: they do not verify
 * signatures, and the maintainer must be able to publish unsigned manifests during the transition.
 */
export const REQUIRE_SIGNED_MANIFEST = false;