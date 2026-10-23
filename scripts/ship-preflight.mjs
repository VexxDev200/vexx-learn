/**
 * Pre-flight checks for `npm run ship`, run BEFORE anything is built, created or pushed. Pure functions with injected
 * `git` / `gh` runners ((args) => {ok, out}), so they are testable without touching git or GitHub.
 *
 *  - ship never bumps the version: a human sets it in package.json;
 *  - the branch must be main;
 *  - the working tree may only be dirty inside OTA_COMMIT_PATHS (package.json, OTA files, generated course data);
 *    anything else (electron/, src/App.tsx, scripts/ ...) must be committed or stashed by a human first;
 *  - a published Release or an existing tag for this version -> refuse; a DRAFT of this version is reused.
 */
export const OTA_COMMIT_PATHS = ["release/updates/", "src/content/data/", "package.json"];

const unquote = (p) => p.replace(/^"(.*)"$/, "$1").replace(/\\/g, "/");
const isAllowed = (path, allowed) => allowed.some((a) => (a.endsWith("/") ? path.startsWith(a) : path === a));

/** porcelain: output of `git status --porcelain`. Returns the dirty paths that are NOT allowed. */
export function dirtyOutsideAllowed(porcelain, allowed = OTA_COMMIT_PATHS) {
  const bad = [];
  for (const line of String(porcelain).split("\n")) {
    if (!line.trim()) continue;
    const rest = line.slice(3);
    for (const raw of rest.split(" -> ")) {
      const p = unquote(raw.trim());
      if (p && !isAllowed(p, allowed)) bad.push(p);
    }
  }
  return bad;
}

export function checkBranchAndTree({ git, allowed = OTA_COMMIT_PATHS }) {
  const b = git(["rev-parse", "--abbrev-ref", "HEAD"]);
  if (!b.ok) return { ok: false, reason: `cannot read the git branch: ${b.out}` };
  if (b.out.trim() !== "main") return { ok: false, reason: `current branch is "${b.out.trim()}": ship runs only on main` };
  const s = git(["status", "--porcelain"]);
  if (!s.ok) return { ok: false, reason: `git status failed: ${s.out}` };
  const bad = dirtyOutsideAllowed(s.out, allowed);
  if (bad.length) {
    return {
      ok: false,
      reason: `working tree has changes outside the expected files (${allowed.join(", ")}): ${bad.slice(0, 10).join(", ")}${bad.length > 10 ? ", ..." : ""}. Commit or stash them first.`,
    };
  }
  return { ok: true };
}

export function checkVersionFree({ gh, git, repo, tag }) {
  const local = git(["rev-parse", "-q", "--verify", `refs/tags/${tag}`]);
  if (local.ok) return { ok: false, reason: `tag ${tag} already exists locally: bump the version in package.json` };
  const remote = git(["ls-remote", "--tags", "origin", `refs/tags/${tag}`]);
  if (!remote.ok) return { ok: false, reason: `cannot check tags on origin: ${remote.out}` };
  if (remote.out.trim()) return { ok: false, reason: `tag ${tag} already exists on origin: bump the version in package.json` };
  const v = gh(["release", "view", tag, "--repo", repo, "--json", "isDraft"]);
  if (!v.ok) {
    if (/not found/i.test(v.out)) return { ok: true, reuseDraft: false };
    return { ok: false, reason: `cannot determine whether a Release ${tag} exists: ${v.out.trim()}` };
  }
  let isDraft = null;
  try { isDraft = JSON.parse(v.out).isDraft; } catch { /* unknown */ }
  if (isDraft === true) return { ok: true, reuseDraft: true };
  return { ok: false, reason: `a published Release ${tag} already exists: bump the version in package.json` };
}

export function preflight({ gh, git, repo, tag, allowed }) {
  const t = checkBranchAndTree({ git, allowed });
  if (!t.ok) return t;
  return checkVersionFree({ gh, git, repo, tag });
}