/**
 * Navigation / window-open guards for every webContents (Round 2 / S5.2). The app is a single-page UI: the renderer
 * must never navigate away from the page main.mjs loaded, and must never get a second window. Anything that looks like
 * "open this link" is handed to the OS browser, but ONLY under the same policy as the shell:open IPC (plain https://).
 * Pure module (the `shell` is injected) so it is unit-testable without electron.
 */
import { isAllowedExternalUrl } from "./security-policy.mjs";

function stripHash(url) {
  try {
    const u = new URL(url);
    u.hash = "";
    return u.href;
  } catch {
    return null;
  }
}

/**
 * Decide what to do with a renderer-initiated navigation.
 *  - "allow": same document as the one currently shown (reload / hash change) - nothing to protect;
 *  - "external": a plain https:// URL - blocked in-app, opened in the system browser (shell:open policy);
 *  - "deny": everything else (file:, http:, data:, javascript:, blob:, chrome:, ... and unparsable input).
 */
export function decideNavigation(targetUrl, currentUrl) {
  if (typeof targetUrl !== "string") return "deny";
  const a = stripHash(targetUrl);
  const b = typeof currentUrl === "string" ? stripHash(currentUrl) : null;
  if (a !== null && b !== null && a === b) return "allow";
  if (isAllowedExternalUrl(targetUrl)) return "external";
  return "deny";
}

function openExternalSafely(shell, url) {
  Promise.resolve()
    .then(() => shell.openExternal(url))
    .catch((e) => console.error("[vexx-learn] openExternal failed:", e?.message || e));
}

/** Attach the guards to one webContents (call from app.on("web-contents-created")). */
export function attachNavigationGuards(contents, shell) {
  contents.setWindowOpenHandler(({ url }) => {
    if (isAllowedExternalUrl(url)) openExternalSafely(shell, url);
    return { action: "deny" };
  });

  contents.on("will-navigate", (event, url) => {
    const decision = decideNavigation(url, contents.getURL());
    if (decision === "allow") return;
    event.preventDefault();
    if (decision === "external") openExternalSafely(shell, url);
  });

  // Redirects of the already loaded page are never legitimate for this app; do not open the browser from a redirect.
  contents.on("will-redirect", (event, url) => {
    if (decideNavigation(url, contents.getURL()) !== "allow") event.preventDefault();
  });

  // <webview> would be a second, differently-privileged renderer. The UI never uses it.
  contents.on("will-attach-webview", (event) => event.preventDefault());
}