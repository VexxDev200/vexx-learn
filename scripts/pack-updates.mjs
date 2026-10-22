/**
 * Build folder for hosting auto-updates: release/updates/
 * Upload contents to your CDN / static host; set URL in Vexx Learn settings.
 *
 * Usage: npm run courses && node scripts/pack-updates.mjs
 */
import { createHash } from "crypto";
import { copyFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } from "fs";
import { dirname, join } from "path";
import { fileURLToPath } from "url";
import { spawnSync } from "child_process";

import { githubCoursesBaseUrl, isGitHubConfigured, loadUpdateConfig } from "../electron/update-config.mjs";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const SRC = join(ROOT, "src", "content", "data");
const OUT = join(ROOT, "release", "updates");
const pkg = JSON.parse(readFileSync(join(ROOT, "package.json"), "utf8"));
const cfg = loadUpdateConfig(ROOT);

mkdirSync(OUT, { recursive: true });

const tracks = ["python", "java", "cpp", "csharp"];
const files = {};
const sha256 = {};

for (const t of tracks) {
  const name = `${t}.json`;
  copyFileSync(join(SRC, name), join(OUT, name));
  files[t] = name;
  sha256[t] = createHash("sha256").update(readFileSync(join(OUT, name))).digest("hex");
}

const bundle = JSON.parse(readFileSync(join(SRC, "bundle-manifest.json"), "utf8"));

const distDir = join(ROOT, "dist");
const uiZipName = "app-ui.zip";
const uiZipPath = join(OUT, uiZipName);
let uiSha256 = null;

if (existsSync(join(distDir, "index.html"))) {
  // tar -a includes dist/assets (Compress-Archive -Path dist/* skips subfolders)
  const r = spawnSync("tar", ["-a", "-cf", uiZipPath, "-C", distDir, "."], {
    cwd: ROOT,
    stdio: "inherit",
  });
  if (r.status === 0 && existsSync(uiZipPath)) {
    uiSha256 = createHash("sha256").update(readFileSync(uiZipPath)).digest("hex");
    console.log("UI bundle:", uiZipName, uiSha256.slice(0, 12) + "…");
  } else {
    console.warn("Could not create app-ui.zip — run npm run build:ui first");
  }
} else {
  console.warn("dist/ missing — skip app-ui.zip (npm run build:ui)");
}

const manifest = {
  coursesVersion: bundle.coursesVersion,
  appVersion: pkg.version,
  uiBundle: uiSha256 ? uiZipName : null,
  updateSource: "github",
  githubRepo: isGitHubConfigured(cfg) ? `${cfg.githubOwner}/${cfg.githubRepo}` : null,
  coursesBaseUrl: githubCoursesBaseUrl(cfg),
  generatedAt: new Date().toISOString(),
  files,
  sha256,
};
if (uiSha256) manifest.sha256.uiBundle = uiSha256;

writeFileSync(join(OUT, "manifest.json"), JSON.stringify(manifest, null, 2));
console.log("Packed updates ->", OUT);
console.log("coursesVersion:", manifest.coursesVersion, "| appVersion:", manifest.appVersion);
if (manifest.coursesBaseUrl) {
  console.log("GitHub raw (commit release/updates here):", manifest.coursesBaseUrl);
}
if (uiSha256) console.log("Users get UI via OTA (app-ui.zip), not a new exe.");
