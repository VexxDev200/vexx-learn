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
import {
  fetchGitHubAppRelease,
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

function resolveCoursesBase(settings, appRoot) {
  const custom = normalizeBase(settings.updateBaseUrl);
  if (custom) return custom;
  const cfg = loadUpdateConfig(appRoot);
  return githubCoursesBaseUrl(cfg);
}

export async function checkAndApplyUpdates({ appRoot, userData, settings, appVersion }) {
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
      const manifestUrl = `${base}/manifest.json`;
      remote = await fetchJson(manifestUrl);
    }

    const remoteCoursesVer = Number(remote.coursesVersion) || 0;
    const localVer = getLocalCoursesVersion(userData);
    const bundledVer = readBundledCoursesVersion(appRoot);
    const effectiveLocal = Math.max(localVer, bundledVer);

    result.remoteAppVersion = remote.appVersion || null;
    result.appUpdateUrl = remote.appDownloadUrl || null;

    if (settings.autoCheckApp && isGitHubConfigured(cfg)) {
      try {
        const gh = await fetchGitHubAppRelease(cfg);
        if (gh?.version) {
          result.remoteAppVersion = gh.version;
          result.appUpdateUrl = gh.downloadUrl || result.appUpdateUrl;
        }
      } catch (e) {
        if (!base) throw e;
        console.warn("[vexx-learn] GitHub release check:", e.message);
      }
    }

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

    if (
      settings.autoCheckApp &&
      result.remoteAppVersion &&
      (result.appUpdateUrl || semverGt(result.remoteAppVersion, appVersion))
    ) {
      if (semverGt(result.remoteAppVersion, appVersion)) {
        result.message = result.coursesUpdated ? "courses_and_app" : "app_update_available";
      }
    }
  } catch (e) {
    result.error = e.message || String(e);
    result.message = "update_failed";
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
  return {
    coursesBaseUrl: base,
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
