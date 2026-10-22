import { existsSync, readFileSync } from "fs";
import { join } from "path";

const PLACEHOLDER = "YOUR_GITHUB_USERNAME";

export function loadUpdateConfig(appRoot) {
  const candidates = [
    join(appRoot, "update.config.json"),
    join(appRoot, "..", "update.config.json"),
  ];
  const defaults = {
    githubOwner: "",
    githubRepo: "vexx-learn",
    branch: "main",
    updatesPath: "release/updates",
    portableAssetName: "Vexx-Learn-Portable.exe",
  };
  for (const p of candidates) {
    if (!existsSync(p)) continue;
    try {
      return { ...defaults, ...JSON.parse(readFileSync(p, "utf8")) };
    } catch {
      /* */
    }
  }
  return defaults;
}

export function isGitHubConfigured(cfg) {
  return Boolean(cfg.githubOwner && cfg.githubOwner !== PLACEHOLDER && cfg.githubRepo);
}

export function githubCoursesBaseUrl(cfg) {
  if (!isGitHubConfigured(cfg)) return "";
  const branch = cfg.branch || "main";
  const path = (cfg.updatesPath || "release/updates").replace(/^\/+|\/+$/g, "");
  return `https://raw.githubusercontent.com/${cfg.githubOwner}/${cfg.githubRepo}/${branch}/${path}`;
}

export async function fetchGitHubAppRelease(cfg) {
  if (!isGitHubConfigured(cfg)) return null;
  const api = `https://api.github.com/repos/${cfg.githubOwner}/${cfg.githubRepo}/releases/latest`;
  const res = await fetch(api, {
    headers: {
      Accept: "application/vnd.github+json",
      "User-Agent": "Vexx-Learn-Updater",
    },
  });
  if (!res.ok) throw new Error(`GitHub releases HTTP ${res.status}`);
  const data = await res.json();
  const version = String(data.tag_name || "").replace(/^v/i, "");
  const want = cfg.portableAssetName || "Vexx-Learn-Portable.exe";
  const asset =
    data.assets?.find((a) => a.name === want) ||
    data.assets?.find((a) => /portable/i.test(a.name) && a.name.endsWith(".exe"));
  return {
    version,
    downloadUrl: asset?.browser_download_url || null,
    releasePage: data.html_url || null,
  };
}
