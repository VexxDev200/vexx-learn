import { copyFileSync, cpSync, existsSync, mkdirSync } from "fs";
import { dirname, join } from "path";
import { fileURLToPath } from "url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const SRC = join(ROOT, "src", "content", "data");
const DST = join(ROOT, "dist", "content", "data");

mkdirSync(DST, { recursive: true });
for (const f of ["python.json", "java.json", "cpp.json", "csharp.json", "bundle-manifest.json"]) {
  const s = join(SRC, f);
  if (existsSync(s)) copyFileSync(s, join(DST, f));
}
console.log("[copy-course-data] -> dist/content/data");
