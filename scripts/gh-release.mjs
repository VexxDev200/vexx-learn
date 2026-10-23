/**
 * Create or refresh GitHub Release for current package.json version.
 * OTA for users is manifest on main; Release carries the portable exe.
 *
 * Refuses (exit 1, nothing created or uploaded) unless the manifest is validly signed AND sha256(exe) equals its
 * portableSha256 - see scripts/release-guard.mjs.
 */
import { existsSync, readFileSync } from "fs";
import { dirname, join } from "path";
import { fileURLToPath } from "url";
import { spawnSync } from "child_process";
import { verifyReleaseExe } from "./release-guard.mjs";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
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
const guard = verifyReleaseExe({
  manifestPath: join(ROOT, "release", "updates", "manifest.json"),
  exePath: portable,
  appVersion: version,
});
if (!guard.ok) {
  console.error("REFUSING to publish:", guard.reason);
  process.exit(1);
}
console.log("exe sha256 matches the signed manifest:", guard.sha256);

function runGh(args) {
  const r = spawnSync("gh", args, { cwd: ROOT, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] });
  return { ok: r.status === 0, out: (r.stdout || "") + (r.stderr || ""), status: r.status };
}

const view = runGh(["release", "view", tag, "--repo", repo]);
if (!view.ok) {
  const notes = [
    `Vexx Learn ${version}`,
    "",
    "Users with OTA-capable portable: restart the app — UI updates from GitHub automatically.",
    "New installs: attach Vexx-Learn-Portable.exe when available.",
  ].join("\n");
  const create = runGh([
    "release",
    "create",
    tag,
    "--repo",
    repo,
    "--title",
    tag,
    "--notes",
    notes,
    "--target",
    "main",
  ]);
  if (!create.ok) {
    console.error("gh release create failed:", create.out);
    process.exit(1);
  }
  console.log("Created release", tag);
} else {
  console.log("Release already exists:", tag);
}

{
  const up = runGh([
    "release",
    "upload",
    tag,
    portable,
    "--repo",
    repo,
    "--clobber",
  ]);
  if (!up.ok) {
    console.error("Portable upload failed:", up.out);
    process.exit(1);
  }
  console.log("Uploaded portable exe to", tag);
}
