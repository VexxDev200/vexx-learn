/**
 * Content-Security-Policy for the renderer (Round 2 / S5). No electron import (unit-testable); the only I/O is reading the
 * installed @monaco-editor/loader config once at load time (see MONACO_CDN). Used by vite.config.ts to inject a <meta http-equiv="Content-Security-Policy"> into the BUILT index.html.
 * (A meta tag is used because the UI is loaded from file:// and from OTA-delivered dist folders, where response
 * headers are not available. Dev mode (vite dev server) is intentionally not covered: HMR needs inline scripts.)
 *
 * What the app really needs (verified by building and running the UI under this policy, see AUDIT.md section 12):
 *  - its own bundle: script-src 'self'  (NO 'unsafe-inline', NO 'unsafe-eval');
 *  - @monaco-editor/react loads Monaco from cdn.jsdelivr.net (AMD loader, editor CSS, codicon font, workers):
 *      script-src / style-src / font-src / connect-src for that ONE path prefix (host + /npm/monaco-editor@<exact version>/min/vs/,
 *      NEVER the bare host: any npm/gh package on jsdelivr would otherwise be a CSP bypass), worker-src blob: (Monaco starts its
 *      worker from a blob that importScripts() the CDN worker);
 *  - Google Fonts (index.html): style-src fonts.googleapis.com, font-src fonts.gstatic.com;
 *  - style-src 'unsafe-inline': React inline style attributes and the <style> tags Monaco injects. Style-only; no script.
 * Known residual risk: Monaco code is fetched from a CDN and runs in the renderer that holds the preload bridge.
 * The proper fix (bundle monaco-editor locally, then drop the CDN from the policy) is tracked in AUDIT.md.
 * Note on redirects: CSP path matching only applies to the ORIGINAL request URL; after a redirect only the host is compared.
 * So the path prefix narrows what the page can ask for, it does not constrain where jsdelivr may redirect to (same host).
 */
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

export const MONACO_CDN_HOST = "https://cdn.jsdelivr.net";
const LOADER_VS_RE = /^https:\/\/cdn\.jsdelivr\.net\/npm\/monaco-editor@\d+\.\d+\.\d+\/min\/vs$/;
const DEFAULT_ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");

/** Extract the CDN prefix from the text of @monaco-editor/loader's config (paths.vs), as a CSP path source (trailing "/"). */
export function monacoCdnFromLoaderConfig(configText) {
  const m = /\bvs\s*:\s*(['"])([^'"]+)\1/.exec(configText);
  if (!m || !LOADER_VS_RE.test(m[2])) {
    throw new Error("cannot derive Monaco CDN path from @monaco-editor/loader config (unexpected format): update electron/csp.mjs");
  }
  return m[2] + "/";
}

/** Reads the installed loader, so the CSP follows the version the loader will really request (never hand-edited). */
export function resolveMonacoCdn(root = DEFAULT_ROOT) {
  const file = join(root, "node_modules", "@monaco-editor", "loader", "lib", "cjs", "config", "index.js");
  return monacoCdnFromLoaderConfig(readFileSync(file, "utf8"));
}

export const MONACO_CDN = resolveMonacoCdn();

export function buildDirectives(monacoCdn = MONACO_CDN) {
  return {
    "default-src": ["'self'"],
    "script-src": ["'self'", monacoCdn],
    "style-src": ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com", monacoCdn],
    "font-src": ["'self'", "data:", "https://fonts.gstatic.com", monacoCdn],
    "img-src": ["'self'", "data:", "blob:"],
    "worker-src": ["'self'", "blob:"],
    "connect-src": ["'self'", monacoCdn],
    "object-src": ["'none'"],
    "base-uri": ["'none'"],
    "form-action": ["'none'"],
    "frame-src": ["'none'"],
  };
}

export const CSP_DIRECTIVES = Object.freeze(buildDirectives());
export function buildCsp(directives = CSP_DIRECTIVES) {
  return Object.entries(directives)
    .map(([name, values]) => `${name} ${values.join(" ")}`)
    .join("; ");
}

const META_RE = /<meta[^>]+http-equiv=["']Content-Security-Policy["'][^>]*>/i;

/**
 * Insert (or replace) the CSP meta tag: right after <meta charset> (which must stay within the first 1024 bytes), or
 * right after <head>. Either way it comes before every <script>/<link> of the page.
 */
export function injectCsp(html, csp = buildCsp()) {
  const tag = `<meta http-equiv="Content-Security-Policy" content="${csp.replace(/"/g, "&quot;")}" />`;
  if (META_RE.test(html)) return html.replace(META_RE, tag);
  const charset = html.match(/<meta[^>]+charset=[^>]*>/i);
  if (charset) return html.replace(charset[0], (m) => `${m}\n    ${tag}`);
  if (!/<head[^>]*>/i.test(html)) throw new Error("index.html has no <head>");
  return html.replace(/<head[^>]*>/i, (m) => `${m}\n    ${tag}`);
}
