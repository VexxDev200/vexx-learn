/**
 * Run every security track check against lesson starterCode (must match expected).
 */
import { readFileSync } from "fs";
import { spawnSync } from "child_process";
import { dirname, join } from "path";
import { fileURLToPath } from "url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const path = join(ROOT, "src", "content", "data", "security.json");
const py = process.platform === "win32" ? "python" : "python3";
const lessons = JSON.parse(readFileSync(path, "utf8"));

let fail = 0;
for (const L of lessons) {
  const code = L.starterCode || L.exampleCode;
  if (!code || !L.checks?.length) continue;
  for (let i = 0; i < L.checks.length; i++) {
    const c = L.checks[i];
    const r = spawnSync(py, ["-u", "-c", code], {
      input: c.stdin ?? "",
      encoding: "utf8",
      timeout: 15000,
    });
    const out = (r.stdout || "").replace(/\r\n/g, "\n").trimEnd();
    const exp = (c.expectedStdout ?? "").replace(/\r\n/g, "\n").trimEnd();
    const ok = r.status === 0 && out === exp;
    if (!ok) {
      fail++;
      console.error(`FAIL ${L.id} check ${i + 1}`);
      console.error("  expected:", JSON.stringify(exp));
      console.error("  got:", JSON.stringify(out));
      if (r.stderr) console.error("  stderr:", r.stderr.slice(0, 500));
    }
  }
}
if (fail) {
  console.error(`\n${fail} check(s) failed`);
  process.exit(1);
}
console.log(`OK — ${lessons.length} lessons, all checks passed`);
