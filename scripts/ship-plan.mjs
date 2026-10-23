/**
 * The ordered steps of `npm run ship` (scripts/ship.mjs). Pure data + a runner with an injected executor, so the ORDER
 * and the failure behaviour are testable without running git/gh/npm.
 *
 * Draft-release flow (Architect's decision):
 *   build exe -> pack + sign (portableSha256 from that exe, before signing) -> verify
 *   -> create a DRAFT Release without a tag -> upload the exe to the draft
 *   -> push the signed manifest to main
 *   -> publish: verify origin/main holds exactly the local signed manifest, publish the draft with --target main
 *      (the tag lands on the already-signed main), check the tag. PUBLISHING THE DRAFT IS THE LAST STEP.
 * Until the last step nothing is public: clients see neither a new Release nor a new manifest, and any failure leaves
 * the draft unpublished. gh-release also refuses unless the manifest is validly signed and sha256(exe) == portableSha256.
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
    { id: "draft", label: "Create a DRAFT GitHub Release (no tag yet)", cmd: "node", args: ["scripts/gh-release.mjs", "draft"] },
    { id: "upload", label: "Upload the SAME exe to the draft Release", cmd: "node", args: ["scripts/gh-release.mjs", "upload"] },
    { id: "push", label: "Push the signed OTA manifest + files to main", cmd: "node", args: ["scripts/publish-ota-git.mjs"] },
    {
      id: "publish",
      label: "Publish the Release (--target main) after checking main holds the signed manifest; then check the tag",
      cmd: "node",
      args: ["scripts/gh-release.mjs", "publish"],
    },
  ];
}

/** Plain-language state after a failure at step `id` (nothing is public until the last step succeeds). */
export function failureAdvice(id, tag = "vX.Y.Z") {
  switch (id) {
    case "build":
    case "pack":
    case "verify":
      return "Nothing was created or published (no Release, no push).";
    case "draft":
      return "Nothing was pushed or published. A draft Release may or may not exist; fix the cause and re-run.";
    case "upload":
      return `Nothing was pushed or published. The draft Release ${tag} stays UNPUBLISHED (no tag). Fix the cause and re-run \`node scripts/gh-release.mjs upload\`.`;
    case "push":
      return `The draft Release ${tag} (with the exe) stays UNPUBLISHED. main may or may not have received the manifest: check \`git status\` / \`git log origin/main\`, push by hand if needed, then run \`node scripts/gh-release.mjs publish\`.`;
    case "publish":
      return `If the message above says the Release IS PUBLISHED, only the tag check failed (inspect the tag ${tag}). Otherwise the draft ${tag} stays UNPUBLISHED: fix the cause and re-run \`node scripts/gh-release.mjs publish\`.`;
    default:
      return "Unknown step.";
  }
}

/** exec: (cmd, args) => exit code. Stops at the first failing step. */
export function runPlan(steps, exec, { log = () => {}, tag } = {}) {
  const completed = [];
  for (const [i, s] of steps.entries()) {
    log(`\n[${i + 1}/${steps.length}] ${s.label}.`);
    const code = exec(s.cmd, s.args);
    if (code !== 0) return { ok: false, failed: s.id, code, completed, advice: failureAdvice(s.id, tag) };
    completed.push(s.id);
  }
  return { ok: true, completed };
}