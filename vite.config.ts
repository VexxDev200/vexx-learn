import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";
import { injectCsp } from "./electron/csp.mjs";

// CSP only in the production build (see electron/csp.mjs): the vite dev server needs inline scripts for HMR.
const cspPlugin = {
  name: "vexx-csp",
  apply: "build" as const,
  transformIndexHtml: { order: "post" as const, handler: (html: string) => injectCsp(html) },
};

export default defineConfig({
  plugins: [react(), cspPlugin],
  base: "./",
  server: { port: 5173, strictPort: true },
  build: { outDir: "dist", emptyOutDir: true },
});