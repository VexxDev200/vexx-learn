/**
 * Security policy helpers for IPC input coming from the renderer.
 * Pure functions, no electron imports (unit-testable with node:test).
 */
import { realpathSync } from "fs";
import { isAbsolute, relative, resolve, sep } from "path";

/** Hosts the app legitimately talks to for OTA (GitHub raw content / releases). */
export const UPDATE_HOST_ALLOWLIST = Object.freeze([
  "raw.githubusercontent.com",
  "github.com",
  "objects.githubusercontent.com",
]);

const PLACEHOLDER_OWNER = "YOUR_GITHUB_USERNAME";

function parseHttps(input) {
  if (typeof input !== "string") return null;
  const s = input.trim();
  if (!s || s.length > 2048 || /[\u0000-\u001f\u007f]/.test(s)) return null;
  let u;
  try {
    u = new URL(s);
  } catch {
    return null;
  }
  if (u.protocol !== "https:") return null;
  if (!u.hostname) return null;
  if (u.username || u.password) return null;
  return u;
}

/** shell:open - only plain https:// URLs (no credentials, no other schemes). */
export function isAllowedExternalUrl(url) {
  return parseHttps(url) !== null;
}

/**
 * settings:set updateBaseUrl - empty string (= use configured default) or an https URL on an
 * allowlisted GitHub host whose path stays inside the app's configured GitHub owner/repo
 * (/<owner>/<repo>/...). The binding applies to EVERY allowlisted host. If no owner/repo is
 * configured, no custom URL is accepted (fail closed). Note: objects.githubusercontent.com
 * asset URLs do not carry owner/repo in their path, so they can never pass this check - which
 * is intended, they are not valid manifest bases anyway.
 */
export function isAllowedUpdateBaseUrl(url, cfg = {}) {
  if (typeof url !== "string") return false;
  if (url.trim() === "") return true;
  const u = parseHttps(url);
  if (!u) return false;
  if (u.port && u.port !== "443") return false;
  const host = u.hostname.toLowerCase();
  if (!UPDATE_HOST_ALLOWLIST.includes(host)) return false;
  const owner = cfg.githubOwner;
  const repo = cfg.githubRepo;
  if (!owner || owner === PLACEHOLDER_OWNER || !repo) return false;
  const prefix = `/${owner}/${repo}/`.toLowerCase();
  const path = (u.pathname.endsWith("/") ? u.pathname : u.pathname + "/").toLowerCase();
  return path.startsWith(prefix);
}

function realOrNull(p) {
  try {
    return realpathSync(resolve(p));
  } catch {
    return null;
  }
}

function isInside(root, target) {
  const rel = relative(root, target);
  if (rel === "") return true;
  if (isAbsolute(rel)) return false;
  return rel !== ".." && !rel.startsWith(".." + sep);
}

/**
 * shell:open-path - the target must exist and, after resolving "..", symlinks and junctions,
 * lie inside one of the allowed roots (also resolved).
 */
export function isPathInsideRoots(target, roots) {
  if (typeof target !== "string" || !target || target.includes("\u0000")) return false;
  const real = realOrNull(target);
  if (!real) return false;
  for (const root of roots || []) {
    if (!root) continue;
    const realRoot = realOrNull(root);
    if (realRoot && isInside(realRoot, real)) return true;
  }
  return false;
}

const SETTINGS_KEYS = {
  theme: (v) => ["default", "midnight", "light", "neon"].includes(v),
  accent: (v) => ["teal", "violet", "amber", "rose", "cyan"].includes(v),
  editorFontSize: (v) => Number.isFinite(v) && v >= 8 && v <= 48,
  autoUpdateCourses: (v) => typeof v === "boolean",
  autoCheckApp: (v) => typeof v === "boolean",
  updateBaseUrl: (v) => typeof v === "string",
  reduceMotion: (v) => typeof v === "boolean",
};

/**
 * settings:set - keep only known keys with valid types; updateBaseUrl must pass
 * isAllowedUpdateBaseUrl(cfg). Returns { patch, rejected }.
 */
export function sanitizeSettingsPatch(patch, cfg = {}) {
  const out = {};
  const rejected = [];
  if (!patch || typeof patch !== "object" || Array.isArray(patch)) return { patch: out, rejected };
  for (const [k, v] of Object.entries(patch)) {
    const check = SETTINGS_KEYS[k];
    if (!check || !check(v)) {
      rejected.push(k);
      continue;
    }
    if (k === "updateBaseUrl" && !isAllowedUpdateBaseUrl(v, cfg)) {
      rejected.push(k);
      continue;
    }
    out[k] = k === "updateBaseUrl" ? v.trim() : v;
  }
  return { patch: out, rejected };
}