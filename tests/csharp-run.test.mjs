// C# runner: toolchain detection, temp project, and the two call sites (run:csharp / interactive) with fake executors.
// No real dotnet is ever started here. Requires: node --experimental-test-module-mocks --test
import { test, mock } from "node:test";
import assert from "node:assert/strict";
import { EventEmitter } from "node:events";
import { existsSync, readFileSync } from "node:fs";
import * as realCp from "node:child_process";
import { join } from "node:path";

// --- fake child_process, installed before electron/*.mjs are imported -------------------------------------------
let sdkListing = { status: 0, stdout: "", stderr: "" }; // what `dotnet --list-sdks` "prints"
let sdkCalls = 0;
const spawned = []; // { cmd, args, opts, csproj, program }
let childBehavior = (child) => { child.stdout.emit("data", Buffer.from("hi\n")); child.emit("close", 0); };

function fakeSpawnSync(cmd, args, opts) {
  if (cmd === "dotnet" && args?.[0] === "--list-sdks") {
    sdkCalls++;
    return typeof sdkListing === "function" ? sdkListing() : sdkListing;
  }
  return realCp.spawnSync(cmd, args, opts);
}
function fakeSpawn(cmd, args, opts) {
  const child = new EventEmitter();
  child.stdout = new EventEmitter();
  child.stderr = new EventEmitter();
  child.stdin = { writable: true, write() {}, end() {} };
  child.kill = () => {};
  child.spawnfile = cmd;
  const rec = { cmd, args, opts };
  if (cmd === "dotnet") {
    // the temp dir is removed after close, so snapshot the files now
    const proj = args[args.indexOf("--project") + 1];
    rec.csproj = existsSync(proj) ? readFileSync(proj, "utf8") : null;
    rec.program = existsSync(join(opts.cwd, "Program.cs")) ? readFileSync(join(opts.cwd, "Program.cs"), "utf8") : null;
  }
  spawned.push(rec);
  setImmediate(() => childBehavior(child));
  return child;
}
const cpMock = mock.module("node:child_process", {
  namedExports: { ...realCp, spawn: fakeSpawn, spawnSync: fakeSpawnSync },
  defaultExport: { ...realCp, spawn: fakeSpawn, spawnSync: fakeSpawnSync },
});

const csr = await import("../electron/csharp-run.mjs");
const { loadMain } = await import("./helpers/loadMain.mjs");
const { startInteractiveRun } = await import("../electron/interactiveRun.mjs");

const SDK10 = { status: 0, stdout: "10.0.202 [C:\\Program Files\\dotnet\\sdk]\r\n10.0.400 [C:\\Program Files\\dotnet\\sdk]\r\n", stderr: "" };
const reset = () => {
  csr.resetDotnetCache();
  sdkCalls = 0;
  spawned.length = 0;
  sdkListing = SDK10;
  childBehavior = (child) => { child.stdout.emit("data", Buffer.from("hi\n")); child.emit("close", 0); };
};

test("parseSdkMajors / pickTfm: newest SDK major wins, junk and too-old SDKs give no TFM", () => {
  assert.deepEqual(csr.parseSdkMajors(SDK10.stdout), [10, 10]);
  assert.deepEqual(csr.parseSdkMajors("8.0.404 [/usr/share/dotnet/sdk]\n9.0.100-preview.1 [/x]\n"), [8, 9]);
  for (const junk of ["", undefined, null, "Microsoft.NETCore.App 8.0.27 [C:\\x]", "no sdks here", "10.0 [x]"]) assert.deepEqual(csr.parseSdkMajors(junk), []);
  assert.equal(csr.pickTfm([10, 10]), "net10.0");
  assert.equal(csr.pickTfm([8, 9]), "net9.0");
  assert.equal(csr.pickTfm([6]), "net6.0");
  assert.equal(csr.pickTfm([5, 3]), null);
  assert.equal(csr.pickTfm([]), null);
  assert.equal(csr.pickTfm(undefined), null);
});

test("detectDotnet: missing dotnet / runtime-only / too-old / failing / timing out give a clear message, never a throw", () => {
  const det = (r) => csr.detectDotnet({ spawnSync: () => r, useCache: false });
  let r = det({ error: Object.assign(new Error("spawn dotnet ENOENT"), { code: "ENOENT" }) });
  assert.deepEqual([r.ok, r.kind, r.message], [false, "missing", csr.MSG_NO_DOTNET]);
  r = det({ status: 0, stdout: "", stderr: "" });
  assert.deepEqual([r.ok, r.kind, r.message], [false, "no-sdk", csr.MSG_NO_SDK]);
  r = det({ status: 0, stdout: "5.0.408 [C:\\x]\n", stderr: "" });
  assert.deepEqual([r.ok, r.kind, r.message], [false, "too-old", csr.MSG_SDK_TOO_OLD]);
  r = det({ status: 1, stdout: "", stderr: "boom happened\nsecond line" });
  assert.equal(r.ok, false);
  assert.equal(r.message, csr.MSG_DETECT_FAILED_PREFIX + "boom happened");
  r = det({ error: Object.assign(new Error("spawnSync dotnet ETIMEDOUT"), { code: "ETIMEDOUT" }) });
  assert.equal(r.kind, "error");
  assert.ok(r.message.startsWith(csr.MSG_DETECT_FAILED_PREFIX) && r.message.includes("ETIMEDOUT"));
  r = csr.detectDotnet({ spawnSync: () => { throw new Error("kaboom"); }, useCache: false });
  assert.equal(r.ok, false);
  assert.ok(r.message.includes("kaboom"));
  r = det(SDK10);
  assert.deepEqual([r.ok, r.tfm, r.major], [true, "net10.0", 10]);
});

test("detectDotnet caches success only (an SDK installed later is picked up without restart)", () => {
  let n = 0;
  let out = { status: 0, stdout: "", stderr: "" };
  const spawnSync = () => { n++; return out; };
  assert.equal(csr.detectDotnet({ spawnSync }).ok, false);
  assert.equal(csr.detectDotnet({ spawnSync }).ok, false);
  assert.equal(n, 2, "failures are not cached");
  out = SDK10;
  assert.equal(csr.detectDotnet({ spawnSync }).tfm, "net10.0");
  assert.equal(csr.detectDotnet({ spawnSync }).tfm, "net10.0");
  assert.equal(n, 3, "success is cached");
  csr.resetDotnetCache();
});

test("temp project targets the installed SDK (not a hard-coded net8.0) and carries the user's source verbatim", () => {
  const files = new Map();
  const made = [];
  const p = csr.prepareCsharp("class P { /* \u043f\u0440\u0438\u0432\u0435\u0442 */ }", {
    detect: () => ({ ok: true, tfm: "net10.0", major: 10 }),
    mkdtemp: (prefix) => { made.push(prefix); return "/tmp/vexx-cs-x"; },
    write: (f, c) => files.set(f, c),
    tmp: () => "/tmp",
  });
  assert.equal(p.ok, true);
  assert.ok(made[0].includes("vexx-cs-"));
  assert.equal(files.get(join("/tmp/vexx-cs-x", "Program.cs")), "class P { /* \u043f\u0440\u0438\u0432\u0435\u0442 */ }");
  const proj = files.get(p.csproj);
  assert.match(proj, /<TargetFramework>net10\.0<\/TargetFramework>/);
  assert.doesNotMatch(proj, /net8\.0/);
  assert.match(proj, /<OutputType>Exe<\/OutputType>/);
  assert.deepEqual(p.args, ["run", "--project", p.csproj]);
  assert.equal(p.env.DOTNET_CLI_TELEMETRY_OPTOUT, "1");
  assert.equal(p.env.DOTNET_NOLOGO, "1");
  assert.equal(p.env.PATH ?? p.env.Path, process.env.PATH ?? process.env.Path, "environment is inherited");
  assert.doesNotMatch(readFileSync(new URL("../electron/csharp-run.mjs", import.meta.url), "utf8").replace(/^\s*(\/\/|\*|\/\*).*$/gm, ""), /net8\.0/, "no hard-coded TFM in code");
});

test("prepareCsharp: no SDK -> message and NOTHING is created; write failure removes the temp dir", () => {
  let created = 0;
  const miss = csr.prepareCsharp("x", { detect: () => ({ ok: false, kind: "missing", message: csr.MSG_NO_DOTNET }), mkdtemp: () => { created++; return "d"; } });
  assert.deepEqual(miss, { ok: false, message: csr.MSG_NO_DOTNET });
  assert.equal(created, 0);
  const removed = [];
  assert.throws(
    () => csr.prepareCsharp("x", {
      detect: () => ({ ok: true, tfm: "net9.0", major: 9 }),
      mkdtemp: () => "/tmp/d1",
      write: () => { throw new Error("disk full"); },
      remove: (d) => removed.push(d),
      tmp: () => "/tmp",
    }),
    /disk full/,
  );
  assert.deepEqual(removed, ["/tmp/d1"]);
});

test("run:csharp with fake executors: SDK 10 -> `dotnet run` on a net10.0 project, output returned", async () => {
  reset();
  const m = await loadMain();
  try {
    const res = await m.handlers.get("run:csharp")({}, { code: "class P { static void Main(){} }", stdin: "" });
    assert.deepEqual([res.ok, res.stdout, res.exitCode], [true, "hi\n", 0]);
    const dn = spawned.filter((s) => s.cmd === "dotnet");
    assert.equal(dn.length, 1);
    assert.equal(dn[0].args[0], "run");
    assert.match(dn[0].csproj, /<TargetFramework>net10\.0<\/TargetFramework>/);
    assert.equal(dn[0].program, "class P { static void Main(){} }");
    assert.equal(dn[0].opts.env.DOTNET_NOLOGO, "1");
    assert.ok(!existsSync(dn[0].opts.cwd), "temp dir removed after the run");
    // check:csharp goes through the same path; detection is cached for the second run
    await m.handlers.get("run:csharp")({}, { code: "class Q {}", stdin: "" });
    assert.equal(sdkCalls, 1);
  } finally {
    m.restore();
  }
});

test("run:csharp with NO dotnet: clear message, nothing spawned, no crash (run and check)", async () => {
  reset();
  sdkListing = { error: Object.assign(new Error("spawn dotnet ENOENT"), { code: "ENOENT" }) };
  const m = await loadMain();
  try {
    const res = await m.handlers.get("run:csharp")({}, { code: "class P {}", stdin: "" });
    assert.deepEqual([res.ok, res.exitCode, res.stdout], [false, -1, ""]);
    assert.equal(res.stderr, csr.MSG_NO_DOTNET + "\n");
    assert.equal(spawned.filter((s) => s.cmd === "dotnet").length, 0);
    const chk = await m.handlers.get("check:csharp")({}, { code: "class P {}", checks: [{ stdin: "", expectedStdout: "hi" }] });
    assert.ok(JSON.stringify(chk).includes("false"), "check fails cleanly instead of throwing");
    assert.equal(spawned.filter((s) => s.cmd === "dotnet").length, 0);
  } finally {
    m.restore();
  }
});

test("run:csharp: runtime-only machine and a dotnet that vanishes between detection and spawn both give the same clear message", async () => {
  reset();
  sdkListing = { status: 0, stdout: "", stderr: "" };
  const m = await loadMain();
  try {
    const res = await m.handlers.get("run:csharp")({}, { code: "class P {}", stdin: "" });
    assert.equal(res.stderr, csr.MSG_NO_SDK + "\n");
    reset();
    childBehavior = (child) => child.emit("error", Object.assign(new Error("spawn dotnet ENOENT"), { code: "ENOENT" }));
    const res2 = await m.handlers.get("run:csharp")({}, { code: "class P {}", stdin: "" });
    assert.deepEqual([res2.ok, res2.exitCode, res2.stderr], [false, -1, csr.MSG_NO_DOTNET + "\n"]);
  } finally {
    m.restore();
  }
});

test("interactive C#: SDK present -> dotnet run on the installed TFM; missing -> message + done(ok:false), no spawn", async () => {
  reset();
  const sent = [];
  const wc = { isDestroyed: () => false, send: (_ch, p) => sent.push(p) };
  const r1 = await startInteractiveRun(wc, "csharp", "class P {}");
  assert.equal(r1.ok, true);
  await new Promise((r) => setTimeout(r, 30));
  const dn = spawned.find((s) => s.cmd === "dotnet");
  assert.ok(dn, "dotnet spawned");
  assert.match(dn.csproj, /net10\.0/);
  assert.ok(sent.some((e) => e.type === "stdout" && e.data === "hi\n"));
  assert.ok(sent.some((e) => e.type === "done" && e.ok === true));

  reset();
  sdkListing = { error: Object.assign(new Error("spawn dotnet ENOENT"), { code: "ENOENT" }) };
  sent.length = 0;
  const r2 = await startInteractiveRun(wc, "csharp", "class P {}");
  assert.equal(r2.ok, false);
  assert.equal(r2.error, csr.MSG_NO_DOTNET);
  assert.ok(sent.some((e) => e.type === "stderr" && e.data === csr.MSG_NO_DOTNET + "\n"));
  assert.ok(sent.some((e) => e.type === "done" && e.ok === false));
  assert.equal(spawned.filter((s) => s.cmd === "dotnet").length, 0);
});

test.after(() => cpMock.restore());