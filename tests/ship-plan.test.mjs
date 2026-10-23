import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { failureAdvice, runPlan, shipSteps } from "../scripts/ship-plan.mjs";

const ids = (steps) => steps.map((s) => s.id);
const idx = (steps, id) => steps.findIndex((s) => s.id === id);
const script = (s) => s.args.find((a) => /\.mjs$/.test(a));

test("ship plan (draft flow): build, pack --sign, verify, draft, upload, push, publish - publishing the draft is LAST", () => {
  const steps = shipSteps();
  assert.deepEqual(ids(steps), ["build", "pack", "verify", "draft", "upload", "push", "publish"]);
  assert.equal(steps.at(-1).id, "publish");
  assert.match(script(steps[idx(steps, "publish")]), /gh-release\.mjs$/);
  assert.deepEqual(steps[idx(steps, "publish")].args.slice(-1), ["publish"]);
  assert.deepEqual(steps[idx(steps, "draft")].args.slice(-1), ["draft"]);
  assert.deepEqual(steps[idx(steps, "upload")].args.slice(-1), ["upload"]);
  assert.match(script(steps[idx(steps, "push")]), /publish-ota-git\.mjs$/);
  // required relations
  assert.ok(idx(steps, "build") < idx(steps, "pack"), "exe exists before its hash is packed");
  assert.ok(steps[idx(steps, "pack")].args.includes("--sign"));
  assert.ok(idx(steps, "pack") < idx(steps, "verify") && idx(steps, "verify") < idx(steps, "draft"));
  assert.ok(idx(steps, "draft") < idx(steps, "upload"), "draft before upload");
  assert.ok(idx(steps, "upload") < idx(steps, "push"), "exe uploaded BEFORE the manifest is pushed to main");
  assert.ok(idx(steps, "push") < idx(steps, "publish"), "publish only after the push");
  const v = steps[idx(steps, "verify")].args;
  assert.ok(v.includes("--check") && v.includes("--exe"));
});

test("ship plan: exactly one step pushes to git and exactly one publishes", () => {
  const steps = shipSteps();
  assert.equal(steps.filter((s) => /publish-ota-git/.test(s.args.join(" "))).length, 1);
  assert.equal(steps.filter((s) => s.args.includes("publish")).length, 1);
  assert.equal(new Set(ids(steps)).size, steps.length);
});

test("runPlan with a mock executor: runs in order and stops at the first failure; later steps never run", () => {
  const steps = shipSteps();
  const calls = [];
  const ok = runPlan(steps, (cmd, args) => (calls.push(args.join(" ")), 0), { tag: "v1.2.3" });
  assert.equal(ok.ok, true);
  assert.deepEqual(ok.completed, ids(steps));
  assert.equal(calls.length, steps.length);

  for (const failAt of ids(steps)) {
    const ran = [];
    const r = runPlan(steps, (cmd, args) => {
      const id = steps.find((s) => s.args === args).id;
      ran.push(id);
      return id === failAt ? 3 : 0;
    }, { tag: "v1.2.3" });
    assert.equal(r.ok, false);
    assert.equal(r.failed, failAt);
    assert.equal(r.code, 3);
    assert.deepEqual(ran, ids(steps).slice(0, idx(steps, failAt) + 1), `nothing runs after ${failAt}`);
    assert.ok(!ran.includes("publish") || failAt === "publish");
  }
});

test("failure messages say plainly that the draft stays unpublished once it exists", () => {
  for (const id of ["upload", "push"]) {
    const m = failureAdvice(id, "v1.2.3");
    assert.match(m, /v1\.2\.3/);
    assert.match(m, /UNPUBLISHED/);
  }
  assert.match(failureAdvice("push", "v1.2.3"), /gh-release\.mjs publish/);
  assert.match(failureAdvice("publish", "v1.2.3"), /UNPUBLISHED/);
  for (const id of ["build", "pack", "verify"]) assert.match(failureAdvice(id), /Nothing was created or published/);
});

test("ship.mjs executes the plan and has no hard-coded step order of its own", () => {
  const src = readFileSync("scripts/ship.mjs", "utf8");
  assert.match(src, /import \{ runPlan, shipSteps \} from "\.\/ship-plan\.mjs"/);
  assert.match(src, /runPlan\(shipSteps\(\)/);
  assert.match(src, /result\.advice/);
  assert.doesNotMatch(src, /publish-ota-git|gh-release|pack-updates/, "steps live only in ship-plan.mjs");
});