import { spawn } from "child_process";
import { mkdtempSync, rmSync, writeFileSync } from "fs";
import { tmpdir } from "os";
import { join } from "path";

const MAX_RUN_MS = 10 * 60 * 1000;

/** @type {{ child: import('child_process').ChildProcess, cleanup: () => void, sessionId: number } | null} */
let active = null;
let nextSessionId = 0;

function send(webContents, payload) {
  if (!webContents || webContents.isDestroyed()) return;
  webContents.send("vexx:run", payload);
}

function killActiveChild() {
  if (!active) return null;
  const session = active;
  active = null;
  try {
    session.child.kill();
  } catch {
    /* */
  }
  try {
    session.cleanup();
  } catch {
    /* */
  }
  return session;
}

export function stopInteractiveRun() {
  killActiveChild();
}

export function abortInteractiveRun(webContents) {
  const sid = active?.sessionId;
  killActiveChild();
  if (sid != null) {
    send(webContents, { type: "done", ok: false, exitCode: -1, aborted: true, sessionId: sid });
  }
}

function finishSession(webContents, sessionId, ok, exitCode, extra = "") {
  if (extra) send(webContents, { type: "stderr", data: extra, sessionId });
  send(webContents, { type: "done", ok, exitCode, sessionId });
  if (active?.sessionId === sessionId) {
    try {
      active.cleanup();
    } catch {
      /* */
    }
    active = null;
  }
}

function attachChild(webContents, child, cleanup, sessionId) {
  stopInteractiveRun();
  active = { child, cleanup, sessionId };

  send(webContents, { type: "started", sessionId });

  let stdout = "";
  let stderr = "";
  child.stdout?.on("data", (d) => {
    const chunk = d.toString();
    stdout += chunk;
    send(webContents, { type: "stdout", data: chunk, sessionId });
  });
  child.stderr?.on("data", (d) => {
    const chunk = d.toString();
    stderr += chunk;
    send(webContents, { type: "stderr", data: chunk, sessionId });
  });

  const timer = setTimeout(() => {
    try {
      child.kill();
    } catch {
      /* */
    }
    finishSession(webContents, sessionId, false, -1, "\n[timeout 10m]\n");
  }, MAX_RUN_MS);

  const end = (code, errMsg) => {
    clearTimeout(timer);
    const ok = code === 0 && !errMsg;
    finishSession(webContents, sessionId, ok, code ?? 1, errMsg || "");
  };

  child.on("close", (code) => end(code ?? 1, ""));
  child.on("error", (e) => {
    clearTimeout(timer);
    const msg =
      e.code === "ENOENT"
        ? toolMissingMessage(child.spawnfile || "")
        : e.message;
    finishSession(webContents, sessionId, false, -1, msg + "\n");
  });

  return { stdout, stderr };
}

function toolMissingMessage(cmd) {
  const c = String(cmd || "").toLowerCase();
  if (c.includes("python")) {
    return "Python не найден. Установи с python.org и отметь «Add to PATH».";
  }
  if (c.includes("javac") || c.includes("java")) {
    return "JDK не найден. Установи Java JDK 17+ и добавь в PATH.";
  }
  if (c.includes("g++")) {
    return "g++ не найден. Установи MinGW-w64 или MSVC build tools.";
  }
  if (c.includes("dotnet")) {
    return ".NET SDK не найден. Установи .NET 8 SDK.";
  }
  return "Не удалось запустить программу (команда не найдена в PATH).";
}

function prepPython(code) {
  const py = process.platform === "win32" ? "python" : "python3";
  const child = spawn(py, ["-u", "-c", code], {
    windowsHide: true,
    stdio: ["pipe", "pipe", "pipe"],
    env: { ...process.env, PYTHONIOENCODING: "utf-8" },
  });
  return { child, cleanup: () => {} };
}

function compileJava(source) {
  return new Promise((resolve) => {
    let dir;
    try {
      dir = mkdtempSync(join(tmpdir(), "vexx-java-"));
      const file = join(dir, "Main.java");
      writeFileSync(file, source, "utf8");
      const compile = spawn("javac", [file], { cwd: dir, windowsHide: true });
      let cerr = "";
      compile.stderr.on("data", (d) => {
        cerr += d.toString();
      });
      compile.on("close", (code) => {
        if (code !== 0) {
          try {
            rmSync(dir, { recursive: true, force: true });
          } catch {
            /* */
          }
          resolve({ error: cerr || "javac failed" });
          return;
        }
        const child = spawn("java", ["Main"], {
          cwd: dir,
          windowsHide: true,
          stdio: ["pipe", "pipe", "pipe"],
        });
        resolve({
          child,
          cleanup: () => {
            try {
              rmSync(dir, { recursive: true, force: true });
            } catch {
              /* */
            }
          },
        });
      });
      compile.on("error", (e) => {
        try {
          rmSync(dir, { recursive: true, force: true });
        } catch {
          /* */
        }
        resolve({
          error:
            e.code === "ENOENT"
              ? "JDK не найден (javac). Установи JDK 17+."
              : e.message,
        });
      });
    } catch (e) {
      resolve({ error: e.message });
    }
  });
}

function compileCpp(source) {
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
      compile.stderr.on("data", (d) => {
        cerr += d.toString();
      });
      compile.on("close", (code) => {
        if (code !== 0) {
          try {
            rmSync(dir, { recursive: true, force: true });
          } catch {
            /* */
          }
          resolve({ error: cerr || "g++ failed" });
          return;
        }
        const child = spawn(exe, [], {
          cwd: dir,
          windowsHide: true,
          stdio: ["pipe", "pipe", "pipe"],
        });
        resolve({
          child,
          cleanup: () => {
            try {
              rmSync(dir, { recursive: true, force: true });
            } catch {
              /* */
            }
          },
        });
      });
      compile.on("error", (e) => {
        try {
          rmSync(dir, { recursive: true, force: true });
        } catch {
          /* */
        }
        resolve({
          error:
            e.code === "ENOENT"
              ? "g++ не найден. Добавь MinGW в PATH."
              : e.message,
        });
      });
    } catch (e) {
      resolve({ error: e.message });
    }
  });
}

function prepCsharp(source) {
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
      stdio: ["pipe", "pipe", "pipe"],
    });
    return {
      child,
      cleanup: () => {
        try {
          rmSync(dir, { recursive: true, force: true });
        } catch {
          /* */
        }
      },
    };
  } catch (e) {
    return { error: e.message };
  }
}

/**
 * @param {import('electron').WebContents} webContents
 * @param {string} lang python | java | cpp | csharp
 * @param {string} code
 */
export async function startInteractiveRun(webContents, lang, code) {
  stopInteractiveRun();
  const sessionId = ++nextSessionId;

  let prep;
  switch (lang) {
    case "java":
      prep = await compileJava(code);
      break;
    case "cpp":
      prep = await compileCpp(code);
      break;
    case "csharp":
      prep = prepCsharp(code);
      break;
    default:
      prep = prepPython(code);
      break;
  }

  if (prep.error) {
    send(webContents, { type: "started", sessionId });
    send(webContents, { type: "stderr", data: prep.error + "\n", sessionId });
    send(webContents, { type: "done", ok: false, exitCode: 1, sessionId });
    return { ok: false, error: prep.error, sessionId };
  }

  if (!prep.child) {
    send(webContents, { type: "done", ok: false, exitCode: 1, sessionId });
    return { ok: false, error: "spawn failed", sessionId };
  }

  attachChild(webContents, prep.child, prep.cleanup, sessionId);
  return { ok: true, sessionId };
}

export function writeInteractiveStdin(text) {
  if (!active?.child?.stdin?.writable) return false;
  try {
    active.child.stdin.write(text);
    return true;
  } catch {
    return false;
  }
}

export function isInteractiveRunActive() {
  return Boolean(active);
}
