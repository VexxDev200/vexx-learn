/**
 * Content-Security-Policy for the renderer (Round 2 / S5). Pure module (no electron import) so it is unit-testable and
 * can be used by vite.config.ts to inject a <meta http-equiv="Content-Security-Policy"> into the BUILT index.html.
 * (A meta tag is used because the UI is loaded from file:// and from OTA-delivered dist folders, where response
 * headers are not available. Dev mode (vite dev server) is intentionally not covered: HMR needs inline scripts.)
 *
 * What the app really needs (verified by building and running the UI under this policy, see AUDIT.md section 12):
 *  - its own bundle: script-src 'self'  (NO 'unsafe-inline', NO 'unsafe-eval');
 *  - @monaco-editor/react loads Monaco from cdn.jsdelivr.net (AMD loader, editor CSS, codicon font, workers):
 *      script-src / style-src / font-src / connect-src for that ONE host, worker-src blob: (Monaco starts its worker from a
 *      blob that importScripts() the CDN worker);
 *  - Google Fonts (index.html): style-src fonts.googleapis.com, font-src fonts.gstatic.com;
 *  - style-src 'unsafe-inline': React inline style attributes and the <style> tags Monaco injects. Style-only; no script.
 * Known residual risk: Monaco code is fetched from a CDN and runs in the renderer that holds the preload bridge.
 * The proper fix (bundle monaco-editor locally, then drop the CDN host from the policy) is tracked in AUDIT.md.
 */
export const MONACO_CDN = "https://cdn.jsdelivr.net";

export const CSP_DIRECTIVES = Object.freeze({
  "default-src": ["'self'"],
  "script-src": ["'self'", MONACO_CDN],
  "style-src": ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com", MONACO_CDN],
  "font-src": ["'self'", "data:", "https://fonts.gstatic.com", MONACO_CDN],
  "img-src": ["'self'", "data:", "blob:"],
  "worker-src": ["'self'", "blob:"],
  "connect-src": ["'self'", MONACO_CDN],
  "object-src": ["'none'"],
  "base-uri": ["'none'"],
  "form-action": ["'none'"],
  "frame-src": ["'none'"],
});

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
