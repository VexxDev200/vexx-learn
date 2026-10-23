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

const IN_GIT = spawnSync("git", ["rev-parse", "--is-inside-work-tree"], { encoding: "utf8" }).stdout.trim() === "true";

test("local config / env files are git-ignored; the example template is secret-free", () => {
  const ignore = readFileSync(".gitignore", "utf8").split(/\r?\n/).map((l) => l.trim());
  for (const line of ["update.config.json", ".env", ".env.*", "!.env.example"]) {
    assert.ok(ignore.includes(line), `.gitignore lists ${line}`);
  }
  const ex = JSON.parse(readFileSync("update.config.example.json", "utf8"));
  assert.deepEqual(Object.keys(ex).sort(), ["branch", "githubOwner", "githubRepo", "portableAssetName", "updatesPath"]);
  assert.equal(isGitHubConfigured(ex), false, "placeholder owner = OTA off, never points at a random account");
  assert.doesNotMatch(JSON.stringify(ex), /token|secret|password|authorization|ghp_|github_pat_/i);
});

// Explicit SKIP (not a silent green pass) when there is no git work tree, e.g. a source tarball
test("update.config.json and .env files are NOT tracked by git", { skip: IN_GIT ? false : "not inside a git work tree - tracking cannot be checked" }, () => {
  const ls = (...p) => spawnSync("git", ["ls-files", "--", ...p], { encoding: "utf8" });
  const a = ls("update.config.json");
  assert.equal(a.status, 0, "git ls-files must work: " + a.stderr);
  assert.equal(a.stdout.trim(), "", "update.config.json must not be tracked");
  const b = ls(".env", ".env.*", "**/.env", "**/.env.*");
  assert.equal(b.status, 0);
  const tracked = b.stdout.split(/\r?\n/).filter((x) => x && !/\.env\.example$/.test(x));
  assert.deepEqual(tracked, [], ".env files must not be tracked");
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