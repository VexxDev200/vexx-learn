/**
 * One-shot release: bump app version → portable exe → OTA bundle → git push → GitHub Release.
 * Old portable users: restart app → курсы + UI OTA; если exe старый — скачает новый portable с GitHub Release.
 *
 * Usage: npm run ship   (from vexx-learn folder, gh auth + git push access required)
 */
import { readFileSync, writeFileSync } from "fs";
import { dirname, join } from "path";
import { fileURLToPath } from "url";
import { spawnSync } from "child_process";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const pkgPath = join(ROOT, "package.json");

function run(cmd, args) {
  const r = spawnSync(cmd, args, {
    cwd: ROOT,
    stdio: "inherit",
    shell: process.platform === "win32",
  });
  if (r.status !== 0) process.exit(r.status ?? 1);
}

function bumpPatchVersion() {
  const pkg = JSON.parse(readFileSync(pkgPath, "utf8"));
  const parts = String(pkg.version || "0.0.0")
    .split(".")
    .map((x) => parseInt(x, 10) || 0);
  while (parts.length < 3) parts.push(0);
  parts[2] += 1;
  pkg.version = parts.join(".");
  writeFileSync(pkgPath, JSON.stringify(pkg, null, 2) + "\n", "utf8");
  console.log("App version (OTA + exe):", pkg.version);
  return pkg.version;
}

console.log("=== Vexx Learn ship ===\n");

bumpPatchVersion();

console.log("\n[1/4] Build portable exe (courses + UI + electron-builder)…");
run("npm", ["run", "build"]);

console.log("\n[2/4] Pack OTA (manifest + course JSON + app-ui.zip)…");
run("node", ["scripts/pack-updates.mjs"]);

console.log("\n[3/4] Push OTA to GitHub (main)…");
run("node", ["scripts/publish-ota-git.mjs"]);

console.log("\n[4/4] Upload exe to GitHub Release…");
run("node", ["scripts/gh-release.mjs"]);

const manifest = JSON.parse(
  readFileSync(join(ROOT, "release", "updates", "manifest.json"), "utf8")
);
const portable = join(ROOT, "release", "Vexx-Learn-Portable.exe");

console.log("\n=== Готово ===");
console.log("EXE:", portable);
console.log("OTA coursesVersion:", manifest.coursesVersion);
console.log("OTA appVersion:", manifest.appVersion);
console.log(
  "У кого старый portable: закрыть и открыть — курсы/UI сами; новый exe скачается в фоне (Настройки → открыть)."
);
console.log("Команда для релиза всегда: npm run ship  (или ship.cmd)");
