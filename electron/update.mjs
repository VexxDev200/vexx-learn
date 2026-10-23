import { createReadStream, createWriteStream, existsSync } from "fs";
import { mkdirSync, readdirSync, readFileSync, renameSync, rmSync, statSync, writeFileSync } from "fs";
import { dirname, join, resolve } from "path";
import { pipeline } from "stream/promises";
import { createHash } from "crypto";
import {
  TRACKS,
  getLocalCoursesVersion,
  writeCoursesCache,
  readBundledCoursesVersion,
} from "./courses.mjs";
import { applyUiBundle, getLocalUiVersion } from "./app-ui.mjs";
import {
  fetchGitHubAppRelease,
  githubCoursesBaseUrl,
  isGitHubConfigured,
  loadUpdateConfig,
} from "./update-config.mjs";
import { UPDATE_HOST_ALLOWLIST, isAllowedUpdateBaseUrl, isPathInsideRoots } from "./security-policy.mjs";
import { verifyManifestSignature } from "./manifest-verify.mjs";
import { OTA_PUBLIC_KEY_PEM, REQUIRE_SIGNED_MANIFEST } from "./ota-public-key.mjs";

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

async function downloadFile(url, destPath, { checkFinalHost = false } = {}) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Download failed ${res.status}`);
  if (checkFinalHost && res.url) {
    // after redirects the body must still come from https on an allowlisted GitHub host
    let u;
    try { u = new URL(res.url); } catch { throw new Error("Download redirected to an invalid URL"); }
    if (u.protocol !== "https:" || !UPDATE_HOST_ALLOWLIST.includes(u.hostname.toLowerCase())) {
      throw new Error("Download redirected to a non-GitHub host");
    }
  }
  mkdirSync(dirname(destPath), { recursive: true });
  await pipeline(res.body, createWriteStream(destPath));
}

// SHA-256 of a file, read as a STREAM (a ~70 MB exe must not be loaded into memory or block the main process), with a
// small cache keyed by (path, size, mtime, ctime). A modified/replaced file changes size or mtime, and ctime cannot be set
// from user space, so a swapped file misses the cache and is hashed again. The key is taken before reading and the result
// is cached only if the stat is unchanged after reading (no caching of a file that changed while being hashed).
const HASH_CACHE_MAX = 16;
const hashCache = new Map();
const hashStats = { computed: 0, cacheHits: 0 };
export function sha256Stats() { return { ...hashStats }; }
/** TEST ONLY: plant a digest under the file's CURRENT stat key, i.e. simulate a tamper that the cache cannot see. */
export function forgeSha256CacheEntryForTests(path, digest) {
  hashCache.set(statKey(path, statSync(path)), digest);
}
export function clearSha256Cache() { hashCache.clear(); hashStats.computed = 0; hashStats.cacheHits = 0; }
const statKey = (path, st) => `${resolve(path)}|${st.size}|${st.mtimeMs}|${st.ctimeMs}`;

export async function sha256File(path, { useCache = true } = {}) {
  const before = statSync(path);
  const key = statKey(path, before);
  if (useCache && hashCache.has(key)) {
    hashStats.cacheHits++;
    const v = hashCache.get(key);
    hashCache.delete(key);
    hashCache.set(key, v); // LRU refresh
    return v;
  }
  const h = createHash("sha256");
  for await (const chunk of createReadStream(path)) h.update(chunk);
  hashStats.computed++;
  const digest = h.digest("hex");
  if (useCache) {
    let after = null;
    try { after = statSync(path); } catch { /* vanished */ }
    if (after && statKey(path, after) === key) {
      hashCache.set(key, digest);
      while (hashCache.size > HASH_CACHE_MAX) hashCache.delete(hashCache.keys().next().value);
    }
  }
  return digest;
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
  if (!isIncompleteGithubRawUrl(custom) && !isAllowedUpdateBaseUrl(custom, cfg)) {
    console.warn("[vexx-learn] updateBaseUrl rejected (https + GitHub host required); using default");
    return gh;
  }
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

export async function checkAndApplyUpdates({
  appRoot,
  userData,
  settings,
  appVersion,
  // injectable for tests; production uses the embedded key and the module-level strict flag
  otaPublicKeyPem = OTA_PUBLIC_KEY_PEM,
  requireSignedManifest = REQUIRE_SIGNED_MANIFEST,
}) {
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
    manifestSignature: "none",
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
    let signed = false;
    if (base) {
      const manifestUrl = `${base}/manifest.json?t=${Date.now()}`;
      remote = await fetchJson(manifestUrl);
      const sig = verifyManifestSignature(remote, otaPublicKeyPem);
      result.manifestSignature = sig.status;
      if (sig.status === "invalid") {
        throw new Error(`Manifest signature invalid: ${sig.reason || "verification failed"}`);
      }
      if (sig.status === "unsigned") {
        if (requireSignedManifest) throw new Error("Manifest is not signed (signature required)");
        console.warn("[vexx-learn] WARNING: update manifest is not signed; accepting (strict mode off)");
      }
      signed = sig.status === "valid";
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
          const hash = await sha256File(tmp, { useCache: false });
          if (hash !== remote.sha256[track]) {
            throw new Error(`Checksum mismatch for ${track}`);
          }
        } else if (signed) {
          throw new Error(`Signed manifest has no checksum for ${track}`);
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
      const uiSha = remote.sha256?.uiBundle || remote.sha256?.[uiName];
      if (!uiSha && signed) throw new Error("Signed manifest has no checksum for the UI bundle");
      applyUiBundle(userData, result.remoteAppVersion, zipTmp, uiSha);
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

    const bundledNeedsExe = semverGt(result.remoteAppVersion || "0", appVersion);
    if (bundledNeedsExe && isGitHubConfigured(cfg)) {
      try {
        const rel = await fetchGitHubAppRelease(cfg);
        if (rel?.downloadUrl && rel.version) {
          result.appUpdateUrl = rel.downloadUrl;
          const sync = await ensurePortableExe({ userData, cfg, rel, remote, signed, requireSignedManifest });
          if (sync.skipped) {
            result.appDownloadSkipped = sync.skipped;
            result.appUpdateAvailable = true;
          } else {
            result.appDownloaded = true;
            result.appLocalPath = sync.path;
            if (!result.message || result.message === "courses_up_to_date") {
              result.message = "app_downloaded";
            } else if (result.coursesUpdated) {
              result.message = "courses_and_app";
            }
          }
        } else if (bundledNeedsExe && !rel?.downloadUrl) {
          result.appUpdateAvailable = true;
          if (!result.message || result.message === "courses_up_to_date") {
            result.message = "no_app_release";
          }
        }
      } catch (dlErr) {
        console.warn("[vexx-learn] portable download:", dlErr.message);
        result.appUpdateAvailable = true;
        if (!result.error) result.error = dlErr.message;
      }
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

const SAFE_VERSION = /^[0-9A-Za-z][0-9A-Za-z.+_-]{0,39}$/;
const PENDING_DIR = "pending-updates";

export function pendingUpdatesDir(userData) {
  return join(userData, PENDING_DIR);
}

/**
 * Downloads (or re-validates) the portable exe for `rel` into <userData>/pending-updates and records it as pending.
 * Hash rules (S4):
 *  - manifest has portableSha256 -> the file is hashed after download (into a .part file) and again whenever an
 *    existing file is reused; a wrong sum deletes the file and aborts with an error. Nothing wrong is ever left behind.
 *  - manifest is SIGNED (or strict mode) -> portableSha256 is REQUIRED; without it the exe is not downloaded at all.
 *    The signed manifest's appVersion must also equal the release version the hash was computed for.
 *  - unsigned manifest without a hash (old publishing flow, 0.2.11-compatible) -> accepted with a warning.
 * Returns { path } on success or { skipped: reason } when the exe was deliberately not downloaded.
 */
async function ensurePortableExe({ userData, cfg, rel, remote, signed, requireSignedManifest }) {
  const rawSha = remote.portableSha256;
  const expected = typeof rawSha === "string" && /^[0-9a-f]{64}$/i.test(rawSha) ? rawSha.toLowerCase() : null;
  if (rawSha && !expected) throw new Error("portableSha256 in manifest is malformed");
  if (!SAFE_VERSION.test(String(rel.version))) throw new Error("Release version has unexpected characters");
  if (!isAllowedUpdateBaseUrl(rel.downloadUrl, cfg)) {
    throw new Error("Release asset URL is not inside the configured GitHub repository");
  }
  const hashRequired = signed || requireSignedManifest;
  if (hashRequired && !expected) {
    console.warn("[vexx-learn] signed manifest has no portableSha256 - exe download refused");
    return { skipped: "no_portable_sha256" };
  }
  if (hashRequired && remote.appVersion && String(remote.appVersion) !== String(rel.version)) {
    console.warn("[vexx-learn] release version differs from signed manifest appVersion - exe download refused");
    return { skipped: "version_mismatch" };
  }
  if (!expected) {
    console.warn("[vexx-learn] WARNING: manifest has no portableSha256; the exe will NOT be hash-verified");
  }

  const dir = pendingUpdatesDir(userData);
  const dest = join(dir, `Vexx-Learn-Portable-${rel.version}.exe`);
  const part = dest + ".part";
  const pending = loadPendingAppUpdate(userData);
  mkdirSync(dir, { recursive: true });

  let reusable = false;
  if (existsSync(dest)) {
    if (!expected) {
      reusable = true; // legacy flow: nothing to compare against
    } else {
      const trusted =
        pending?.path === dest && pending?.version === rel.version && pending?.sha256 === expected &&
        pending?.size === statSync(dest).size;
      if (trusted || (await sha256File(dest)) === expected) reusable = true;
      else {
        try { rmSync(dest, { force: true }); } catch { /* ignore */ }
        if (pending?.path === dest) clearPendingAppUpdate(userData);
      }
    }
  }

  if (!reusable) {
    try { rmSync(part, { force: true }); } catch { /* ignore */ }
    console.log("[vexx-learn] downloading portable", rel.version);
    try {
      await downloadFile(rel.downloadUrl, part, { checkFinalHost: true });
      if (expected && (await sha256File(part, { useCache: false })) !== expected) throw new Error("Portable exe checksum mismatch");
      renameSync(part, dest);
    } catch (e) {
      try { rmSync(part, { force: true }); } catch { /* ignore */ }
      try { rmSync(dest, { force: true }); } catch { /* ignore */ }
      throw e;
    }
  }

  // housekeeping: drop exes of other versions and leftovers
  try {
    for (const f of readdirSync(dir)) {
      if (join(dir, f) !== dest) rmSync(join(dir, f), { force: true });
    }
  } catch { /* ignore */ }

  const size = statSync(dest).size;
  if (!reusable || pending?.version !== rel.version || (pending?.sha256 ?? null) !== expected || pending?.path !== dest) {
    savePendingAppUpdate(userData, {
      version: rel.version,
      url: rel.downloadUrl,
      path: dest,
      sha256: expected,
      size,
      downloadedAt: new Date().toISOString(),
    });
  }
  return { path: dest };
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
  mkdirSync(dirname(p), { recursive: true });
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

export function clearPendingAppUpdate(userData) {
  try { rmSync(join(userData, "pending-app-update.json"), { force: true }); } catch { /* ignore */ }
}

/** Pending exe info, or null if the file is gone or no longer matches the recorded sha256 (then it is deleted). */
export async function verifyPendingAppUpdate(userData, { useCache = true } = {}) {
  const pending = loadPendingAppUpdate(userData);
  if (!pending) return null;
  if (!pending.path || !existsSync(pending.path)) {
    clearPendingAppUpdate(userData);
    return null;
  }
  if (pending.sha256 && (await sha256File(pending.path, { useCache })) !== String(pending.sha256).toLowerCase()) {
    console.warn("[vexx-learn] pending exe no longer matches its recorded sha256 - deleted");
    try { rmSync(pending.path, { force: true }); } catch { /* ignore */ }
    clearPendingAppUpdate(userData);
    return null;
  }
  return pending;
}

/**
 * Gate for shell:open-path. Anything inside <userData>/pending-updates may only be opened if it is exactly the
 * recorded pending exe AND (when a sha256 was recorded) still hashes to it right now.
 */
export async function canOpenPath(userData, filePath) {
  if (!isPathInsideRoots(filePath, [pendingUpdatesDir(userData)])) return { ok: true };
  // NO cache here: the exe is re-hashed (streamed, async) right before it is launched.
  const pending = await verifyPendingAppUpdate(userData, { useCache: false });
  if (!pending) return { ok: false, reason: "no verified pending update (file missing or checksum mismatch)" };
  if (resolve(pending.path).toLowerCase() !== resolve(String(filePath)).toLowerCase()) {
    return { ok: false, reason: "not the recorded pending update file" };
  }
  return { ok: true };
}
