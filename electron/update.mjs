import { createWriteStream, existsSync } from "fs";
import { mkdirSync, readFileSync, writeFileSync } from "fs";
import { dirname, join } from "path";
import { pipeline } from "stream/promises";
import { createHash } from "crypto";
import {
  getLocalCoursesVersion,
  writeCoursesCache,
  readBundledCoursesVersion,
} from "./courses.mjs";
import { applyUiBundle, getLocalUiVersion } from "./app-ui.mjs";
import {
  githubCoursesBaseUrl,
  isGitHubConfigured,
  loadUpdateConfig,
} from "./update-config.mjs";

const TRACKS = ["python", "java", "cpp", "csharp"];

function normalizeBase(url) {
  if (!url || typeof url !== "string") return "";
  return url.trim().replace(/\/+$/, "");
}

async function fetchJson(url, timeoutMs = 15000) {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const res = await fetch(url, { signal: ctrl.signal });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return await res.json();
  } finally {
    clearTimeout(t);
  }
}

async function downloadFile(url, destPath) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Download failed ${res.status}`);
  mkdirSync(dirname(destPath), { recursive: true });
  await pipeline(res.body, createWriteStream(destPath));
}

function sha256File(path) {
  const buf = readFileSync(path);
  return createHash("sha256").update(buf).digest("hex");
}

/** raw.githubusercontent.com/owner/repo with no branch/path → 404 in browser */
export function isIncompleteGithubRawUrl(url) {
  return /^https:\/\/raw\.githubusercontent\.com\/[\w.-]+\/[\w.-]+\/?$/i.test(url);
}

function resolveCoursesBase(settings, appRoot) {
  const cfg = loadUpdateConfig(appRoot);
  const gh = githubCoursesBaseUrl(cfg);
  const custom = normalizeBase(settings.updateBaseUrl);
  if (!custom) return gh;
  if (isIncompleteGithubRawUrl(custom)) {
    console.warn(
      "[vexx-learn] updateBaseUrl is repo root only; using",
      gh || "bundled GitHub path from update.config.json"
    );
    return gh || custom;
  }
  return custom;
}

export function resolveCoursesBaseForSettings(settings, appRoot) {
  return resolveCoursesBase(settings, appRoot);
}

export async function checkAndApplyUpdates({ appRoot, userData, settings, appVersion }) {
  settings = { ...settings, autoUpdateCourses: true, autoCheckApp: true };
  const cfg = loadUpdateConfig(appRoot);
  const base = resolveCoursesBase(settings, appRoot);
  const result = {
    checked: false,
    coursesUpdated: false,
    coursesVersion: getLocalCoursesVersion(userData),
    bundledCoursesVersion: readBundledCoursesVersion(appRoot),
    appVersion,
    remoteAppVersion: null,
    appUpdateUrl: null,
    appLocalPath: null,
    appDownloaded: false,
    appUpdateAvailable: false,
    uiUpdated: false,
    needsReload: false,
    effectiveAppVersion: appVersion,
    message: "",
    error: null,
  };

  if (!base && !isGitHubConfigured(cfg)) {
    result.message = "no_update_url";
    return result;
  }

  result.checked = true;

  try {
    let remote = { coursesVersion: 0, appVersion: null, appDownloadUrl: null, files: {}, sha256: {} };
    if (base) {
      const manifestUrl = `${base}/manifest.json?t=${Date.now()}`;
      remote = await fetchJson(manifestUrl);
    }

    const remoteCoursesVer = Number(remote.coursesVersion) || 0;
    const localVer = getLocalCoursesVersion(userData);
    const bundledVer = readBundledCoursesVersion(appRoot);
    const effectiveLocal = Math.max(localVer, bundledVer);

    result.remoteAppVersion = remote.appVersion || null;
    const effectiveVersion = getLocalUiVersion(userData, appVersion);
    result.effectiveAppVersion = effectiveVersion;

    if (base && settings.autoUpdateCourses && remoteCoursesVer > effectiveLocal) {
      const tracksData = {};
      for (const track of TRACKS) {
        const fileName = remote.files?.[track] || `${track}.json`;
        const fileUrl = `${base}/${fileName}`.replace(/([^:]\/)\/+/g, "$1");
        const tmp = join(userData, "courses-cache", `_dl_${track}.json`);
        await downloadFile(fileUrl, tmp);
        if (remote.sha256?.[track]) {
          const hash = sha256File(tmp);
          if (hash !== remote.sha256[track]) {
            throw new Error(`Checksum mismatch for ${track}`);
          }
        }
        tracksData[track] = JSON.parse(readFileSync(tmp, "utf8"));
      }
      writeCoursesCache(
        userData,
        { coursesVersion: remoteCoursesVer, updatedAt: new Date().toISOString() },
        tracksData
      );
      result.coursesUpdated = true;
      result.coursesVersion = remoteCoursesVer;
      result.message = "courses_updated";
    } else if (remoteCoursesVer <= effectiveLocal) {
      result.message = "courses_up_to_date";
      result.coursesVersion = effectiveLocal;
    }

    const appNewer =
      Boolean(result.remoteAppVersion) && semverGt(result.remoteAppVersion, effectiveVersion);
    result.appUpdateAvailable = appNewer;

    if (appNewer && base && remote.uiBundle) {
      const uiName = remote.uiBundle;
      const uiUrl = `${base}/${uiName}`.replace(/([^:]\/)\/+/g, "$1");
      const zipTmp = join(userData, "app-ui", `_dl_${result.remoteAppVersion}.zip`);
      mkdirSync(dirname(zipTmp), { recursive: true });
      await downloadFile(uiUrl, zipTmp);
      applyUiBundle(
        userData,
        result.remoteAppVersion,
        zipTmp,
        remote.sha256?.uiBundle || remote.sha256?.[uiName]
      );
      result.uiUpdated = true;
      result.needsReload = true;
      result.effectiveAppVersion = result.remoteAppVersion;
      result.appUpdateAvailable = false;
      if (result.coursesUpdated) {
        result.message = "courses_and_ui_updated";
      } else {
        result.message = "ui_updated";
      }
    } else if (appNewer && !remote.uiBundle) {
      console.warn("[vexx-learn] newer appVersion but no uiBundle in manifest — run release:pack");
      if (result.coursesUpdated) result.message = "courses_updated";
      else result.message = "courses_up_to_date";
    } else if (appNewer && remote.uiBundle && !result.uiUpdated) {
      result.message = "ui_update_pending";
      result.appUpdateAvailable = true;
    }
  } catch (e) {
    result.error = e.message || String(e);
    result.message = "update_failed";
    try {
      const logPath = join(userData, "last-update-error.txt");
      writeFileSync(logPath, `${new Date().toISOString()}\n${result.error}\n`, "utf8");
    } catch {
      /* */
    }
  }

  return result;
}

function semverGt(a, b) {
  const pa = String(a).split(".").map((x) => parseInt(x, 10) || 0);
  const pb = String(b).split(".").map((x) => parseInt(x, 10) || 0);
  for (let i = 0; i < 3; i++) {
    if ((pa[i] || 0) > (pb[i] || 0)) return true;
    if ((pa[i] || 0) < (pb[i] || 0)) return false;
  }
  return false;
}

export function savePendingAppUpdate(userData, info) {
  const p = join(userData, "pending-app-update.json");
  writeFileSync(p, JSON.stringify(info, null, 2), "utf8");
}

export function getUpdateSourceInfo(appRoot, settings) {
  const cfg = loadUpdateConfig(appRoot);
  const base = resolveCoursesBase(settings, appRoot);
  const manifestUrl = base ? `${base}/manifest.json` : "";
  return {
    coursesBaseUrl: base,
    manifestUrl,
    githubConfigured: isGitHubConfigured(cfg),
    githubRepo: isGitHubConfigured(cfg) ? `${cfg.githubOwner}/${cfg.githubRepo}` : null,
    portableAssetName: cfg.portableAssetName,
  };
}

export function loadPendingAppUpdate(userData) {
  const p = join(userData, "pending-app-update.json");
  if (!existsSync(p)) return null;
  try {
    return JSON.parse(readFileSync(p, "utf8"));
  } catch {
    return null;
  }
}
