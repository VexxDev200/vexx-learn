import test from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { loadMain } from "./helpers/loadMain.mjs";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");

test("main window: sandbox + contextIsolation on, nodeIntegration off, preload is the .cjs bridge", async () => {
  const m = await loadMain();
  try {
    for (let i = 0; i < 40 && m.windows.length === 0; i++) await new Promise((r) => setTimeout(r, 50));
    assert.equal(m.windows.length, 1, "createWindow must have run");
    const wp = m.windows[0].options.webPreferences;
    assert.equal(wp.sandbox, true);
    assert.equal(wp.contextIsolation, true);
    assert.equal(wp.nodeIntegration, false);
    assert.ok(!("nodeIntegrationInWorker" in wp) && !("webSecurity" in wp) && !("allowRunningInsecureContent" in wp), "no insecure overrides");
    assert.ok(wp.preload.endsWith("preload.cjs") && existsSync(wp.preload));
  } finally {
    m.restore();
  }
});

test("preload.cjs is sandbox-compatible: only require('electron'), no Node globals", () => {
  const src = readFileSync(join(ROOT, "electron", "preload.cjs"), "utf8").replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");
  const requires = [...src.matchAll(/require\(\s*([^)]*)\)/g)].map((x) => x[1].trim());
  assert.ok(requires.length >= 1);
  for (const r of requires) assert.match(r, /^["']electron["']$/, `sandboxed preload may only require electron, got ${r}`);
  const electronImports = src.match(/const\s*\{([^}]*)\}\s*=\s*require\(\s*["']electron["']\s*\)/);
  assert.ok(electronImports, "destructured electron import expected");
  for (const name of electronImports[1].split(",").map((s) => s.trim())) {
    assert.ok(["contextBridge", "ipcRenderer", "webFrame"].includes(name), `${name} is not available in a sandboxed preload`);
  }
  for (const bad of [/\bprocess\./, /\b__dirname\b/, /\b__filename\b/, /\bBuffer\b/, /\bimport\s/, /\bfs\b/, /child_process/]) {
    assert.ok(!bad.test(src), `preload must not use ${bad}`);
  }
});