import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "fs";
import { join } from "path";
import { spawnSync } from "child_process";
import { createHash } from "crypto";

import { semverGt } from "./portable-sync.mjs";

export function appUiDir(userData) {
  return join(userData, "app-ui");
}

export function activeUiMetaPath(userData) {
  return join(appUiDir(userData), "active.json");
}

export function getLocalUiVersion(userData, bundledVersion) {
  const bundled = bundledVersion || "0.0.0";
  const p = activeUiMetaPath(userData);
  if (!existsSync(p)) return bundled;
  try {
    const m = JSON.parse(readFileSync(p, "utf8"));
    const cached = m.version || bundled;
    return semverGt(bundled, cached) ? bundled : cached;
  } catch {
    return bundled;
  }
}

export function resolveUiRoot(userData, bundledDistRoot, bundledVersion = "0.0.0") {
  const p = activeUiMetaPath(userData);
  if (existsSync(p)) {
    try {
      const m = JSON.parse(readFileSync(p, "utf8"));
      const cachedVer = m.version || "0.0.0";
      if (semverGt(bundledVersion, cachedVer)) {
        return bundledDistRoot;
      }
      const root = m.path;
      if (root && existsSync(join(root, "index.html"))) return root;
    } catch {
      /* */
    }
  }
  return bundledDistRoot;
}

function sha256File(path) {
  return createHash("sha256").update(readFileSync(path)).digest("hex");
}

function extractZipWin(zipPath, destDir) {
  mkdirSync(destDir, { recursive: true });
  const zip = zipPath.replace(/'/g, "''");
  const dest = destDir.replace(/'/g, "''");
  const ps = `Expand-Archive -LiteralPath '${zip}' -DestinationPath '${dest}' -Force`;
  const r = spawnSync("powershell", ["-NoProfile", "-ExecutionPolicy", "Bypass", "-Command", ps], {
    windowsHide: true,
    encoding: "utf8",
  });
  if (r.status !== 0) {
    throw new Error(r.stderr || r.stdout || "Expand-Archive failed");
  }
}

/** Download zip already done at zipPath — extract and activate. */
export function applyUiBundle(userData, version, zipPath, expectedSha256) {
  if (expectedSha256) {
    const hash = sha256File(zipPath);
    if (hash !== expectedSha256) throw new Error("UI bundle checksum mismatch");
  }
  const base = appUiDir(userData);
  const target = join(base, `v${version}`);
  if (existsSync(target)) rmSync(target, { recursive: true, force: true });
  mkdirSync(target, { recursive: true });

  if (process.platform === "win32") {
    extractZipWin(zipPath, target);
  } else {
    throw new Error("UI OTA extract is supported on Windows only");
  }

  const uiRoot = resolveExtractedUiRoot(target);

  writeFileSync(
    activeUiMetaPath(userData),
    JSON.stringify({ version, path: uiRoot, updatedAt: new Date().toISOString() }, null, 2),
    "utf8"
  );
  return uiRoot;
}

function resolveExtractedUiRoot(target) {
  if (existsSync(join(target, "index.html"))) return target;
  const nested = join(target, "dist");
  if (existsSync(join(nested, "index.html"))) return nested;
  throw new Error("UI bundle missing index.html");
}
