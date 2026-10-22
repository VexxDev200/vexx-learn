/**
 * Build folder for hosting auto-updates: release/updates/
 * Upload contents to your CDN / static host; set URL in Vexx Learn settings.
 *
 * Usage: npm run courses && node scripts/pack-updates.mjs
 */
import { createHash } from "crypto";
import { copyFileSync, mkdirSync, readFileSync, writeFileSync } from "fs";
import { dirname, join } from "path";
import { fileURLToPath } from "url";

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

let appDownloadUrl = "";
if (isGitHubConfigured(cfg)) {
  appDownloadUrl = `https://github.com/${cfg.githubOwner}/${cfg.githubRepo}/releases/latest/download/${cfg.portableAssetName}`;
}

const manifest = {
  coursesVersion: bundle.coursesVersion,
  appVersion: pkg.version,
  appDownloadUrl,
  updateSource: "github",
  githubRepo: isGitHubConfigured(cfg) ? `${cfg.githubOwner}/${cfg.githubRepo}` : null,
  coursesBaseUrl: githubCoursesBaseUrl(cfg),
  generatedAt: new Date().toISOString(),
  files,
  sha256,
};

writeFileSync(join(OUT, "manifest.json"), JSON.stringify(manifest, null, 2));
console.log("Packed updates ->", OUT);
console.log("coursesVersion:", manifest.coursesVersion, "| appVersion:", manifest.appVersion);
if (manifest.coursesBaseUrl) {
  console.log("GitHub raw (commit release/updates here):", manifest.coursesBaseUrl);
}
if (appDownloadUrl) console.log("App download URL template:", appDownloadUrl);
