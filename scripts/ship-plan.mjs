/**
 * The ordered steps of `npm run ship` (scripts/ship.mjs). Pure data, no side effects, so the ORDER is testable.
 *
 * Order matters:
 *   build exe -> pack + sign (portableSha256 from that exe, before signing) -> verify -> UPLOAD the exe to the Release
 *   -> only then push the manifest to main.
 * The exe goes first: clients read the manifest from main, so a manifest that points to an exe which is not yet in the
 * Release would make updated clients try (and fail) to download it. With this order, an interrupted ship leaves the old
 * manifest on main, and a client that sees the new Release exe next to the old manifest ignores it (appVersion binding).
 * gh-release itself refuses unless the manifest is validly signed and sha256(exe) == portableSha256.
 */
export const EXE_REL = "release/Vexx-Learn-Portable.exe";
export const MANIFEST_REL = "release/updates/manifest.json";

export function shipSteps() {
  return [
    { id: "build", label: "Build portable exe (courses + UI + electron-builder)", cmd: "npm", args: ["run", "build"] },
    {
      id: "pack",
      label: "Pack OTA and sign (portableSha256 is taken from the built exe BEFORE signing)",
      cmd: "node",
      args: ["scripts/pack-updates.mjs", "--sign"],
    },
    {
      id: "verify",
      label: "Verify signature and file hashes (incl. the exe)",
      cmd: "node",
      args: ["scripts/sign-manifest.mjs", "--check", MANIFEST_REL, "--exe", EXE_REL],
    },
    { id: "release", label: "Upload the SAME exe to the GitHub Release", cmd: "node", args: ["scripts/gh-release.mjs"] },
    { id: "publish", label: "Push OTA manifest + files to main (after the exe is in the Release)", cmd: "node", args: ["scripts/publish-ota-git.mjs"] },
  ];
}