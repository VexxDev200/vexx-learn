import test from "node:test";
import assert from "node:assert/strict";
import { mkdirSync, mkdtempSync, symlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { isAllowedExternalUrl, isPathInsideRoots } from "../electron/security-policy.mjs";
import { loadMain } from "./helpers/loadMain.mjs";

test("shell:open policy: https only", () => {
  assert.equal(isAllowedExternalUrl("https://example.com/page?q=1"), true);
  for (const bad of [
    "http://example.com",
    "file:///C:/Windows/System32/calc.exe",
    "javascript:alert(1)",
    "data:text/html,x",
    "ms-msdt:/id PCWDiagnostic",
    "vscode://file/C:/x",
    "\\\\server\\share\\a.exe",
    "C:\\Windows\\System32\\calc.exe",
    "https://user:pw@example.com",
    "",
    null,
    {},
  ]) {
    assert.equal(isAllowedExternalUrl(bad), false, String(bad));
  }
});

function sandbox() {
  const base = mkdtempSync(join(tmpdir(), "vexx-path-test-"));
  const root = join(base, "root");
  const outside = join(base, "outside");
  mkdirSync(join(root, "sub"), { recursive: true });
  mkdirSync(outside, { recursive: true });
  writeFileSync(join(root, "sub", "ok.txt"), "ok");
  writeFileSync(join(outside, "secret.txt"), "no");
  return { base, root, outside };
}

test("shell:open-path policy: inside allowed, outside/traversal/symlink rejected", () => {
  const { root, outside } = sandbox();
  assert.equal(isPathInsideRoots(join(root, "sub", "ok.txt"), [root]), true);
  assert.equal(isPathInsideRoots(join(root, "sub"), [root]), true);
  assert.equal(isPathInsideRoots(join(outside, "secret.txt"), [root]), false, "outside root");
  assert.equal(isPathInsideRoots(join(root, "sub", "..", "..", "outside", "secret.txt"), [root]), false, "../ traversal");
  assert.equal(isPathInsideRoots(join(root, "missing.txt"), [root]), false, "non-existent");
  assert.equal(isPathInsideRoots(root + "-evil", [root]), false, "prefix sibling");
  assert.equal(isPathInsideRoots("", [root]), false);
  assert.equal(isPathInsideRoots(null, [root]), false);
  assert.equal(isPathInsideRoots(join(root, "sub", "ok.txt"), []), false, "no roots");
  assert.equal(isPathInsideRoots(process.platform === "win32" ? "C:\\Windows\\System32\\cmd.exe" : "/bin/sh", [root]), false);
});

test("shell:open-path policy: symlink/junction escaping the root is rejected", (t) => {
  const { root, outside } = sandbox();
  const link = join(root, "escape");
  try {
    symlinkSync(outside, link, process.platform === "win32" ? "junction" : "dir");
  } catch (e) {
    t.skip("cannot create symlink here: " + e.code);
    return;
  }
  assert.equal(isPathInsideRoots(join(link, "secret.txt"), [root]), false);
  assert.equal(isPathInsideRoots(link, [root]), false);
});

test("IPC shell:open only opens https URLs", async () => {
  const m = await loadMain();
  try {
    const open = m.handlers.get("shell:open");
    for (const bad of ["http://example.com", "file:///C:/Windows/System32/calc.exe", "javascript:alert(1)", "C:\\x.exe"]) {
      await open({}, bad);
    }
    assert.deepEqual(m.shellCalls.openExternal, [], "nothing opened for bad URLs");
    await open({}, "https://example.com/docs");
    assert.deepEqual(m.shellCalls.openExternal, ["https://example.com/docs"]);
  } finally {
    m.restore();
  }
});

test("IPC shell:open-path only opens files inside userData / app folders", async () => {
  const m = await loadMain();
  try {
    const openPath = m.handlers.get("shell:open-path");
    const inside = join(m.userData, "pending-updates");
    mkdirSync(inside, { recursive: true });
    const file = join(inside, "Vexx-Learn-Portable-9.9.9.exe");
    writeFileSync(file, "x");
    const { outside } = sandbox();
    const evil = join(outside, "secret.txt");

    const r1 = await openPath({}, evil);
    assert.match(String(r1), /blocked/);
    const r2 = await openPath({}, join(inside, "..", "..", "..", "..", "Windows", "System32", "cmd.exe"));
    assert.match(String(r2), /blocked/);
    const r3 = await openPath({}, "C:\\Windows\\System32\\cmd.exe");
    assert.match(String(r3), /blocked/);
    assert.deepEqual(m.shellCalls.openPath, [], "no blocked path reached shell.openPath");

    const r4 = await openPath({}, file);
    assert.equal(r4, "");
    assert.deepEqual(m.shellCalls.openPath, [file]);
  } finally {
    m.restore();
  }
});