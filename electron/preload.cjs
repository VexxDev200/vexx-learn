const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("vexxLearn", {
  listLessons: () => ipcRenderer.invoke("lessons:list"),
  getProgress: () => ipcRenderer.invoke("progress:get"),
  completeLesson: (id) => ipcRenderer.invoke("progress:complete", id),
  getCourses: () => ipcRenderer.invoke("courses:get"),
  getSettings: () => ipcRenderer.invoke("settings:get"),
  setSettings: (patch) => ipcRenderer.invoke("settings:set", patch),
  getAppVersion: () => ipcRenderer.invoke("app:version"),
  checkUpdates: () => ipcRenderer.invoke("updater:check"),
  getPendingAppUpdate: () => ipcRenderer.invoke("updater:pending-app"),
  getUpdateSource: () => ipcRenderer.invoke("updates:source"),
  onUpdateResult: (cb) => {
    const handler = (_e, payload) => cb(payload);
    ipcRenderer.on("vexx:update-result", handler);
    return () => ipcRenderer.removeListener("vexx:update-result", handler);
  },
  runPython: (code, stdin) => ipcRenderer.invoke("run:python", { code, stdin }),
  checkPython: (code, checks) => ipcRenderer.invoke("check:python", { code, checks }),
  runJava: (code) => ipcRenderer.invoke("run:java", { code }),
  checkJava: (code, checks) => ipcRenderer.invoke("check:java", { code, checks }),
  runCpp: (code) => ipcRenderer.invoke("run:cpp", { code }),
  checkCpp: (code, checks) => ipcRenderer.invoke("check:cpp", { code, checks }),
  runCsharp: (code) => ipcRenderer.invoke("run:csharp", { code }),
  checkCsharp: (code, checks) => ipcRenderer.invoke("check:csharp", { code, checks }),
  openExternal: (url) => ipcRenderer.invoke("shell:open", url),
});
