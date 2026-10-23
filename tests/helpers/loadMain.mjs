// Loads electron/main.mjs with a mocked "electron" module and returns the registered IPC handlers.
// Requires: node --experimental-test-module-mocks --test
import { mock } from "node:test";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

export async function loadMain() {
  const userData = mkdtempSync(join(tmpdir(), "vexx-test-userdata-"));
  const handlers = new Map();
  const listeners = new Map();
  const shellCalls = { openExternal: [], openPath: [] };

  class BrowserWindow {
    constructor() {
      this.webContents = { on() {}, send() {} };
    }
    loadURL() {}
    loadFile() {}
    setIcon() {}
    on() {}
  }
  const electron = {
    app: {
      isPackaged: false,
      getPath: () => userData,
      getAppPath: () => process.cwd(),
      whenReady: () => Promise.resolve(),
      on() {},
      quit() {},
    },
    BrowserWindow,
    ipcMain: {
      handle: (ch, fn) => handlers.set(ch, fn),
      on: (ch, fn) => listeners.set(ch, fn),
    },
    Menu: { setApplicationMenu() {} },
    nativeImage: { createFromPath: () => ({ isEmpty: () => true }) },
    shell: {
      openExternal: async (u) => { shellCalls.openExternal.push(u); },
      openPath: async (p) => { shellCalls.openPath.push(p); return ""; },
    },
  };
  mock.module("electron", { defaultExport: electron, namedExports: electron });

  // never touch the network from tests
  const realFetch = globalThis.fetch;
  globalThis.fetch = async () => { throw new Error("network disabled in tests"); };

  await import("../../electron/main.mjs?t=" + Date.now());
  // main.mjs registers handlers inside whenReady().then(...) — let microtasks run
  await new Promise((r) => setTimeout(r, 50));

  return {
    userData,
    handlers,
    listeners,
    shellCalls,
    restore() { globalThis.fetch = realFetch; },
  };
}