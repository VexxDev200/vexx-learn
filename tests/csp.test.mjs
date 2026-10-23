import test from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, rmSync, existsSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";
import { CSP_DIRECTIVES, MONACO_CDN, buildCsp, injectCsp } from "../electron/csp.mjs";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const SOURCE_HTML = readFileSync(join(ROOT, "index.html"), "utf8");

function parse(csp) {
  const out = {};
  for (const part of csp.split(";")) {
    const [name, ...values] = part.trim().split(/\s+/);
    if (name) out[name] = values;
  }
  return out;
}

test("CSP: no unsafe-eval, no script unsafe-inline, no wildcard / plain-http sources anywhere", () => {
  const parsed = parse(buildCsp());
  for (const [name, values] of Object.entries(parsed)) {
    assert.ok(!values.includes("'unsafe-eval'"), `${name} must not allow unsafe-eval`);
    assert.ok(!values.includes("*"), `${name} must not use *`);
    assert.ok(!values.some((v) => v === "http:" || v === "https:" || v.startsWith("http://")), `${name}: no scheme-wide/http sources`);
  }
  for (const name of ["default-src", "script-src", "worker-src", "connect-src"]) {
    assert.ok(!parsed[name]?.includes("'unsafe-inline'"), `${name} must not allow unsafe-inline`);
  }
});

test("CSP: exact directive set the app needs (Monaco worker blob:, Google Fonts, one CDN host, locked-down rest)", () => {
  const p = parse(buildCsp());
  assert.deepEqual(p["default-src"], ["'self'"]);
  assert.deepEqual(p["script-src"], ["'self'", MONACO_CDN]);
  assert.deepEqual(p["worker-src"], ["'self'", "blob:"]); // Monaco starts its worker from a blob: URL
  assert.ok(p["style-src"].includes("'unsafe-inline'")); // React style attributes + <style> injected by Monaco (style only)
  assert.ok(p["style-src"].includes("https://fonts.googleapis.com"));
  assert.ok(p["font-src"].includes("https://fonts.gstatic.com") && p["font-src"].includes("data:")); // codicon font is a data: URI
  assert.deepEqual(p["object-src"], ["'none'"]);
  assert.deepEqual(p["base-uri"], ["'none'"]);
  assert.deepEqual(p["form-action"], ["'none'"]);
  assert.deepEqual(p["frame-src"], ["'none'"]);
  // The only remote hosts that appear at all:
  const hosts = new Set(Object.values(p).flat().filter((v) => v.startsWith("https://")));
  assert.deepEqual([...hosts].sort(), ["https://cdn.jsdelivr.net", "https://fonts.googleapis.com", "https://fonts.gstatic.com"]);
});

test("CSP host for Monaco matches the default CDN of the installed @monaco-editor/loader", () => {
  const f = join(ROOT, "node_modules", "@monaco-editor", "loader", "lib", "cjs", "config", "index.js");
  if (!existsSync(f)) return; // dependency not installed in this environment
  assert.ok(readFileSync(f, "utf8").includes(MONACO_CDN), "loader default CDN host changed - update csp.mjs");
});

test("injectCsp: meta goes right after <meta charset>, before any script/link, and is idempotent", () => {
  const out = injectCsp(SOURCE_HTML);
  const metaAt = out.indexOf('http-equiv="Content-Security-Policy"');
  assert.ok(metaAt > out.indexOf("charset"));
  assert.ok(metaAt < out.indexOf("<script"));
  assert.ok(metaAt < out.indexOf("<link"));
  assert.ok(out.includes(buildCsp()));
  assert.equal(injectCsp(out), out);
  assert.equal(out.match(/Content-Security-Policy/g).length, 1);
  assert.throws(() => injectCsp("<div>no head</div>"));
});

test("source index.html stays CSP-free (vite dev needs inline HMR scripts) and vite.config.ts injects it for build only", () => {
  assert.ok(!/Content-Security-Policy/i.test(SOURCE_HTML));
  const cfg = readFileSync(join(ROOT, "vite.config.ts"), "utf8");
  assert.ok(cfg.includes("injectCsp") && /apply:\s*"build"/.test(cfg));
});

test("real vite build: dist/index.html carries the exact CSP and is compatible with it (no inline script / foreign hosts)", () => {
  const out = mkdtempSync(join(tmpdir(), "vl-csp-build-"));
  try {
    const r = spawnSync(process.execPath, [join(ROOT, "node_modules", "vite", "bin", "vite.js"), "build", "--outDir", out, "--emptyOutDir"], {
      cwd: ROOT,
      encoding: "utf8",
      timeout: 120000,
    });
    assert.equal(r.status, 0, r.stdout + r.stderr);
    const html = readFileSync(join(out, "index.html"), "utf8");
    const m = html.match(/<meta http-equiv="Content-Security-Policy" content="([^"]*)"/);
    assert.ok(m, "built index.html must contain the CSP meta");
    assert.equal(m[1].replace(/&quot;/g, '"'), buildCsp());
    assert.ok(html.indexOf(m[0]) < html.indexOf("<script"), "CSP before the first script");
    // no inline <script> bodies (they would be blocked by script-src without unsafe-inline)
    for (const s of html.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script>/gi)) {
      assert.match(s[1], /\bsrc=/, "script without src (inline) found");
      assert.equal(s[2].trim(), "");
    }
    assert.ok(!/\son\w+\s*=/i.test(html), "no inline event handlers");
    // every remote reference in the page must be covered by the policy
    const allowedHosts = new Set(Object.values(parse(buildCsp())).flat().filter((v) => v.startsWith("https://")));
    for (const u of html.matchAll(/(?:src|href)=["'](https?:\/\/[^"']+)["']/g)) {
      assert.ok(allowedHosts.has(new URL(u[1]).origin), `host not allowed by CSP: ${u[1]}`);
    }
  } finally {
    rmSync(out, { recursive: true, force: true });
  }
});