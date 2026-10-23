/**
 * Commit release/updates (+ generated course JSON) and push to origin/main.
 */
import { readFileSync } from "fs";
import { dirname, join } from "path";
import { fileURLToPath } from "url";
import { spawnSync } from "child_process";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");

function run(cmd, args, opts = {}) {
  const r = spawnSync(cmd, args, {
    cwd: ROOT,
    encoding: "utf8",
    stdio: opts.silent ? ["ignore", "pipe", "pipe"] : "inherit",
    shell: opts.shell ?? false,
  });
  if (r.status !== 0) {
    if (opts.silent) console.error((r.stdout || "") + (r.stderr || ""));
    process.exit(r.status ?? 1);
  }
  return r;
}

const inside = run("git", ["rev-parse", "--is-inside-work-tree"], { silent: true });
if (inside.stdout?.trim() !== "true") {
  console.error("Not a git repository.");
  process.exit(1);
}

const branch = run("git", ["rev-parse", "--abbrev-ref", "HEAD"], { silent: true }).stdout?.trim();
if (branch !== "main") {
  console.error(`Current branch is "${branch}" — switch to main before ship.`);
  process.exit(1);
}

run("git", [
  "add",
  "release/updates/",
  "src/content/data/",
  "package.json",
  "electron/",
  "src/App.tsx",
  "scripts/publish-ota-git.mjs",
  "scripts/ship.mjs",
]);

const staged = spawnSync("git", ["diff", "--cached", "--quiet"], {
  cwd: ROOT,
  shell: process.platform === "win32",
});
if (staged.status === 0) {
  console.log("Git: OTA files unchanged — skip commit, push anyway.");
} else {
  const manifest = JSON.parse(
    readFileSync(join(ROOT, "release", "updates", "manifest.json"), "utf8")
  );
  const msg = `chore(ota): ship courses v${manifest.coursesVersion} app ${manifest.appVersion}`;
  run("git", ["commit", "-m", msg]);
}

run("git", ["push", "origin", "main"]);
console.log("Git: pushed main — clients pull OTA from raw.githubusercontent.com within minutes.");
