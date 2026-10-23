/**
 * GitHub Release steps for `npm run ship` (draft flow). Run by hand only when you really release.
 *
 *   node scripts/gh-release.mjs draft     create a DRAFT Release (no tag yet)
 *   node scripts/gh-release.mjs upload    attach release/Vexx-Learn-Portable.exe to the draft
 *   node scripts/gh-release.mjs publish   (after the manifest was pushed to main) verify, publish with --target main, check the tag
 *
 * draft/upload/publish all REFUSE (exit 1, nothing created/uploaded/published) unless the manifest is validly signed and
 * sha256(exe) equals its portableSha256 - see scripts/release-guard.mjs. publish also refuses unless origin/main holds
 * exactly the local signed manifest. Logic and tests: scripts/release-flow.mjs.
 */
import { existsSync, readFileSync } from "fs";
import { dirname, join } from "path";
import { fileURLToPath } from "url";
import { spawnSync } from "child_process";
import { verifyReleaseExe } from "./release-guard.mjs";
import { createDraft, publishDraft, uploadExe } from "./release-flow.mjs";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const mode = process.argv[2];
if (!["draft", "upload", "publish"].includes(mode) || process.argv.length > 3) {
  console.error("Usage: node scripts/gh-release.mjs <draft|upload|publish>");
  process.exit(2);
}
const pkg = JSON.parse(readFileSync(join(ROOT, "package.json"), "utf8"));
const version = pkg.version;
const tag = `v${version}`;
if (!existsSync(join(ROOT, "update.config.json"))) {
  console.error("update.config.json not found (it is git-ignored, local only). Copy update.config.example.json to update.config.json and set githubOwner/githubRepo.");
  process.exit(1);
}
const cfg = JSON.parse(readFileSync(join(ROOT, "update.config.json"), "utf8"));
const repo = `${cfg.githubOwner}/${cfg.githubRepo}`;

const portable = join(ROOT, "release", "Vexx-Learn-Portable.exe");
const manifestPath = join(ROOT, "release", "updates", "manifest.json");
const guard = verifyReleaseExe({ manifestPath, exePath: portable, appVersion: version });
if (!guard.ok) {
  console.error("REFUSING to publish:", guard.reason);
  process.exit(1);
}
console.log("exe sha256 matches the signed manifest:", guard.sha256);

function run(cmd, args) {
  const r = spawnSync(cmd, args, { cwd: ROOT, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] });
  return { ok: r.status === 0, out: (r.stdout || "") + (r.stderr || ""), status: r.status };
}
const gh = (args) => run("gh", args);
const git = (args) => run("git", args);

let res;
if (mode === "draft") res = createDraft({ gh, repo, tag, version });
else if (mode === "upload") res = uploadExe({ gh, repo, tag, exePath: portable });
else res = publishDraft({ gh, git, repo, tag, localManifestPath: manifestPath });

if (!res.ok) {
  console.error(mode === "publish" && res.published ? "WARNING:" : "FAILED:", res.reason);
  if (mode === "publish" && !res.published) console.error(`The draft Release ${tag} stays UNPUBLISHED.`);
  process.exit(1);
}
console.log(`${mode} ok for ${tag}`);