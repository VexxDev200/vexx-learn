import test from "node:test";
import assert from "node:assert/strict";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawnSync } from "node:child_process";
import { ensureUpdateConfig } from "../scripts/ensure-update-config.mjs";
import { githubCoursesBaseUrl, isGitHubConfigured, loadUpdateConfig } from "../electron/update-config.mjs";
import { checkAndApplyUpdates } from "../electron/update.mjs";

const tmp = (p) => mkdtempSync(join(tmpdir(), p));

test("update.config.json is git-ignored and NOT tracked; the example template is tracked-ready and secret-free", () => {
  const ignore = readFileSync(".gitignore", "utf8").split(/\r?\n/).map((l) => l.trim());
  assert.ok(ignore.includes("update.config.json"), ".gitignore lists update.config.json");
  const tracked = spawnSync("git", ["ls-files", "--", "update.config.json"], { encoding: "utf8" }).stdout.trim();
  assert.equal(tracked, "", "update.config.json must not be tracked");
  const ex = JSON.parse(readFileSync("update.config.example.json", "utf8"));
  assert.deepEqual(Object.keys(ex).sort(), ["branch", "githubOwner", "githubRepo", "portableAssetName", "updatesPath"]);
  assert.equal(isGitHubConfigured(ex), false, "placeholder owner = OTA off, never points at a random account");
  assert.doesNotMatch(JSON.stringify(ex), /token|secret|password|authorization|ghp_|github_pat_/i);
});

test("app starts and updater degrades gracefully when update.config.json is missing", async () => {
  const root = tmp("vexx-noconf-");
  const userData = tmp("vexx-noconf-ud-");
  const cfg = loadUpdateConfig(root);
  assert.equal(isGitHubConfigured(cfg), false);
  assert.equal(githubCoursesBaseUrl(cfg), "");
  const res = await checkAndApplyUpdates({ appRoot: root, userData, settings: {}, appVersion: "0.2.11" });
  assert.equal(res.message, "no_update_url");
  assert.equal(res.error, null);
});

test("ensureUpdateConfig: existing file is left completely untouched (not read, not modified)", () => {
  const root = tmp("vexx-ens-exists-");
  const body = '{"githubOwner":"someone","githubRepo":"r","custom":"keep-me"}';
  writeFileSync(join(root, "update.config.json"), body);
  const r = ensureUpdateConfig(root, { GITHUB_REPOSITORY: "other/else" });
  assert.equal(r.action, "exists");
  assert.equal(readFileSync(join(root, "update.config.json"), "utf8"), body);
});

test("ensureUpdateConfig: in CI it is created from GITHUB_REPOSITORY (owner/repo only)", () => {
  const root = tmp("vexx-ens-ci-");
  const r = ensureUpdateConfig(root, { GITHUB_REPOSITORY: "acme/learn" });
  assert.equal(r.action, "from-github-repository");
  const cfg = JSON.parse(readFileSync(join(root, "update.config.json"), "utf8"));
  assert.equal(cfg.githubOwner, "acme");
  assert.equal(cfg.githubRepo, "learn");
  assert.equal(isGitHubConfigured(loadUpdateConfig(root)), true);
  assert.deepEqual(Object.keys(cfg).sort(), ["branch", "githubOwner", "githubRepo", "portableAssetName", "updatesPath"]);
});

test("ensureUpdateConfig: garbage GITHUB_REPOSITORY is ignored; falls back to the example template (OTA off)", () => {
  for (const bad of ["", "no-slash", "a/b/c", "../x/y z"]) {
    const root = tmp("vexx-ens-bad-");
    writeFileSync(join(root, "update.config.example.json"), readFileSync("update.config.example.json"));
    const r = ensureUpdateConfig(root, { GITHUB_REPOSITORY: bad });
    assert.equal(r.action, "from-example", bad);
    assert.equal(isGitHubConfigured(loadUpdateConfig(root)), false);
  }
  // and without the example file it still creates a safe placeholder
  const root = tmp("vexx-ens-noex-");
  assert.equal(ensureUpdateConfig(root, {}).action, "from-example");
  assert.ok(existsSync(join(root, "update.config.json")));
  assert.equal(isGitHubConfigured(loadUpdateConfig(root)), false);
});