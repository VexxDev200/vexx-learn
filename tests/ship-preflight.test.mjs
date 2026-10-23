import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { OTA_COMMIT_PATHS, checkBranchAndTree, checkVersionFree, dirtyOutsideAllowed, preflight } from "../scripts/ship-preflight.mjs";
import { createDraft } from "../scripts/release-flow.mjs";

const TAG = "v9.9.9";

/** git mock: branch, porcelain status, local tag exists?, remote tag output, ls-remote ok? */
function gitMock({ branch = "main", status = "", localTag = false, remoteTags = "", lsOk = true } = {}) {
  const calls = [];
  const git = (args) => {
    calls.push(args.join(" "));
    if (args[0] === "rev-parse" && args[1] === "--abbrev-ref") return { ok: true, out: branch + "\n" };
    if (args[0] === "status") return { ok: true, out: status };
    if (args[0] === "rev-parse" && args.includes("--verify")) return localTag ? { ok: true, out: "abc\n" } : { ok: false, out: "" };
    if (args[0] === "ls-remote") return lsOk ? { ok: true, out: remoteTags } : { ok: false, out: "network down" };
    return { ok: false, out: "unexpected " + args.join(" ") };
  };
  return { git, calls };
}
function ghMock(state) {
  const calls = [];
  const gh = (args) => {
    calls.push(args);
    if (args[1] === "view") {
      if (state === "none") return { ok: false, out: "release not found" };
      if (state === "error") return { ok: false, out: "HTTP 401: bad credentials" };
      return { ok: true, out: JSON.stringify({ isDraft: state === "draft" }) };
    }
    if (args[1] === "create") return { ok: true, out: "" };
    return { ok: false, out: "unexpected" };
  };
  return { gh, calls };
}

test("allowed dirty files: only OTA files, course data and package.json", () => {
  assert.deepEqual(OTA_COMMIT_PATHS, ["release/updates/", "src/content/data/", "package.json"]);
  const ok = " M package.json\n M release/updates/manifest.json\n?? release/updates/app-ui.zip\n M src/content/data/bundle-manifest.json\n";
  assert.deepEqual(dirtyOutsideAllowed(ok), []);
  assert.deepEqual(dirtyOutsideAllowed(" M electron/main.mjs\n"), ["electron/main.mjs"]);
  assert.deepEqual(dirtyOutsideAllowed("?? src/App.tsx\n M package-lock.json\n M scripts/ship.mjs\n"), ["src/App.tsx", "package-lock.json", "scripts/ship.mjs"]);
  assert.deepEqual(dirtyOutsideAllowed("R  old.txt -> release/updates/new.txt\n"), ["old.txt"], "renames check both sides");
  assert.deepEqual(dirtyOutsideAllowed(' M "release/updates/x y.json"\n'), []);
});

test("dirty file in electron/ -> refuse before any action", () => {
  const { git, calls } = gitMock({ status: " M package.json\n M electron/main.mjs\n" });
  const r = checkBranchAndTree({ git });
  assert.equal(r.ok, false);
  assert.match(r.reason, /electron\/main\.mjs/);
  assert.match(r.reason, /Commit or stash/);
  // preflight stops there: it never even asks about tags/releases
  const gm = ghMock("none");
  const p = preflight({ gh: gm.gh, git, repo: "o/r", tag: TAG });
  assert.equal(p.ok, false);
  assert.equal(gm.calls.length, 0);
  assert.ok(!calls.some((c) => c.startsWith("ls-remote")));
});

test("not on main -> refuse; clean tree on main -> ok", () => {
  assert.equal(checkBranchAndTree({ git: gitMock({ branch: "improve/round-1" }).git }).ok, false);
  assert.equal(checkBranchAndTree({ git: gitMock({ status: "" }).git }).ok, true);
});

test("repeat with a PUBLISHED Release for this version -> refuse", () => {
  const r = checkVersionFree({ gh: ghMock("published").gh, git: gitMock().git, repo: "o/r", tag: TAG });
  assert.equal(r.ok, false);
  assert.match(r.reason, /published Release v9\.9\.9 already exists/);
});

test("repeat with a DRAFT for this version -> reused (no second draft is created)", () => {
  const r = checkVersionFree({ gh: ghMock("draft").gh, git: gitMock().git, repo: "o/r", tag: TAG });
  assert.equal(r.ok, true);
  assert.equal(r.reuseDraft, true);
  const gm = ghMock("draft");
  const d = createDraft({ gh: gm.gh, repo: "o/r", tag: TAG, version: "9.9.9" });
  assert.equal(d.ok, true);
  assert.equal(d.reused, true);
  assert.ok(!gm.calls.some((c) => c[1] === "create"), "no second draft");
});

test("existing tag (local or on origin) -> refuse; cannot verify (network/auth error) -> refuse, never assume 'free'", () => {
  assert.equal(checkVersionFree({ gh: ghMock("none").gh, git: gitMock({ localTag: true }).git, repo: "o/r", tag: TAG }).ok, false);
  const remote = checkVersionFree({ gh: ghMock("none").gh, git: gitMock({ remoteTags: "abc\trefs/tags/v9.9.9\n" }).git, repo: "o/r", tag: TAG });
  assert.equal(remote.ok, false);
  assert.match(remote.reason, /on origin/);
  assert.equal(checkVersionFree({ gh: ghMock("none").gh, git: gitMock({ lsOk: false }).git, repo: "o/r", tag: TAG }).ok, false);
  assert.equal(checkVersionFree({ gh: ghMock("error").gh, git: gitMock().git, repo: "o/r", tag: TAG }).ok, false);
});

test("free version: no release, no tag -> ok, nothing to reuse", () => {
  const r = preflight({ gh: ghMock("none").gh, git: gitMock().git, repo: "o/r", tag: TAG });
  assert.equal(r.ok, true);
  assert.equal(r.reuseDraft, false);
});

test("ship never bumps the version; publish-ota-git adds only OTA_COMMIT_PATHS (no electron/, src/App.tsx, scripts/)", () => {
  const ship = readFileSync("scripts/ship.mjs", "utf8");
  assert.doesNotMatch(ship, /bumpPatchVersion|writeFileSync|parts\[2\]/);
  const pub = readFileSync("scripts/publish-ota-git.mjs", "utf8");
  const pubCode = pub.split(/\r?\n/).filter((l) => !l.trim().startsWith("//") && !l.trim().startsWith("*") && !l.trim().startsWith("/*")).join("\n");
  assert.match(pub, /import \{ OTA_COMMIT_PATHS \} from "\.\/ship-preflight\.mjs"/);
  assert.match(pub, /"add", \.\.\.OTA_COMMIT_PATHS/);
  assert.doesNotMatch(pubCode, /electron\/|src\/App\.tsx|scripts\/ship|scripts\/publish/);
  for (const p of OTA_COMMIT_PATHS) assert.ok(!/^(electron|scripts|src\/App)/.test(p));
});