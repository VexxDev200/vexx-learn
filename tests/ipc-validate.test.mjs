import test from "node:test";
import assert from "node:assert/strict";
import {
  IpcValidationError,
  LIMITS,
  validateCheckPayload,
  validateInteractivePayload,
  validateLessonId,
  validatePathArg,
  validateRunPayload,
  validateSettingsPatch,
  validateStdinPayload,
} from "../electron/ipc-validate.mjs";
import { loadMain } from "./helpers/loadMain.mjs";

const big = (n) => "x".repeat(n + 1);
const GARBAGE_PAYLOADS = [undefined, null, 0, 7, true, "code", [], [{ code: "x" }], () => 1, Symbol.iterator, new Map(), Object.create({ code: "inherited" })];

test("validateRunPayload: shape, types, sizes; builds a clean object", () => {
  assert.deepEqual(validateRunPayload({ code: "print(1)" }), { code: "print(1)", stdin: "" });
  assert.deepEqual(validateRunPayload({ code: "", stdin: "5\n" }), { code: "", stdin: "5\n" });
  assert.deepEqual(validateRunPayload({ code: "x", stdin: null }), { code: "x", stdin: "" });
  // unknown keys are dropped, not forwarded
  const clean = validateRunPayload(JSON.parse('{"code":"x","evil":"rm","__proto__":{"polluted":1},"constructor":5}'));
  assert.deepEqual(Object.keys(clean).sort(), ["code", "stdin"]);
  assert.equal(Object.getPrototypeOf(clean), Object.prototype);
  assert.throws(() => validateRunPayload({ code: "x", __proto__: { polluted: 1 } }), IpcValidationError); // non-plain prototype
  for (const bad of GARBAGE_PAYLOADS) assert.throws(() => validateRunPayload(bad), IpcValidationError);
  for (const bad of [{}, { code: 5 }, { code: null }, { code: ["a"] }, { code: {} }, { code: "a\u0000b" }, { code: big(LIMITS.code) }, { code: "x", stdin: 5 }, { code: "x", stdin: {} }, { code: "x", stdin: big(LIMITS.stdin) }]) {
    assert.throws(() => validateRunPayload(bad), IpcValidationError, JSON.stringify(bad).slice(0, 60));
  }
  assert.equal(validateRunPayload({ code: "x".repeat(LIMITS.code) }).code.length, LIMITS.code); // boundary is accepted
});

test("validateCheckPayload: checks array of well-formed objects only", () => {
  assert.deepEqual(validateCheckPayload({ code: "c" }), { code: "c", checks: [] });
  assert.deepEqual(validateCheckPayload({ code: "c", checks: null }), { code: "c", checks: [] });
  const ok = validateCheckPayload({ code: "c", checks: [{ expectedStdout: "Hi\n", hint: "h" }, { stdin: "1", expectedStdout: "2", extra: 1 }, {}] });
  assert.deepEqual(ok.checks, [
    { stdin: "", hint: "h", expectedStdout: "Hi\n" },
    { stdin: "1", hint: "", expectedStdout: "2" },
    { stdin: "", hint: "" },
  ]);
  for (const bad of GARBAGE_PAYLOADS) assert.throws(() => validateCheckPayload(bad), IpcValidationError);
  const badChecks = ["str", {}, 5, [[]], [null], [5], ["x"], [[1]], [{ expectedStdout: 5 }], [{ stdin: {} }], [{ hint: [] }], [{ expectedStdout: big(LIMITS.expected) }], new Array(LIMITS.checks + 1).fill({})];
  for (const checks of badChecks) assert.throws(() => validateCheckPayload({ code: "c", checks }), IpcValidationError, JSON.stringify(checks)?.slice(0, 60));
  assert.throws(() => validateCheckPayload({ checks: [] }), IpcValidationError);
  assert.equal(validateCheckPayload({ code: "c", checks: new Array(LIMITS.checks).fill({}) }).checks.length, LIMITS.checks);
});

test("validateInteractivePayload: lang must be a known language; code a string", () => {
  assert.deepEqual(validateInteractivePayload({ lang: "java", code: "c" }), { lang: "java", code: "c" });
  assert.deepEqual(validateInteractivePayload({ code: "c" }), { lang: "python", code: "c" });
  for (const lang of ["ruby", "PYTHON", "", " python", "python\n", 5, {}, [], "../../x", "cmd /c calc"]) {
    assert.throws(() => validateInteractivePayload({ lang, code: "c" }), IpcValidationError, String(lang));
  }
  for (const bad of GARBAGE_PAYLOADS) assert.throws(() => validateInteractivePayload(bad), IpcValidationError);
  assert.throws(() => validateInteractivePayload({ lang: "python" }), IpcValidationError);
  assert.throws(() => validateInteractivePayload({ lang: "python", code: 1 }), IpcValidationError);
});

test("validateStdinPayload / validateLessonId / validatePathArg / validateSettingsPatch", () => {
  assert.equal(validateStdinPayload({ text: "hello\n" }), "hello\n");
  for (const bad of [...GARBAGE_PAYLOADS, {}, { text: 5 }, { text: null }, { text: big(LIMITS.stdin) }, { text: "a\u0000" }]) {
    assert.throws(() => validateStdinPayload(bad), IpcValidationError);
  }
  for (const ok of ["py-01", "java_3", "cyber.1:2", "a".repeat(LIMITS.lessonId)]) assert.equal(validateLessonId(ok), ok);
  for (const bad of [undefined, null, 5, {}, [], "", " ", "py 01", "py-01\n", "../x", "a/b", "<script>", "é", "a".repeat(LIMITS.lessonId + 1), "py\u0000"]) {
    assert.throws(() => validateLessonId(bad), IpcValidationError, String(bad));
  }
  assert.equal(validatePathArg("C:\\x\\y.exe"), "C:\\x\\y.exe");
  for (const bad of [undefined, null, 5, {}, [], "", "a\u0000b", big(LIMITS.path)]) assert.throws(() => validatePathArg(bad), IpcValidationError);
  assert.deepEqual(validateSettingsPatch({ theme: "light" }), { theme: "light" });
  for (const bad of [undefined, null, 5, "x", [], [1]]) assert.throws(() => validateSettingsPatch(bad), IpcValidationError);
  const many = Object.fromEntries(Array.from({ length: LIMITS.settingsKeys + 1 }, (_, i) => ["k" + i, 1]));
  assert.throws(() => validateSettingsPatch(many), IpcValidationError);
});

test("main.mjs: every run/check/interactive channel refuses garbage BEFORE anything is spawned", async () => {
  const m = await loadMain();
  try {
    const channels = ["run:python", "check:python", "run:java", "check:java", "run:cpp", "check:cpp", "run:csharp", "check:csharp"];
    for (const ch of channels) {
      const h = m.handlers.get(ch);
      assert.equal(typeof h, "function", ch);
      const extra = ch.startsWith("check:") ? [{ code: "x", checks: "nope" }, { code: "x", checks: [{ expectedStdout: 5 }] }] : [];
      for (const bad of [...GARBAGE_PAYLOADS, { code: 5 }, { code: big(LIMITS.code) }, ...extra]) {
        await assert.rejects(async () => h({}, bad), IpcValidationError, `${ch} <- ${String(JSON.stringify(bad))?.slice(0, 40)}`);
      }
    }
    const inter = m.handlers.get("run:interactive");
    for (const bad of [...GARBAGE_PAYLOADS, { lang: "ruby", code: "x" }, { lang: "python", code: 5 }, { lang: {}, code: "x" }]) {
      await assert.rejects(async () => inter({}, bad), IpcValidationError);
    }
  } finally {
    m.restore();
  }
});

test("main.mjs: run:stdin drops garbage silently; progress:complete rejects bad ids and leaves progress untouched", async () => {
  const m = await loadMain();
  try {
    const stdin = m.listeners.get("run:stdin");
    for (const bad of [...GARBAGE_PAYLOADS, { text: 5 }, { text: big(LIMITS.stdin) }]) assert.doesNotThrow(() => stdin({}, bad));

    const get = m.handlers.get("progress:get");
    const complete = m.handlers.get("progress:complete");
    const before = JSON.stringify(await get({}));
    for (const bad of [undefined, null, 5, {}, [], "", "../../x", "a b", "x".repeat(500), { id: "py-01" }]) {
      await assert.rejects(async () => complete({}, bad), IpcValidationError);
    }
    assert.equal(JSON.stringify(await get({})), before, "bad ids must not change progress");
    const p = await complete({}, "py-01");
    assert.ok(p.completed.includes("py-01"));
  } finally {
    m.restore();
  }
});

test("main.mjs: settings:set rejects non-object patches; shell:open / shell:open-path refuse garbage without side effects", async () => {
  const m = await loadMain();
  try {
    const set = m.handlers.get("settings:set");
    const get = m.handlers.get("settings:get");
    const before = JSON.stringify(await get({}));
    for (const bad of [undefined, null, 5, "theme", [], [{ theme: "light" }]]) await assert.rejects(async () => set({}, bad), IpcValidationError);
    assert.equal(JSON.stringify(await get({})), before);
    assert.equal((await set({}, { theme: "light" })).theme, "light");

    const open = m.handlers.get("shell:open");
    for (const bad of [undefined, null, 5, {}, [], ["https://example.com"], { toString: () => "https://example.com" }, "https://example.com/" + big(3000)]) await open({}, bad);
    assert.deepEqual(m.shellCalls.openExternal, []);

    const openPath = m.handlers.get("shell:open-path");
    for (const bad of [undefined, null, 5, {}, [], "", "a\u0000b", big(LIMITS.path)]) {
      const r = await openPath({}, bad);
      assert.match(String(r), /^blocked/);
    }
    assert.deepEqual(m.shellCalls.openPath, []);
  } finally {
    m.restore();
  }
});