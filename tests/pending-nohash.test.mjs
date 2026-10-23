import test from "node:test";
import assert from "node:assert/strict";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { canOpenPath, loadPendingAppUpdate, pendingUpdatesDir, savePendingAppUpdate, verifyPendingAppUpdate } from "../electron/update.mjs";
import { REQUIRE_SIGNED_MANIFEST } from "../electron/ota-public-key.mjs";

function setup() {
  const userData = mkdtempSync(join(tmpdir(), "vexx-nohash-"));
  const dir = pendingUpdatesDir(userData);
  mkdirSync(dir, { recursive: true });
  const exe = join(dir, "Vexx-Learn-Portable-9.9.9.exe");
  writeFileSync(exe, "unverifiable exe");
  savePendingAppUpdate(userData, { version: "9.9.9", url: "https://x", path: exe, sha256: null, size: 16 });
  return { userData, exe };
}
async function withWarnings(fn) {
  const seen = [];
  const orig = console.warn;
  console.warn = (...a) => seen.push(a.join(" "));
  try {
    return { result: await fn(), seen };
  } finally {
    console.warn = orig;
  }
}

test("pending without sha256, SOFT mode (REQUIRE_SIGNED_MANIFEST=false, the 0.2.12 default): kept, with a warning; may be opened", async () => {
  assert.equal(REQUIRE_SIGNED_MANIFEST, false, "this test documents the 0.2.12 default");
  const { userData, exe } = setup();
  const poll = await withWarnings(() => verifyPendingAppUpdate(userData)); // default mode = the constant
  assert.ok(poll.result);
  assert.ok(poll.seen.some((m) => /no sha256/.test(m)), "warns");
  assert.equal(existsSync(exe), true);
  assert.ok(loadPendingAppUpdate(userData));
  const open = await withWarnings(() => canOpenPath(userData, exe, { requireHash: false }));
  assert.equal(open.result.ok, true);
  assert.equal(existsSync(exe), true);
  rmSync(userData, { recursive: true, force: true });
});

test("pending without sha256, STRICT mode (requireHash injected): deleted, pending cleared, open-path refused", async () => {
  // poll path
  let { userData, exe } = setup();
  const poll = await withWarnings(() => verifyPendingAppUpdate(userData, { requireHash: true }));
  assert.equal(poll.result, null);
  assert.ok(poll.seen.some((m) => /deleted/.test(m)));
  assert.equal(existsSync(exe), false);
  assert.equal(loadPendingAppUpdate(userData), null);
  rmSync(userData, { recursive: true, force: true });

  // launch gate
  ({ userData, exe } = setup());
  const gate = await withWarnings(() => canOpenPath(userData, exe, { requireHash: true }));
  assert.equal(gate.result.ok, false);
  assert.equal(existsSync(exe), false, "file deleted");
  assert.equal(loadPendingAppUpdate(userData), null, "pending cleared");
  assert.equal(existsSync(join(userData, "pending-app-update.json")), false);
  rmSync(userData, { recursive: true, force: true });
});

test("pending WITH sha256 is unaffected by the requireHash switch (hash check still applies)", async () => {
  const { userData, exe } = setup();
  const { createHash } = await import("node:crypto");
  const sha = createHash("sha256").update(readFileSync(exe)).digest("hex");
  savePendingAppUpdate(userData, { version: "9.9.9", url: "https://x", path: exe, sha256: sha, size: 16 });
  assert.ok(await verifyPendingAppUpdate(userData, { requireHash: true }));
  assert.equal((await canOpenPath(userData, exe, { requireHash: true })).ok, true);
  rmSync(userData, { recursive: true, force: true });
});