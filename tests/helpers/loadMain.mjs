// Loads electron/main.mjs with a mocked "electron" module and returns the registered IPC handlers.
// Requires: node --experimental-test-module-mocks --test
import { mock } from "node:test";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

let currentMock = null;

export async function loadMain() {
  currentMock?.restore();
  const userData = mkdtempSync(join(tmpdir(), "vexx-test-userdata-"));
  const handlers = new Map();
  const listeners = new Map();
  const shellCalls = { openExternal: [], openPath: [] };
  const appListeners = new Map();
  const windows = [];

  class BrowserWindow {
    constructor() {
      this.webContents = { on() {}, send() {} };
      windows.push(this);
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
      on: (ev, fn) => appListeners.set(ev, fn),
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
  currentMock = mock.module("electron", { defaultExport: electron, namedExports: electron });

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
    appListeners,
    windows,
    shellCalls,
    restore() {
      globalThis.fetch = realFetch;
    },
  };
}