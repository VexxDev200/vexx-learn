/**
 * Makes sure update.config.json exists before a build (it is git-ignored: it is local configuration and
 * must never carry secrets - owner/repo/branch only).
 *
 *  - file already there            -> nothing happens (the file is NOT read or modified)
 *  - GITHUB_REPOSITORY is set (CI) -> written from it: { githubOwner, githubRepo, ... }
 *  - otherwise                     -> copied from update.config.example.json (placeholder owner, so OTA stays OFF
 *                                     until you fill it in) and a loud warning is printed.
 * Runs automatically as `prebuild` for `npm run build`.
 */
import { copyFileSync, existsSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const DEFAULTS = {
  branch: "main",
  updatesPath: "release/updates",
  portableAssetName: "Vexx-Learn-Portable.exe",
};

export function ensureUpdateConfig(root, env = process.env) {
  const target = join(root, "update.config.json");
  if (existsSync(target)) return { action: "exists", path: target };

  const m = /^([\w.-]+)\/([\w.-]+)$/.exec(String(env.GITHUB_REPOSITORY || ""));
  if (m) {
    writeFileSync(target, JSON.stringify({ githubOwner: m[1], githubRepo: m[2], ...DEFAULTS }, null, 2) + "\n");
    return { action: "from-github-repository", path: target };
  }

  const example = join(root, "update.config.example.json");
  if (existsSync(example)) copyFileSync(example, target);
  else writeFileSync(target, JSON.stringify({ githubOwner: "YOUR_GITHUB_USERNAME", githubRepo: "vexx-learn", ...DEFAULTS }, null, 2) + "\n");
  return { action: "from-example", path: target };
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  const root = join(dirname(fileURLToPath(import.meta.url)), "..");
  const r = ensureUpdateConfig(root);
  if (r.action === "from-example") {
    console.warn(
      "[ensure-update-config] WARNING: update.config.json was missing; created from update.config.example.json.\n" +
        "  githubOwner is a placeholder, so OTA updates are DISABLED in this build. Edit update.config.json (owner/repo only, no tokens)."
    );
  } else if (r.action === "from-github-repository") {
    console.log("[ensure-update-config] update.config.json created from GITHUB_REPOSITORY");
  }
}