import { readFileSync, writeFileSync } from "fs";
import { dirname, join } from "path";
import { fileURLToPath } from "url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const pkgPath = join(ROOT, "package.json");
const pkg = JSON.parse(readFileSync(pkgPath, "utf8"));
const parts = String(pkg.version || "0.0.0")
  .split(".")
  .map((x) => parseInt(x, 10) || 0);
while (parts.length < 3) parts.push(0);
parts[2] += 1;
const next = parts.join(".");
pkg.version = next;
writeFileSync(pkgPath, JSON.stringify(pkg, null, 2) + "\n", "utf8");
process.stdout.write(next);
