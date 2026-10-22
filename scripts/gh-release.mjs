/**
 * Create or refresh GitHub Release for current package.json version.
 * OTA for users is manifest on main; Release is for visibility + optional portable exe.
 */
import { existsSync, readFileSync } from "fs";
import { dirname, join } from "path";
import { fileURLToPath } from "url";
import { spawnSync } from "child_process";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const pkg = JSON.parse(readFileSync(join(ROOT, "package.json"), "utf8"));
const version = pkg.version;
const tag = `v${version}`;
const cfg = JSON.parse(readFileSync(join(ROOT, "update.config.json"), "utf8"));
const repo = `${cfg.githubOwner}/${cfg.githubRepo}`;

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

const portable = join(ROOT, "release", "Vexx-Learn-Portable.exe");
if (existsSync(portable)) {
  const up = runGh([
    "release",
    "upload",
    tag,
    portable,
    "--repo",
    repo,
    "--clobber",
  ]);
  if (up.ok) console.log("Uploaded portable exe to", tag);
  else console.warn("Portable upload:", up.out);
}
