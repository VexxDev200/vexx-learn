/**
 * Builds build/icon.ico + build/icon.png from public/logo.svg (Windows exe icon).
 */
import { mkdirSync, writeFileSync } from "fs";
import { dirname, join } from "path";
import { fileURLToPath } from "url";
import sharp from "sharp";
import pngToIco from "png-to-ico";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const SVG = join(ROOT, "public", "logo.svg");
const OUT = join(ROOT, "build");

mkdirSync(OUT, { recursive: true });

const sizes = [256, 128, 64, 48, 32, 16];
const pngBuffers = [];

for (const size of sizes) {
  const buf = await sharp(SVG).resize(size, size).png().toBuffer();
  pngBuffers.push(buf);
  if (size === 256) {
    writeFileSync(join(OUT, "icon.png"), buf);
  }
}

const ico = await pngToIco(pngBuffers);
writeFileSync(join(OUT, "icon.ico"), ico);
console.log("[icon] build/icon.ico + build/icon.png");
