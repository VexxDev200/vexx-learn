import test from "node:test";
import assert from "node:assert/strict";
import { createHash, generateKeyPairSync } from "node:crypto";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { signManifest } from "../electron/manifest-verify.mjs";
import { createDraft, publishDraft, uploadExe, verifyPushedManifest, verifyTagAtCommit } from "../scripts/release-flow.mjs";

const sha = (s) => createHash("sha256").update(s).digest("hex");
const { publicKey, privateKey } = generateKeyPairSync("ed25519");
const PUB = publicKey.export({ type: "spki", format: "pem" }).toString();
const PRIV = privateKey.export({ type: "pkcs8", format: "pem" }).toString();
const HEAD = "a".repeat(40);
const OTHER = "b".repeat(40);

const signedText = JSON.stringify(signManifest({ coursesVersion: "1", appVersion: "9.9.9", uiBundle: null, tracks: [], portableSha256: sha("exe") }, PRIV));
function local(text) {
  const dir = mkdtempSync(join(tmpdir(), "vexx-flow-"));
  const p = join(dir, "manifest.json");
  writeFileSync(p, text);
  return { dir, p };
}
/** git mock: remote = sha origin/main points to; committed = manifest text in HEAD */
function gitMock({ remote = HEAD, committed = signedText, tagLines = null } = {}) {
  const calls = [];
  const git = (args) => {
    calls.push(args.join(" "));
    if (args[0] === "rev-parse") return { ok: true, out: HEAD + "\n" };
    if (args[0] === "ls-remote" && args[2] === "refs/heads/main") return { ok: true, out: `${remote}\trefs/heads/main\n` };
    if (args[0] === "ls-remote") return { ok: true, out: tagLines ?? `${HEAD}\trefs/tags/v9.9.9\n` };
    if (args[0] === "show") return committed === null ? { ok: false, out: "fatal: path not in HEAD" } : { ok: true, out: committed };
    return { ok: false, out: "unexpected " + args.join(" ") };
  };
  return { git, calls };
}
/** gh mock with a tiny release state machine */
function ghMock(initial = { exists: false, draft: true }) {
  const state = { ...initial, calls: [], uploaded: false, published: false };
  const gh = (args) => {
    state.calls.push(args);
    const [a, b] = args;
    if (a === "release" && b === "view") return state.exists ? { ok: true, out: JSON.stringify({ isDraft: state.draft }) } : { ok: false, out: "release not found" };
    if (a === "release" && b === "create") { state.exists = true; state.draft = args.includes("--draft"); return { ok: true, out: "" }; }
    if (a === "release" && b === "upload") { state.uploaded = true; return { ok: true, out: "" }; }
    if (a === "release" && b === "edit") { state.published = args.includes("--draft=false"); state.draft = !state.published; return { ok: true, out: "" }; }
    return { ok: false, out: "unexpected" };
  };
  return { gh, state };
}
const names = (state) => state.calls.map((c) => c.slice(0, 2).join(" "));

test("draft: creates a DRAFT release with no tag push (--draft, --target main, no --verify-tag / --tag)", () => {
  const { gh, state } = ghMock();
  const r = createDraft({ gh, repo: "o/r", tag: "v9.9.9", version: "9.9.9" });
  assert.equal(r.ok, true);
  const create = state.calls.find((c) => c[1] === "create");
  assert.ok(create.includes("--draft"));
  assert.deepEqual(create.slice(create.indexOf("--target"), create.indexOf("--target") + 2), ["--target", "main"]);
  assert.ok(!create.includes("--verify-tag") && !create.includes("--tag"));
  assert.equal(state.published, false);
});

test("draft/upload refuse to touch an already PUBLISHED release", () => {
  const { gh, state } = ghMock({ exists: true, draft: false });
  assert.equal(createDraft({ gh, repo: "o/r", tag: "v9.9.9", version: "9.9.9" }).ok, false);
  assert.equal(uploadExe({ gh, repo: "o/r", tag: "v9.9.9", exePath: "x.exe" }).ok, false);
  assert.equal(state.uploaded, false);
  assert.ok(!names(state).includes("release create") && !names(state).includes("release upload"));
});

test("upload goes to the existing draft; without a draft it refuses", () => {
  const none = ghMock();
  assert.equal(uploadExe({ gh: none.gh, repo: "o/r", tag: "v9.9.9", exePath: "x.exe" }).ok, false);
  const d = ghMock({ exists: true, draft: true });
  assert.equal(uploadExe({ gh: d.gh, repo: "o/r", tag: "v9.9.9", exePath: "x.exe" }).ok, true);
  assert.equal(d.state.uploaded, true);
});

test("verifyPushedManifest: main == HEAD and committed manifest == local signed manifest -> ok (CRLF-insensitive)", () => {
  const l = local(signedText.replace(/\n/g, "\r\n"));
  const { git } = gitMock();
  const r = verifyPushedManifest({ git, localManifestPath: l.p, publicKeyPem: PUB });
  assert.equal(r.ok, true);
  assert.equal(r.headSha, HEAD);
  rmSync(l.dir, { recursive: true, force: true });
});

test("verifyPushedManifest: REFUSES when main differs from the local signed manifest", () => {
  const l = local(signedText);
  const otherManifest = JSON.stringify(signManifest({ coursesVersion: "2", appVersion: "9.9.9", uiBundle: null, tracks: [], portableSha256: sha("exe") }, PRIV));
  let r = verifyPushedManifest({ git: gitMock({ committed: otherManifest }).git, localManifestPath: l.p, publicKeyPem: PUB });
  assert.equal(r.ok, false);
  assert.match(r.reason, /differs from the local signed manifest/);
  // origin/main is not the local HEAD (push did not happen / main moved)
  r = verifyPushedManifest({ git: gitMock({ remote: OTHER }).git, localManifestPath: l.p, publicKeyPem: PUB });
  assert.equal(r.ok, false);
  assert.match(r.reason, /not the local HEAD/);
  // manifest not committed at all
  r = verifyPushedManifest({ git: gitMock({ committed: null }).git, localManifestPath: l.p, publicKeyPem: PUB });
  assert.equal(r.ok, false);
  rmSync(l.dir, { recursive: true, force: true });
});

test("verifyPushedManifest: identical but UNSIGNED/forged manifest on main is refused", () => {
  const unsigned = JSON.stringify({ coursesVersion: "1", appVersion: "9.9.9", uiBundle: null, tracks: [] });
  const l = local(unsigned);
  const r = verifyPushedManifest({ git: gitMock({ committed: unsigned }).git, localManifestPath: l.p, publicKeyPem: PUB });
  assert.equal(r.ok, false);
  assert.match(r.reason, /unsigned/);
  rmSync(l.dir, { recursive: true, force: true });
});

test("publish: main mismatch -> refuses, the draft is NOT published (no gh edit call)", () => {
  const l = local(signedText);
  const { gh, state } = ghMock({ exists: true, draft: true });
  const r = publishDraft({ gh, git: gitMock({ remote: OTHER }).git, repo: "o/r", tag: "v9.9.9", localManifestPath: l.p, publicKeyPem: PUB });
  assert.equal(r.ok, false);
  assert.equal(r.published, false);
  assert.equal(state.published, false);
  assert.ok(!names(state).includes("release edit"));
  rmSync(l.dir, { recursive: true, force: true });
});

test("publish: everything matches -> draft=false with --target main, then the tag is checked", () => {
  const l = local(signedText);
  const { gh, state } = ghMock({ exists: true, draft: true });
  const { git, calls } = gitMock();
  const r = publishDraft({ gh, git, repo: "o/r", tag: "v9.9.9", localManifestPath: l.p, publicKeyPem: PUB });
  assert.equal(r.ok, true);
  assert.equal(state.published, true);
  const edit = state.calls.find((c) => c[1] === "edit");
  assert.ok(edit.includes("--draft=false"));
  assert.deepEqual(edit.slice(edit.indexOf("--target"), edit.indexOf("--target") + 2), ["--target", "main"]);
  assert.ok(calls.some((c) => c.startsWith("ls-remote origin refs/tags/v9.9.9")), "tag verified after publishing");
  rmSync(l.dir, { recursive: true, force: true });
});

test("publish: tag ends up on a different commit -> reported loudly as PUBLISHED-but-bad (not silent)", () => {
  const l = local(signedText);
  const { gh } = ghMock({ exists: true, draft: true });
  const r = publishDraft({ gh, git: gitMock({ tagLines: `${OTHER}\trefs/tags/v9.9.9\n` }).git, repo: "o/r", tag: "v9.9.9", localManifestPath: l.p, publicKeyPem: PUB });
  assert.equal(r.ok, false);
  assert.equal(r.published, true);
  assert.match(r.reason, /PUBLISHED/);
  rmSync(l.dir, { recursive: true, force: true });
});

test("publish: no draft (already public / missing) -> refuses without touching anything", () => {
  const l = local(signedText);
  for (const init of [{ exists: false, draft: true }, { exists: true, draft: false }]) {
    const { gh, state } = ghMock(init);
    const r = publishDraft({ gh, git: gitMock().git, repo: "o/r", tag: "v9.9.9", localManifestPath: l.p, publicKeyPem: PUB });
    assert.equal(r.ok, false);
    assert.ok(!names(state).includes("release edit"));
  }
  rmSync(l.dir, { recursive: true, force: true });
});

test("verifyTagAtCommit: annotated tag (peeled ^{}) is compared by the peeled commit; missing tag -> refused", () => {
  assert.equal(verifyTagAtCommit({ git: gitMock({ tagLines: `${OTHER}\trefs/tags/v1\n${HEAD}\trefs/tags/v1^{}\n` }).git, tag: "v1", commitSha: HEAD }).ok, true);
  assert.equal(verifyTagAtCommit({ git: gitMock({ tagLines: "" }).git, tag: "v1", commitSha: HEAD }).ok, false);
});