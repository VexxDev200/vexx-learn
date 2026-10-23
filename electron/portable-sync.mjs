/**
 * New portable.exe ships a higher package.json version — drop stale OTA UI/courses cache.
 */
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "fs";
import { join } from "path";

import { appUiDir } from "./app-ui.mjs";
import { coursesCacheDir } from "./courses.mjs";

function semverGt(a, b) {
  const pa = String(a).split(".").map((x) => parseInt(x, 10) || 0);
  const pb = String(b).split(".").map((x) => parseInt(x, 10) || 0);
  for (let i = 0; i < 3; i++) {
    if ((pa[i] || 0) > (pb[i] || 0)) return true;
    if ((pa[i] || 0) < (pb[i] || 0)) return false;
  }
  return false;
}

function installMetaPath(userData) {
  return join(userData, "vexx-install.json");
}

export function syncPortableUpgrade(userData, bundledVersion) {
  const metaPath = installMetaPath(userData);
  let prev = "";
  try {
    if (existsSync(metaPath)) {
      prev = String(JSON.parse(readFileSync(metaPath, "utf8")).portableVersion || "");
    }
  } catch {
    /* */
  }

  if (prev && semverGt(bundledVersion, prev)) {
    try {
      rmSync(coursesCacheDir(userData), { recursive: true, force: true });
    } catch {
      /* */
    }
    try {
      rmSync(appUiDir(userData), { recursive: true, force: true });
    } catch {
      /* */
    }
    console.log(
      "[vexx-learn] portable upgrade",
      prev,
      "→",
      bundledVersion,
      "— cleared OTA cache"
    );
  }

  mkdirSync(userData, { recursive: true });
  writeFileSync(
    metaPath,
    JSON.stringify({ portableVersion: bundledVersion, updatedAt: new Date().toISOString() }, null, 2),
    "utf8"
  );
}

export { semverGt };
