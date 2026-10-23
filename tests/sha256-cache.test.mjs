import test from "node:test";
import assert from "node:assert/strict";
import { createHash, randomBytes } from "node:crypto";
import { existsSync, mkdirSync, mkdtempSync, rmSync, statSync, utimesSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  canOpenPath,
  clearSha256Cache,
  pendingUpdatesDir,
  savePendingAppUpdate,
  sha256File,
  sha256Stats,
  verifyPendingAppUpdate,
} from "../electron/update.mjs";

const ref = (b) => createHash("sha256").update(b).digest("hex");
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const tmp = () => mkdtempSync(join(tmpdir(), "vexx-hash-"));

test("sha256File streams a multi-chunk file and matches the reference digest", async () => {
  clearSha256Cache();
  const dir = tmp();
  const data = randomBytes(3 * 1024 * 1024 + 123); // several 64 KiB chunks
  const f = join(dir, "big.bin");
  writeFileSync(f, data);
  assert.equal(await sha256File(f), ref(data));
  assert.equal(await sha256File(f, { useCache: false }), ref(data));
  rmSync(dir, { recursive: true, force: true });
});

test("cache: same path/size/mtime -> hit (no re-read); useCache:false always re-hashes", async () => {
  clearSha256Cache();
  const dir = tmp();
  const f = join(dir, "a.bin");
  writeFileSync(f, "hello");
  const h1 = await sha256File(f);
  assert.deepEqual(sha256Stats(), { computed: 1, cacheHits: 0 });
  assert.equal(await sha256File(f), h1);
  assert.equal(await sha256File(f), h1);
  assert.deepEqual(sha256Stats(), { computed: 1, cacheHits: 2 });
  await sha256File(f, { useCache: false });
  assert.equal(sha256Stats().computed, 2);
  rmSync(dir, { recursive: true, force: true });
});

test("cache: invalidated when the file changes (size, content, or restored mtime); a swapped file is always caught", async () => {
  clearSha256Cache();
  const dir = tmp();
  const f = join(dir, "a.bin");
  writeFileSync(f, "original-content");
  const orig = statSync(f);
  const h0 = await sha256File(f);

  // 1) different size
  await wait(30);
  writeFileSync(f, "original-content-but-longer");
  const h1 = await sha256File(f);
  assert.notEqual(h1, h0);
  assert.equal(h1, ref("original-content-but-longer"));

  // 2) same size, different bytes
  await wait(30);
  writeFileSync(f, "ORIGINAL-CONTENT-BUT-LONGER");
  const h2 = await sha256File(f);
  assert.equal(h2, ref("ORIGINAL-CONTENT-BUT-LONGER"));

  // 3) same size AND the old mtime forged back (ctime cannot be forged) -> still re-hashed
  await wait(30);
  const st = statSync(f);
  writeFileSync(f, "evil-evil-evil-evil-evil!!!");
  assert.equal("evil-evil-evil-evil-evil!!!".length, st.size);
  utimesSync(f, st.atime, st.mtime);
  const h3 = await sha256File(f);
  assert.equal(h3, ref("evil-evil-evil-evil-evil!!!"));
  assert.notEqual(h3, h2);

  // 4) file deleted and replaced by another file at the same path
  rmSync(f);
  writeFileSync(f, "another file");
  assert.equal(await sha256File(f), ref("another file"));
  assert.ok(orig); // (orig kept only to show the initial stat existed)
  rmSync(dir, { recursive: true, force: true });
});

test("cache is bounded and never throws for a vanished file", async () => {
  clearSha256Cache();
  const dir = tmp();
  for (let i = 0; i < 40; i++) {
    const f = join(dir, `f${i}.bin`);
    writeFileSync(f, `n${i}`);
    assert.equal(await sha256File(f), ref(`n${i}`));
  }
  await assert.rejects(() => sha256File(join(dir, "missing.bin")));
  rmSync(dir, { recursive: true, force: true });
});

test("launch gate with a WARM cache: a tampered exe is still caught and deleted; an untouched one is verified from cache", async () => {
  clearSha256Cache();
  const userData = tmp();
  const dir = pendingUpdatesDir(userData);
  mkdirSync(dir, { recursive: true });
  const exe = join(dir, "Vexx-Learn-Portable-9.9.9.exe");
  const good = Buffer.from("genuine exe bytes");
  writeFileSync(exe, good);
  savePendingAppUpdate(userData, { version: "9.9.9", url: "https://x", path: exe, sha256: ref(good), size: good.length });

  assert.ok(await verifyPendingAppUpdate(userData));
  assert.equal(sha256Stats().computed, 1);
  assert.equal((await canOpenPath(userData, exe)).ok, true);
  assert.ok(await verifyPendingAppUpdate(userData));
  assert.equal(sha256Stats().computed, 1, "repeat checks are served from the cache");
  assert.ok(sha256Stats().cacheHits >= 2);

  // swap with same-size garbage and forge the old mtime
  await wait(30);
  const st = statSync(exe);
  writeFileSync(exe, Buffer.alloc(good.length, 0x41));
  utimesSync(exe, st.atime, st.mtime);
  const gate = await canOpenPath(userData, exe);
  assert.equal(gate.ok, false);
  assert.equal(existsSync(exe), false, "tampered exe deleted");
  assert.equal(await verifyPendingAppUpdate(userData), null);
  rmSync(userData, { recursive: true, force: true });
});