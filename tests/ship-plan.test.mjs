import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { shipSteps } from "../scripts/ship-plan.mjs";

const idx = (steps, id) => steps.findIndex((s) => s.id === id);
const script = (s) => s.args.find((a) => /\.mjs$/.test(a));

test("ship plan: build -> pack --sign -> verify -> exe upload (gh-release) -> push manifest to main", () => {
  const steps = shipSteps();
  assert.deepEqual(steps.map((s) => s.id), ["build", "pack", "verify", "release", "publish"]);
  const rel = steps[idx(steps, "release")];
  const pub = steps[idx(steps, "publish")];
  assert.match(script(rel), /gh-release\.mjs$/);
  assert.match(script(pub), /publish-ota-git\.mjs$/);
  assert.ok(idx(steps, "release") < idx(steps, "publish"), "exe must be in the Release BEFORE the manifest is pushed to main");
  assert.ok(idx(steps, "build") < idx(steps, "pack"), "exe must exist before its hash is packed");
  assert.ok(steps[idx(steps, "pack")].args.includes("--sign"));
  assert.ok(idx(steps, "pack") < idx(steps, "verify") && idx(steps, "verify") < idx(steps, "release"));
  const v = steps[idx(steps, "verify")].args;
  assert.ok(v.includes("--check") && v.includes("--exe"));
});

test("ship plan: every step runs exactly once and nothing pushes before the upload", () => {
  const steps = shipSteps();
  assert.equal(new Set(steps.map((s) => s.id)).size, steps.length);
  const pushers = steps.filter((s) => /publish-ota-git|git/.test(s.args.join(" ")));
  assert.equal(pushers.length, 1);
  assert.equal(steps.indexOf(pushers[0]), steps.length - 1);
});

test("ship.mjs executes the plan and has no hard-coded step order of its own", () => {
  const src = readFileSync("scripts/ship.mjs", "utf8");
  assert.match(src, /import \{ shipSteps \} from "\.\/ship-plan\.mjs"/);
  assert.match(src, /shipSteps\(\)/);
  assert.doesNotMatch(src, /publish-ota-git|gh-release|pack-updates/, "steps live only in ship-plan.mjs");
});