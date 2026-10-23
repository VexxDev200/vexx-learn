/**
 * Argument validation for IPC calls coming from the renderer (Round 2 / S5.3).
 * Pure functions, no electron imports. The renderer is treated as untrusted: every payload is checked for shape, type
 * and size, and handlers get a freshly built object that contains ONLY the known fields (no prototype / extra keys).
 * Unknown extra keys are ignored rather than rejected on purpose: a newer OTA-delivered UI must keep working against an
 * older exe. Garbage (wrong type, oversized, unknown enum value, control characters) throws IpcValidationError.
 */

export const LIMITS = Object.freeze({
  code: 200_000, // editor text for run/check
  stdin: 100_000, // stdin of one run / one interactive chunk
  checks: 20, // test cases per lesson
  expected: 100_000, // expectedStdout of one check
  hint: 10_000,
  lessonId: 100,
  path: 4096,
  settingsKeys: 50,
});

export const RUN_LANGS = Object.freeze(["python", "java", "cpp", "csharp"]);
const LESSON_ID_RE = /^[A-Za-z0-9._:-]+$/;

export class IpcValidationError extends TypeError {
  constructor(channel, reason) {
    super(`invalid IPC arguments for ${channel}: ${reason}`);
    this.name = "IpcValidationError";
    this.channel = channel;
  }
}

function isPlainObject(v) {
  if (v === null || typeof v !== "object" || Array.isArray(v)) return false;
  const proto = Object.getPrototypeOf(v);
  return proto === Object.prototype || proto === null;
}

function fail(channel, reason) {
  throw new IpcValidationError(channel, reason);
}

function reqObject(channel, v) {
  if (!isPlainObject(v)) fail(channel, "payload must be a plain object");
  return v;
}

function reqString(channel, name, v, max, { allowEmpty = true } = {}) {
  if (typeof v !== "string") fail(channel, `${name} must be a string`);
  if (v.length > max) fail(channel, `${name} is too long (max ${max})`);
  if (!allowEmpty && v.length === 0) fail(channel, `${name} must not be empty`);
  if (v.includes("\u0000")) fail(channel, `${name} contains a NUL character`);
  return v;
}

function optString(channel, name, v, max) {
  if (v === undefined || v === null) return "";
  return reqString(channel, name, v, max);
}

/** progress:complete -> lesson id string */
export function validateLessonId(id, channel = "progress:complete") {
  const s = reqString(channel, "lessonId", id, LIMITS.lessonId, { allowEmpty: false });
  if (!LESSON_ID_RE.test(s)) fail(channel, "lessonId has unexpected characters");
  return s;
}

/** run:python / run:java / run:cpp / run:csharp -> { code, stdin } */
export function validateRunPayload(payload, channel = "run") {
  const p = reqObject(channel, payload);
  return {
    code: reqString(channel, "code", p.code, LIMITS.code),
    stdin: optString(channel, "stdin", p.stdin, LIMITS.stdin),
  };
}

/** check:* -> { code, checks: [{ stdin, expectedStdout?, hint }] } */
export function validateCheckPayload(payload, channel = "check") {
  const p = reqObject(channel, payload);
  const code = reqString(channel, "code", p.code, LIMITS.code);
  const raw = p.checks === undefined || p.checks === null ? [] : p.checks;
  if (!Array.isArray(raw)) fail(channel, "checks must be an array");
  if (raw.length > LIMITS.checks) fail(channel, `too many checks (max ${LIMITS.checks})`);
  const checks = raw.map((c, i) => {
    if (!isPlainObject(c)) fail(channel, `checks[${i}] must be a plain object`);
    const out = {
      stdin: optString(channel, `checks[${i}].stdin`, c.stdin, LIMITS.stdin),
      hint: optString(channel, `checks[${i}].hint`, c.hint, LIMITS.hint),
    };
    if (c.expectedStdout !== undefined && c.expectedStdout !== null) {
      out.expectedStdout = reqString(channel, `checks[${i}].expectedStdout`, c.expectedStdout, LIMITS.expected);
    }
    return out;
  });
  return { code, checks };
}

/** run:interactive -> { lang, code }; lang defaults to python only when omitted */
export function validateInteractivePayload(payload, channel = "run:interactive") {
  const p = reqObject(channel, payload);
  const lang = p.lang === undefined || p.lang === null ? "python" : p.lang;
  if (typeof lang !== "string" || !RUN_LANGS.includes(lang)) fail(channel, `lang must be one of ${RUN_LANGS.join(", ")}`);
  return { lang, code: reqString(channel, "code", p.code, LIMITS.code) };
}

/** run:stdin -> text */
export function validateStdinPayload(payload, channel = "run:stdin") {
  const p = reqObject(channel, payload);
  return reqString(channel, "text", p.text, LIMITS.stdin);
}

/** shell:open-path -> path string (existence / root containment is checked by isPathInsideRoots) */
export function validatePathArg(p, channel = "shell:open-path") {
  return reqString(channel, "path", p, LIMITS.path, { allowEmpty: false });
}

/** settings:set -> plain object with a bounded number of keys (values are checked by sanitizeSettingsPatch) */
export function validateSettingsPatch(patch, channel = "settings:set") {
  const p = reqObject(channel, patch);
  if (Object.keys(p).length > LIMITS.settingsKeys) fail(channel, "too many keys");
  return p;
}