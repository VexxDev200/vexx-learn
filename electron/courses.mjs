import { existsSync, mkdirSync, readFileSync, writeFileSync } from "fs";
import { join } from "path";

const TRACKS = ["python", "java", "cpp", "csharp"];

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
  let source = "bundled";
  const cachedVer = getLocalCoursesVersion(userData);

  for (const track of TRACKS) {
    const cached = readCachedTrack(userData, track);
    const bundled = readBundledTrack(appRoot, track);
    if (cached && cachedVer > 0) {
      out[track] = cached;
      source = "cache";
    } else if (bundled) {
      out[track] = bundled;
    } else {
      out[track] = [];
    }
  }

  return {
    courses: out,
    coursesVersion: cachedVer,
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
