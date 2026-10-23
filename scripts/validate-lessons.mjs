#!/usr/bin/env node
/**
 * Validate all course JSON. One command: node scripts/validate-lessons.mjs [--json]
 * Checks src/content/data/*.json (localized LessonDef[]) and lessons/<track>/ (legacy plain-string lessons + manifest).
 * Read-only. Exit code 1 if any "error" is found. No dependencies.
 */
import { existsSync, readdirSync, readFileSync } from "fs";
import { createHash } from "crypto";
import { dirname, join, relative } from "path";
import { fileURLToPath } from "url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const DATA = join(ROOT, "src", "content", "data");
const LEGACY = join(ROOT, "lessons");
const TRACKS = ["python", "java", "cpp", "csharp", "security"];
const LANGS = ["ru", "en", "he"];
const KINDS = ["lesson", "exam", "ethics", "project"];
const EDITOR_LANGS = ["python", "java", "cpp", "csharp"];
const L_FIELDS = ["title", "theory", "exampleExplain", "task"];
const MIN_THEORY = 200; // chars; shorter theory = suspiciously empty

const problems = [];
const rel = (p) => relative(ROOT, p).replace(/\\/g, "/");
function add(severity, code, file, msg, id) {
  problems.push({ severity, code, file: rel(file), id: id || null, msg });
}
function readJson(file) {
  try {
    return JSON.parse(readFileSync(file, "utf8").replace(/^\uFEFF/, ""));
  } catch (e) {
    add("error", "invalid-json", file, e.message);
    return undefined;
  }
}
const isStr = (v) => typeof v === "string";
const blank = (v) => !isStr(v) || v.trim() === "";

const allIdsByTrack = {}; // track -> Set (data)
const allDefs = []; // {track,file,def}

/* ---------- 1. src/content/data/<track>.json ---------- */
for (const track of TRACKS) {
  const file = join(DATA, `${track}.json`);
  if (!existsSync(file)) { add("error", "missing-file", file, "track file missing"); continue; }
  const arr = readJson(file);
  if (arr === undefined) continue;
  if (!Array.isArray(arr)) { add("error", "not-array", file, "top level must be an array of lessons"); continue; }
  if (arr.length === 0) add("error", "empty-track", file, "track has 0 lessons");
  const seen = new Map();
  arr.forEach((d, i) => {
    const id = d && d.id;
    const where = `#${i}`;
    if (!d || typeof d !== "object") { add("error", "bad-lesson", file, `${where} is not an object`); return; }
    if (blank(id)) { add("error", "missing-id", file, `${where} has no id`); return; }
    if (seen.has(id)) add("error", "duplicate-id", file, `id "${id}" appears at #${seen.get(id)} and ${where}`, id);
    else seen.set(id, i);
    if (d.track !== track) add("error", "track-mismatch", file, `track="${d.track}" but file is ${track}`, id);
    if (typeof d.minutes !== "number" || !(d.minutes > 0)) add("error", "bad-minutes", file, `minutes must be a positive number (got ${JSON.stringify(d.minutes)})`, id);
    if (d.kind !== undefined && !KINDS.includes(d.kind)) add("error", "bad-kind", file, `unknown kind "${d.kind}"`, id);
    if (d.editorLang !== undefined && !EDITOR_LANGS.includes(d.editorLang)) add("error", "bad-editorLang", file, `unknown editorLang "${d.editorLang}"`, id);
    if (d.editorLang === undefined && track === "security") add("warn", "no-editorLang", file, "security lesson without editorLang (runner language is guessed)", id);
    for (const f of L_FIELDS) {
      const v = d[f];
      if (!v || typeof v !== "object" || Array.isArray(v)) { add("error", "bad-L-field", file, `${f} must be {ru,en,he} (got ${typeof v})`, id); continue; }
      for (const lg of LANGS) if (blank(v[lg])) add("error", "empty-translation", file, `${f}.${lg} is empty/missing`, id);
      if (!blank(v.ru) && !blank(v.en) && v.en === v.ru) add("warn", "untranslated", file, `${f}.en identical to ru`, id);
      if (!blank(v.ru) && !blank(v.he) && v.he === v.ru) add("warn", "untranslated", file, `${f}.he identical to ru`, id);
      for (const lg of LANGS) if (isStr(v[lg]) && /\?{4,}/.test(v[lg])) add("error", "mojibake", file, `${f}.${lg} contains "????" (lost encoding)`, id);
    }
    if (d.theory && d.theory.ru && d.theory.ru.trim().length < MIN_THEORY && d.kind !== "exam") add("warn", "short-theory", file, `theory.ru only ${d.theory.ru.trim().length} chars`, id);
    for (const f of ["exampleCode", "starterCode"]) {
      if (!isStr(d[f])) add("error", "bad-code-field", file, `${f} must be a string`, id);
      else if (d[f].trim() === "") add("warn", "empty-code", file, `${f} is empty`, id);
    }
    if (!Array.isArray(d.checks)) add("error", "bad-checks", file, "checks must be an array", id);
    else {
      if (d.checks.length === 0 && d.kind !== "ethics") add("warn", "no-checks", file, "lesson has no checks (cannot be auto-graded)", id);
      d.checks.forEach((c, ci) => {
        if (!c || typeof c !== "object") { add("error", "bad-check", file, `checks[${ci}] not an object`, id); return; }
        if (c.expectedStdout !== undefined && !isStr(c.expectedStdout)) add("error", "bad-check", file, `checks[${ci}].expectedStdout must be string`, id);
        if (c.stdin !== undefined && !isStr(c.stdin)) add("error", "bad-check", file, `checks[${ci}].stdin must be string`, id);
        if (c.expectedStdout === undefined) add("warn", "check-no-expected", file, `checks[${ci}] has no expectedStdout (passes on exit code only)`, id);
        if (blank(c.hint)) add("warn", "check-no-hint", file, `checks[${ci}] has no hint`, id);
      });
    }
    if (d.starterCode && d.exampleCode && d.checks?.length && d.starterCode.trim() === d.exampleCode.trim()) add("warn", "starter-equals-example", file, "starterCode identical to exampleCode", id);
    allDefs.push({ track, file, def: d });
  });
  allIdsByTrack[track] = new Set(seen.keys());
}

/* global duplicate ids across tracks */
const globalSeen = new Map();
for (const { track, file, def } of allDefs) {
  if (!def.id) continue;
  if (globalSeen.has(def.id) && globalSeen.get(def.id) !== track) add("error", "duplicate-id-global", file, `id "${def.id}" also used in track ${globalSeen.get(def.id)}`, def.id);
  else globalSeen.set(def.id, track);
}

/* ---------- 2. references to other lessons inside text ---------- */
const prefixes = new Set();
for (const id of globalSeen.keys()) { const m = /^([a-z]+)-\d+$/i.exec(id); if (m) prefixes.add(m[1]); }
if (prefixes.size) {
  const re = new RegExp(`\\b(?:${[...prefixes].join("|")})-\\d{1,3}\\b`, "gi");
  for (const { file, def } of allDefs) {
    const texts = [];
    for (const f of L_FIELDS) if (def[f] && typeof def[f] === "object") for (const lg of LANGS) if (isStr(def[f][lg])) texts.push(def[f][lg]);
    const refs = new Set();
    for (const t of texts) for (const m of t.matchAll(re)) refs.add(m[0].toLowerCase());
    for (const r of refs) if (r !== def.id && !globalSeen.has(r)) add("error", "broken-ref", file, `text references lesson "${r}" which does not exist`, def.id);
  }
}

/* ---------- 3. bundle-manifest counts ---------- */
{
  const f = join(DATA, "bundle-manifest.json");
  const bm = existsSync(f) ? readJson(f) : (add("error", "missing-file", f, "bundle-manifest.json missing"), undefined);
  if (bm) {
    if (!(Number(bm.coursesVersion) > 0)) add("error", "bad-version", f, "coursesVersion missing/invalid");
    for (const t of TRACKS) if (allIdsByTrack[t] && bm.counts?.[t] !== allIdsByTrack[t].size) add("error", "count-mismatch", f, `counts.${t}=${bm.counts?.[t]} but track file has ${allIdsByTrack[t].size}`);
  }
}

/* ---------- 4. legacy lessons/<track>/ (plain strings + manifest.json) ---------- */
const LEGACY_REQ = ["id", "track", "title", "minutes", "theory", "exampleCode", "exampleExplain", "task", "starterCode", "checks"];
if (existsSync(LEGACY)) {
  for (const track of readdirSync(LEGACY, { withFileTypes: true }).filter((e) => e.isDirectory()).map((e) => e.name)) {
    const dir = join(LEGACY, track);
    const manFile = join(dir, "manifest.json");
    const files = readdirSync(dir).filter((n) => n.endsWith(".json") && n !== "manifest.json").map((n) => n.slice(0, -5));
    if (!existsSync(manFile)) { add("error", "missing-manifest", manFile, "manifest.json missing"); continue; }
    const man = readJson(manFile);
    if (!man) continue;
    if (!Array.isArray(man.order)) { add("error", "bad-manifest", manFile, "manifest.order must be an array"); continue; }
    const seen = new Set();
    for (const id of man.order) {
      if (seen.has(id)) add("error", "duplicate-id", manFile, `"${id}" listed twice in manifest.order`, id);
      seen.add(id);
      if (!files.includes(id)) add("error", "broken-ref", manFile, `manifest.order lists "${id}" but ${track}/${id}.json does not exist`, id);
    }
    for (const id of files) if (!seen.has(id)) add("warn", "orphan-lesson", join(dir, `${id}.json`), `file not listed in manifest.order (never shown)`, id);
    for (const id of files) {
      const file = join(dir, `${id}.json`);
      const d = readJson(file);
      if (!d) continue;
      for (const f of LEGACY_REQ) if (d[f] === undefined) add("error", "missing-field", file, `required field "${f}" missing`, id);
      if (d.id !== undefined && d.id !== id) add("error", "id-mismatch", file, `id "${d.id}" != file name`, id);
      if (d.track !== undefined && d.track !== track) add("error", "track-mismatch", file, `track "${d.track}" != folder ${track}`, id);
      for (const f of ["title", "theory", "exampleExplain", "task"]) {
        if (d[f] !== undefined && blank(d[f])) add("error", "empty-field", file, `${f} is empty`, id);
        else if (isStr(d[f]) && /\?{4,}/.test(d[f])) add("error", "mojibake", file, `${f} contains "????" (lost encoding)`, id);
      }
      if (isStr(d.theory) && d.theory.trim().length < 120) add("warn", "short-theory", file, `theory only ${d.theory.trim().length} chars`, id);
      if (!Array.isArray(d.checks) || d.checks.length === 0) add("warn", "no-checks", file, "no checks", id);
      if (typeof d.minutes !== "number" || !(d.minutes > 0)) add("error", "bad-minutes", file, "minutes invalid", id);
      if (!(globalSeen.get(id) === track)) add("warn", "legacy-not-in-bundle", file, `legacy lesson id not present in src/content/data/${track}.json (legacy folder is a second, divergent source of truth)`, id);
    }
  }
}

/* ---------- 5. OTA folder consistency (release/updates) ---------- */
{
  const OUT = join(ROOT, "release", "updates");
  const mf = join(OUT, "manifest.json");
  if (existsSync(mf)) {
    const m = readJson(mf);
    if (m) {
      for (const t of TRACKS) {
        const f = join(OUT, `${t}.json`);
        if (!existsSync(f)) { add("error", "ota-missing", f, "listed track file missing in release/updates"); continue; }
        const buf = readFileSync(f);
        const h = createHash("sha256").update(buf).digest("hex");
        if (m.sha256?.[t] !== h) add("error", "ota-hash-mismatch", f, `manifest.sha256.${t} does not match file`);
        const src = join(DATA, `${t}.json`);
        if (existsSync(src) && createHash("sha256").update(readFileSync(src)).digest("hex") !== h) add("warn", "ota-stale", f, `differs from src/content/data/${t}.json (re-run release:pack)`);
      }
      const bf = join(DATA, "bundle-manifest.json");
      if (existsSync(bf)) { const b = readJson(bf); if (b && Number(b.coursesVersion) !== Number(m.coursesVersion)) add("warn", "ota-stale", mf, `coursesVersion ${m.coursesVersion} != bundle-manifest ${b.coursesVersion}`); }
      const zip = join(OUT, m.uiBundle || "app-ui.zip");
      if (m.uiBundle && existsSync(zip)) { if (createHash("sha256").update(readFileSync(zip)).digest("hex") !== m.sha256?.uiBundle) add("error", "ota-hash-mismatch", zip, "manifest.sha256.uiBundle does not match zip"); }
    }
  }
}

/* ---------- report ---------- */
const errors = problems.filter((p) => p.severity === "error");
const warns = problems.filter((p) => p.severity === "warn");
if (process.argv.includes("--json")) {
  console.log(JSON.stringify({ errors: errors.length, warnings: warns.length, problems }, null, 2));
} else {
  const byCode = {};
  for (const p of problems) { const k = `${p.severity}:${p.code}`; byCode[k] = (byCode[k] || 0) + 1; }
  for (const p of problems) console.log(`${p.severity.toUpperCase().padEnd(5)} ${p.code.padEnd(20)} ${p.file}${p.id ? ` [${p.id}]` : ""} - ${p.msg}`);
  console.log("\n--- summary by code ---");
  for (const [k, v] of Object.entries(byCode).sort()) console.log(String(v).padStart(5), k);
  console.log(`\nTracks: ${TRACKS.map((t) => `${t}=${allIdsByTrack[t]?.size ?? 0}`).join(" ")}`);
  console.log(`TOTAL: ${errors.length} errors, ${warns.length} warnings`);
}
process.exit(errors.length ? 1 : 0);