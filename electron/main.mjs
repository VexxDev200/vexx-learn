import { app, BrowserWindow, ipcMain, Menu, nativeImage, shell } from "electron";
import { loadAllCourses } from "./courses.mjs";
import { loadSettings, saveSettings } from "./settings.mjs";
import { isGitHubConfigured, loadUpdateConfig } from "./update-config.mjs";
import { getLocalUiVersion, resolveUiRoot } from "./app-ui.mjs";
import {
  checkAndApplyUpdates,
  getUpdateSourceInfo,
  isIncompleteGithubRawUrl,
  resolveCoursesBaseForSettings,
} from "./update.mjs";
import { spawn } from "child_process";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "fs";
import { tmpdir } from "os";
import { dirname, join } from "path";
import { fileURLToPath } from "url";

const __dir = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dir, "..");
const isDev = !app.isPackaged;

function appRoot() {
  return app.isPackaged ? app.getAppPath() : ROOT;
}
const PROGRESS = join(app.getPath("userData"), "vexx-learn-progress.json");
let mainWindow = null;

function readAppVersion() {
  const bases = app.isPackaged
    ? [app.getAppPath(), ROOT]
    : [ROOT, join(__dir, "..")];
  for (const base of bases) {
    try {
      const p = join(base, "package.json");
      if (!existsSync(p)) continue;
      const pkg = JSON.parse(readFileSync(p, "utf8"));
      if (pkg.version) return pkg.version;
    } catch {
      /* try next */
    }
  }
  return "0.0.0";
}

function loadProgress() {
  try {
    if (!existsSync(PROGRESS)) return { completed: [], streak: { count: 0, lastStudyDate: "" } };
    const p = JSON.parse(readFileSync(PROGRESS, "utf8"));
    return {
      completed: p.completed || [],
      streak: p.streak || { count: 0, lastStudyDate: "" },
    };
  } catch {
    return { completed: [], streak: { count: 0, lastStudyDate: "" } };
  }
}

function saveProgress(data) {
  mkdirSync(dirname(PROGRESS), { recursive: true });
  writeFileSync(PROGRESS, JSON.stringify(data, null, 2), "utf8");
}

function createWindow() {
  const preloadPath = join(__dir, "preload.cjs");
  if (!existsSync(preloadPath)) {
    console.error("[vexx-learn] preload missing:", preloadPath);
  }

  const win = new BrowserWindow({
    width: 1280,
    height: 820,
    minWidth: 900,
    minHeight: 600,
    title: "Vexx Learn",
    backgroundColor: "#0f1117",
    webPreferences: {
      preload: preloadPath,
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
    },
  });

  win.webContents.on("preload-error", (_event, path, err) => {
    console.error("[vexx-learn] preload-error", path, err);
  });

  const iconIco = join(ROOT, "build", "icon.ico");
  const iconPath = existsSync(iconIco) ? iconIco : join(ROOT, "public", "logo.svg");
  if (existsSync(iconPath)) {
    const img = nativeImage.createFromPath(iconPath);
    if (!img.isEmpty()) {
      win.setIcon(img);
      if (process.platform === "darwin") app.dock?.setIcon(img);
    }
  }

  mainWindow = win;

  if (isDev) {
    win.loadURL("http://127.0.0.1:5173");
  } else {
    const bundledDist = join(ROOT, "dist");
    const uiRoot = resolveUiRoot(app.getPath("userData"), bundledDist);
    win.loadFile(join(uiRoot, "index.html"));
  }
}

function reloadMainWindowUi() {
  if (!mainWindow || isDev) return;
  const bundledDist = join(ROOT, "dist");
  const uiRoot = resolveUiRoot(app.getPath("userData"), bundledDist);
  mainWindow.loadFile(join(uiRoot, "index.html"));
}

function updatesConfigured(settings) {
  const root = appRoot();
  const cfg = loadUpdateConfig(root);
  const base = resolveCoursesBaseForSettings(settings, root);
  return Boolean(base || isGitHubConfigured(cfg));
}

async function runBackgroundUpdate() {
  const userData = app.getPath("userData");
  const settings = loadSettings(userData);
  if (!updatesConfigured(settings)) return null;
  if (!settings.autoUpdateCourses && !settings.autoCheckApp) return null;
  const result = await checkAndApplyUpdates({
    appRoot: appRoot(),
    userData,
    settings,
    appVersion: readAppVersion(),
  });
  if (result.needsReload) reloadMainWindowUi();
  mainWindow?.webContents?.send("vexx:update-result", result);
  return result;
}

function runPython(code, stdin = "") {
  return new Promise((resolve) => {
    const py = process.platform === "win32" ? "python" : "python3";
    const child = spawn(py, ["-u", "-c", code], {
      windowsHide: true,
      env: { ...process.env, PYTHONIOENCODING: "utf-8" },
    });
    let stdout = "";
    let stderr = "";
    child.stdout.on("data", (d) => { stdout += d.toString(); });
    child.stderr.on("data", (d) => { stderr += d.toString(); });
    if (stdin) child.stdin.write(stdin);
    child.stdin.end();
    const timer = setTimeout(() => {
      child.kill();
      resolve({ ok: false, stdout, stderr: stderr + "\n[timeout 8s]", exitCode: -1 });
    }, 8000);
    child.on("close", (code) => {
      clearTimeout(timer);
      resolve({ ok: code === 0, stdout, stderr, exitCode: code ?? 1 });
    });
    child.on("error", (e) => {
      clearTimeout(timer);
      resolve({
        ok: false,
        stdout: "",
        stderr:
          (e.code === "ENOENT"
            ? "Python не найден. Установи с python.org и отметь «Add to PATH»."
            : e.message) + "\n",
        exitCode: -1,
      });
    });
  });
}

function runJava(source) {
  return new Promise((resolve) => {
    let dir;
    try {
      dir = mkdtempSync(join(tmpdir(), "vexx-java-"));
      const file = join(dir, "Main.java");
      writeFileSync(file, source, "utf8");
      const compile = spawn("javac", [file], { cwd: dir, windowsHide: true });
      let cerr = "";
      compile.stderr.on("data", (d) => { cerr += d.toString(); });
      compile.on("close", (code) => {
        if (code !== 0) {
          resolve({ ok: false, stdout: "", stderr: cerr || "javac failed", exitCode: code ?? 1 });
          try { rmSync(dir, { recursive: true, force: true }); } catch { /* */ }
          return;
        }
        const child = spawn("java", ["Main"], { cwd: dir, windowsHide: true });
        let stdout = "";
        let stderr = "";
        child.stdout.on("data", (d) => { stdout += d.toString(); });
        child.stderr.on("data", (d) => { stderr += d.toString(); });
        const timer = setTimeout(() => {
          child.kill();
          resolve({ ok: false, stdout, stderr: stderr + "\n[timeout 12s]", exitCode: -1 });
          try { rmSync(dir, { recursive: true, force: true }); } catch { /* */ }
        }, 12000);
        child.on("close", (c) => {
          clearTimeout(timer);
          try { rmSync(dir, { recursive: true, force: true }); } catch { /* */ }
          resolve({ ok: c === 0, stdout, stderr, exitCode: c ?? 1 });
        });
        child.on("error", (e) => {
          clearTimeout(timer);
          try { rmSync(dir, { recursive: true, force: true }); } catch { /* */ }
          resolve({
            ok: false,
            stdout: "",
            stderr:
              (e.code === "ENOENT"
                ? "JDK не найден. Установи Java JDK и добавь javac/java в PATH."
                : e.message) + "\n",
            exitCode: -1,
          });
        });
      });
      compile.on("error", (e) => {
        try { rmSync(dir, { recursive: true, force: true }); } catch { /* */ }
        resolve({
          ok: false,
          stdout: "",
          stderr:
            (e.code === "ENOENT"
              ? "JDK не найден (javac). Установи JDK 17+."
              : e.message) + "\n",
          exitCode: -1,
        });
      });
    } catch (e) {
      resolve({ ok: false, stdout: "", stderr: e.message + "\n", exitCode: -1 });
    }
  });
}

function runCpp(source) {
  return new Promise((resolve) => {
    let dir;
    try {
      dir = mkdtempSync(join(tmpdir(), "vexx-cpp-"));
      const src = join(dir, "main.cpp");
      writeFileSync(src, source, "utf8");
      const exe = join(dir, process.platform === "win32" ? "main.exe" : "main");
      const compile = spawn("g++", ["-std=c++17", "-O0", "-o", exe, src], {
        cwd: dir,
        windowsHide: true,
      });
      let cerr = "";
      compile.stderr.on("data", (d) => { cerr += d.toString(); });
      compile.on("close", (code) => {
        if (code !== 0) {
          resolve({ ok: false, stdout: "", stderr: cerr || "g++ failed", exitCode: code ?? 1 });
          try { rmSync(dir, { recursive: true, force: true }); } catch { /* */ }
          return;
        }
        const child = spawn(exe, [], { cwd: dir, windowsHide: true });
        let stdout = "";
        let stderr = "";
        child.stdout.on("data", (d) => { stdout += d.toString(); });
        child.stderr.on("data", (d) => { stderr += d.toString(); });
        const timer = setTimeout(() => {
          child.kill();
          resolve({ ok: false, stdout, stderr: stderr + "\n[timeout 12s]", exitCode: -1 });
          try { rmSync(dir, { recursive: true, force: true }); } catch { /* */ }
        }, 12000);
        child.on("close", (c) => {
          clearTimeout(timer);
          try { rmSync(dir, { recursive: true, force: true }); } catch { /* */ }
          resolve({ ok: c === 0, stdout, stderr, exitCode: c ?? 1 });
        });
        child.on("error", (e) => {
          clearTimeout(timer);
          try { rmSync(dir, { recursive: true, force: true }); } catch { /* */ }
          resolve({
            ok: false,
            stdout: "",
            stderr:
              (e.code === "ENOENT"
                ? "g++ не найден. Установи MinGW-w64 или MSVC build tools."
                : e.message) + "\n",
            exitCode: -1,
          });
        });
      });
      compile.on("error", (e) => {
        try { rmSync(dir, { recursive: true, force: true }); } catch { /* */ }
        resolve({
          ok: false,
          stdout: "",
          stderr:
            (e.code === "ENOENT"
              ? "g++ не найден. Добавь MinGW в PATH."
              : e.message) + "\n",
          exitCode: -1,
        });
      });
    } catch (e) {
      resolve({ ok: false, stdout: "", stderr: e.message + "\n", exitCode: -1 });
    }
  });
}

function runCsharp(source) {
  return new Promise((resolve) => {
    let dir;
    try {
      dir = mkdtempSync(join(tmpdir(), "vexx-cs-"));
      writeFileSync(join(dir, "Program.cs"), source, "utf8");
      writeFileSync(
        join(dir, "App.csproj"),
        `<Project Sdk="Microsoft.NET.Sdk">
  <PropertyGroup>
    <OutputType>Exe</OutputType>
    <TargetFramework>net8.0</TargetFramework>
    <ImplicitUsings>disable</ImplicitUsings>
    <Nullable>disable</Nullable>
  </PropertyGroup>
</Project>`,
        "utf8"
      );
      const child = spawn("dotnet", ["run", "--project", join(dir, "App.csproj")], {
        cwd: dir,
        windowsHide: true,
      });
      let stdout = "";
      let stderr = "";
      child.stdout.on("data", (d) => { stdout += d.toString(); });
      child.stderr.on("data", (d) => { stderr += d.toString(); });
      const timer = setTimeout(() => {
        child.kill();
        resolve({ ok: false, stdout, stderr: stderr + "\n[timeout 20s]", exitCode: -1 });
        try { rmSync(dir, { recursive: true, force: true }); } catch { /* */ }
      }, 20000);
      child.on("close", (c) => {
        clearTimeout(timer);
        try { rmSync(dir, { recursive: true, force: true }); } catch { /* */ }
        resolve({ ok: c === 0, stdout, stderr, exitCode: c ?? 1 });
      });
      child.on("error", (e) => {
        clearTimeout(timer);
        try { rmSync(dir, { recursive: true, force: true }); } catch { /* */ }
        resolve({
          ok: false,
          stdout: "",
          stderr:
            (e.code === "ENOENT"
              ? ".NET SDK не найден. Установи .NET 8 SDK."
              : e.message) + "\n",
          exitCode: -1,
        });
      });
    } catch (e) {
      resolve({ ok: false, stdout: "", stderr: e.message + "\n", exitCode: -1 });
    }
  });
}

function runChecks(runFn, code, checks) {
  const norm = (s) => String(s || "").replace(/\r\n/g, "\n").trimEnd();
  return (async () => {
    const results = [];
    for (const c of checks || []) {
      const r = await runFn(code, c.stdin || "");
      const pass =
        r.ok &&
        (c.expectedStdout === undefined ||
          norm(r.stdout) === norm(c.expectedStdout));
      results.push({
        pass,
        stdout: r.stdout,
        stderr: r.stderr,
        expected: c.expectedStdout,
        hint: c.hint || "",
      });
    }
    const allPass = results.length > 0 && results.every((x) => x.pass);
    return { allPass, results };
  })();
}

app.whenReady().then(() => {
  Menu.setApplicationMenu(null);
  ipcMain.handle("lessons:list", async () => {
    const base = join(appRoot(), "lessons");
    const tracks = ["python", "java", "cpp", "csharp"];
    const out = {};
    for (const track of tracks) {
      out[track] = [];
      const dir = join(base, track);
      const manPath = join(dir, "manifest.json");
      if (!existsSync(manPath)) continue;
      try {
        const manifest = JSON.parse(readFileSync(manPath, "utf8"));
        for (const id of manifest.order || []) {
          const p = join(dir, `${id}.json`);
          if (existsSync(p)) {
            out[track].push(JSON.parse(readFileSync(p, "utf8")));
          }
        }
      } catch (e) {
        console.warn("[lessons]", track, e.message);
      }
    }
    return out;
  });

  ipcMain.handle("progress:get", () => loadProgress());
  ipcMain.handle("progress:complete", (_, lessonId) => {
    const p = loadProgress();
    if (!p.completed.includes(lessonId)) p.completed.push(lessonId);
    const today = new Date();
    const y = today.getFullYear();
    const m = String(today.getMonth() + 1).padStart(2, "0");
    const d = String(today.getDate()).padStart(2, "0");
    const todayStr = `${y}-${m}-${d}`;
    const st = p.streak || { count: 0, lastStudyDate: "" };
    if (st.lastStudyDate !== todayStr) {
      const prev = st.lastStudyDate;
      let count = 1;
      if (prev) {
        const da = new Date(prev + "T12:00:00");
        const db = new Date(todayStr + "T12:00:00");
        const diff = Math.round((db - da) / 86400000);
        if (diff === 1) count = (st.count || 0) + 1;
        else if (diff > 1) count = 1;
      }
      p.streak = { count, lastStudyDate: todayStr };
    }
    saveProgress(p);
    return p;
  });

  ipcMain.handle("run:python", (_, { code, stdin }) => runPython(code, stdin || ""));
  ipcMain.handle("check:python", (_, { code, checks }) => runChecks(runPython, code, checks));
  ipcMain.handle("run:java", (_, { code }) => runJava(code));
  ipcMain.handle("check:java", (_, { code, checks }) => runChecks(runJava, code, checks));
  ipcMain.handle("run:cpp", (_, { code }) => runCpp(code));
  ipcMain.handle("check:cpp", (_, { code, checks }) => runChecks(runCpp, code, checks));
  ipcMain.handle("run:csharp", (_, { code }) => runCsharp(code));
  ipcMain.handle("check:csharp", (_, { code, checks }) => runChecks(runCsharp, code, checks));

  ipcMain.handle("shell:open", (_, url) => {
    shell.openExternal(url);
  });

  ipcMain.handle("courses:get", () => {
    const data = loadAllCourses(appRoot(), app.getPath("userData"));
    return data;
  });

  ipcMain.handle("settings:get", () => loadSettings(app.getPath("userData")));
  ipcMain.handle("settings:set", (_, patch) => {
    const userData = app.getPath("userData");
    const next = { ...loadSettings(userData), ...patch };
    if (
      typeof next.updateBaseUrl === "string" &&
      isIncompleteGithubRawUrl(next.updateBaseUrl.trim())
    ) {
      next.updateBaseUrl = "";
    }
    saveSettings(userData, next);
    return next;
  });

  ipcMain.handle("app:version", () =>
    getLocalUiVersion(app.getPath("userData"), readAppVersion())
  );

  ipcMain.handle("updater:check", async () => {
    const userData = app.getPath("userData");
    const settings = loadSettings(userData);
    return checkAndApplyUpdates({
      appRoot: appRoot(),
      userData,
      settings,
      appVersion: readAppVersion(),
    });
  });

  ipcMain.handle("shell:open-path", (_, filePath) => shell.openPath(filePath));

  ipcMain.handle("updater:pending-app", () => loadPendingAppUpdate(app.getPath("userData")));

  ipcMain.handle("updates:source", () => {
    const userData = app.getPath("userData");
    const settings = loadSettings(userData);
    return getUpdateSourceInfo(appRoot(), settings);
  });

  createWindow();
  setTimeout(() => {
    runBackgroundUpdate().catch((e) => console.warn("[vexx-learn] update", e.message));
  }, 800);
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});
