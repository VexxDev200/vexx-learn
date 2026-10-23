/**
 * Draft-release flow helpers (used by scripts/gh-release.mjs and tested with injected `gh` / `git` runners).
 *
 *   draft   -> create a DRAFT Release without a tag (a draft does not create the tag until it is published)
 *   upload  -> attach the exe to the draft           (guarded: signature + sha256(exe) == portableSha256)
 *   [ship pushes the signed manifest to main]
 *   publish -> verify what is on main == the local signed manifest, publish the draft with --target main
 *              (the tag is created on the already-signed main), then check the tag points at that commit
 *
 * If anything after the draft step fails, the draft simply stays unpublished.
 */
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { OTA_PUBLIC_KEY_PEM } from "../electron/ota-public-key.mjs";
import { verifyManifestSignature } from "../electron/manifest-verify.mjs";

export const MANIFEST_IN_REPO = "release/updates/manifest.json";
const sha = (s) => createHash("sha256").update(s).digest("hex");
const normalize = (text) => String(text).replace(/\r\n/g, "\n");

/** gh: (args) => {ok, out, status} */
function releaseState(gh, repo, tag) {
  const v = gh(["release", "view", tag, "--repo", repo, "--json", "isDraft"]);
  if (!v.ok) return { exists: false };
  try {
    return { exists: true, isDraft: JSON.parse(v.out).isDraft === true };
  } catch {
    return { exists: true, isDraft: null };
  }
}

export function createDraft({ gh, repo, tag, version }) {
  const st = releaseState(gh, repo, tag);
  if (st.exists) {
    if (st.isDraft === true) return { ok: true, reused: true };
    return { ok: false, reason: `Release ${tag} already exists and is not a confirmed draft - refusing to touch a published release` };
  }
  const notes = [`Vexx Learn ${version}`, "", "Portable exe. The manifest on main is signed; the exe hash is covered by that signature."].join("\n");
  // --draft and NO tag push: the tag is created later, at publish time, on the pushed main (--target main)
  const r = gh(["release", "create", tag, "--repo", repo, "--draft", "--title", tag, "--notes", notes, "--target", "main"]);
  if (!r.ok) return { ok: false, reason: `gh release create (draft) failed: ${r.out}` };
  return { ok: true, reused: false };
}

export function uploadExe({ gh, repo, tag, exePath }) {
  const st = releaseState(gh, repo, tag);
  if (!st.exists || st.isDraft !== true) return { ok: false, reason: `no draft Release ${tag} to upload to (run the draft step first)` };
  const r = gh(["release", "upload", tag, exePath, "--repo", repo, "--clobber"]);
  if (!r.ok) return { ok: false, reason: `gh release upload failed: ${r.out}` };
  return { ok: true };
}

/**
 * After the push: origin/main must be exactly local HEAD, and the manifest committed in HEAD must equal the local
 * signed manifest (sha256, line endings normalised) and carry a valid signature.
 * git: (args) => {ok, out}
 */
export function verifyPushedManifest({ git, localManifestPath, publicKeyPem = OTA_PUBLIC_KEY_PEM }) {
  const head = git(["rev-parse", "HEAD"]);
  if (!head.ok) return { ok: false, reason: `git rev-parse HEAD failed: ${head.out}` };
  const headSha = head.out.trim();
  const remote = git(["ls-remote", "origin", "refs/heads/main"]);
  if (!remote.ok) return { ok: false, reason: `git ls-remote failed: ${remote.out}` };
  const remoteSha = remote.out.trim().split(/\s+/)[0] || "";
  if (remoteSha !== headSha) {
    return { ok: false, reason: `origin/main (${remoteSha || "?"}) is not the local HEAD (${headSha}): the manifest was not pushed (or main moved)` };
  }
  const committed = git(["show", `HEAD:${MANIFEST_IN_REPO}`]);
  if (!committed.ok) return { ok: false, reason: `manifest is not committed in HEAD: ${committed.out}` };
  const localHash = sha(normalize(readFileSync(localManifestPath, "utf8")));
  const committedHash = sha(normalize(committed.out));
  if (localHash !== committedHash) {
    return { ok: false, reason: `manifest on main (sha256 ${committedHash}) differs from the local signed manifest (${localHash})` };
  }
  let manifest;
  try { manifest = JSON.parse(committed.out); } catch (e) { return { ok: false, reason: `manifest on main is not JSON: ${e.message}` }; }
  const sig = verifyManifestSignature(manifest, publicKeyPem);
  if (sig.status !== "valid") return { ok: false, reason: `manifest on main has a ${sig.status} signature` };
  return { ok: true, headSha, manifestSha256: committedHash };
}

/** After publishing: the tag must exist on origin and point at the commit whose signed manifest we verified. */
export function verifyTagAtCommit({ git, tag, commitSha }) {
  const r = git(["ls-remote", "origin", `refs/tags/${tag}`, `refs/tags/${tag}^{}`]);
  if (!r.ok) return { ok: false, reason: `git ls-remote (tag) failed: ${r.out}` };
  const lines = r.out.trim().split("\n").filter(Boolean).map((l) => l.trim().split(/\s+/));
  const peeled = lines.find((l) => l[1] === `refs/tags/${tag}^{}`);
  const direct = lines.find((l) => l[1] === `refs/tags/${tag}`);
  const tagSha = (peeled || direct || [])[0];
  if (!tagSha) return { ok: false, reason: `tag ${tag} not found on origin` };
  if (tagSha !== commitSha) return { ok: false, reason: `tag ${tag} points at ${tagSha}, not at the verified commit ${commitSha}` };
  return { ok: true };
}

/** Publish the draft. All guards injected; returns {ok, published, reason}. `published` tells whether the Release went public. */
export function publishDraft({ gh, git, repo, tag, localManifestPath, publicKeyPem }) {
  const st = releaseState(gh, repo, tag);
  if (!st.exists || st.isDraft !== true) {
    return { ok: false, published: false, reason: `no draft Release ${tag} to publish` };
  }
  const pushed = verifyPushedManifest({ git, localManifestPath, publicKeyPem });
  if (!pushed.ok) return { ok: false, published: false, reason: pushed.reason };
  const edit = gh(["release", "edit", tag, "--repo", repo, "--draft=false", "--target", "main"]);
  if (!edit.ok) return { ok: false, published: false, reason: `gh release edit (publish) failed: ${edit.out}` };
  const tagCheck = verifyTagAtCommit({ git, tag, commitSha: pushed.headSha });
  if (!tagCheck.ok) {
    return { ok: false, published: true, reason: `Release IS PUBLISHED, but the tag check failed: ${tagCheck.reason}` };
  }
  return { ok: true, published: true, headSha: pushed.headSha };
}