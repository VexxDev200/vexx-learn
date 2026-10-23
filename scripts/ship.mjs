/**
 * One-shot release (steps and their ORDER are in ship-plan.mjs): bump version, build exe, pack+sign OTA, verify,
 * create a DRAFT Release, upload the SAME exe to it, push the manifest to main, and publish the draft last.
 * Old portable users: restart app → курсы + UI OTA; если exe старый — скачает новый portable с GitHub Release.
 *
 * Usage: npm run ship   (from vexx-learn folder, gh auth + git push access required)
 */
import { readFileSync, writeFileSync } from "fs";
import { dirname, join } from "path";
import { fileURLToPath } from "url";
import { spawnSync } from "child_process";
import { runPlan, shipSteps } from "./ship-plan.mjs";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const pkgPath = join(ROOT, "package.json");

function exec(cmd, args) {
  const r = spawnSync(cmd, args, {
    cwd: ROOT,
    stdio: "inherit",
    shell: process.platform === "win32",
  });
  return r.status ?? 1;
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

const version = JSON.parse(readFileSync(pkgPath, "utf8")).version;
const result = runPlan(shipSteps(), exec, { log: console.log, tag: `v${version}` });
if (!result.ok) {
  console.error(`\nship FAILED at step "${result.failed}" (exit ${result.code}).`);
  console.error(result.advice);
  process.exit(result.code || 1);
}

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
