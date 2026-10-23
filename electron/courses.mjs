import { existsSync, mkdirSync, readFileSync, writeFileSync } from "fs";
import { join } from "path";

export const TRACKS = ["python", "java", "cpp", "csharp", "security"];

export function coursesCacheDir(userData) {
  return join(userData, "courses-cache");
}

export function cacheManifestPath(userData) {
  return join(coursesCacheDir(userData), "manifest.json");
}

export function bundledCoursesDir(appRoot) {
  return join(appRoot, "dist", "content", "data");
}

/** Vite bundles JSON under src/content/data — in dist they're in assets or we copy at build */
export function readBundledTrack(appRoot, track) {
  const candidates = [
    join(appRoot, "dist", "content", "data", `${track}.json`),
    join(appRoot, "src", "content", "data", `${track}.json`),
  ];
  for (const p of candidates) {
    if (existsSync(p)) {
      return JSON.parse(readFileSync(p, "utf8"));
    }
  }
  return null;
}

export function readCachedTrack(userData, track) {
  const p = join(coursesCacheDir(userData), `${track}.json`);
  if (!existsSync(p)) return null;
  try {
    return JSON.parse(readFileSync(p, "utf8"));
  } catch {
    return null;
  }
}

export function getLocalCoursesVersion(userData) {
  const p = cacheManifestPath(userData);
  if (!existsSync(p)) return 0;
  try {
    const m = JSON.parse(readFileSync(p, "utf8"));
    return Number(m.coursesVersion) || 0;
  } catch {
    return 0;
  }
}

export function loadAllCourses(appRoot, userData) {
  const out = {};
  const bundledVer = readBundledCoursesVersion(appRoot);
  const cachedVer = getLocalCoursesVersion(userData);
  /** Use OTA cache only when it is newer than the copy shipped with this app folder. */
  const useCache = cachedVer > 0 && cachedVer > bundledVer;
  const source = useCache ? "cache" : "bundled";
  const effectiveVer = useCache ? cachedVer : bundledVer;

  for (const track of TRACKS) {
    if (useCache) {
      const cached = readCachedTrack(userData, track);
      if (cached?.length) {
        out[track] = cached;
        continue;
      }
    }
    const bundled = readBundledTrack(appRoot, track);
    out[track] = bundled?.length ? bundled : [];
  }

  return {
    courses: out,
    coursesVersion: effectiveVer,
    source,
  };
}

export function writeCoursesCache(userData, manifest, tracksData) {
  const dir = coursesCacheDir(userData);
  mkdirSync(dir, { recursive: true });
  writeFileSync(cacheManifestPath(userData), JSON.stringify(manifest, null, 2), "utf8");
  for (const [track, data] of Object.entries(tracksData)) {
    writeFileSync(join(dir, `${track}.json`), JSON.stringify(data, null, 2), "utf8");
  }
}

export function readBundledCoursesVersion(appRoot) {
  const p = join(appRoot, "src", "content", "data", "bundle-manifest.json");
  const p2 = join(appRoot, "dist", "content", "data", "bundle-manifest.json");
  for (const fp of [p2, p]) {
    if (existsSync(fp)) {
      try {
        const m = JSON.parse(readFileSync(fp, "utf8"));
        return Number(m.coursesVersion) || 0;
      } catch {
        /* */
      }
    }
  }
  return 1;
}
