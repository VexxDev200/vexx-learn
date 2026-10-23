// How Vexx Learn runs C#.
//
// There is no `csc`/`mcs` anywhere: the code is written to a temp project and executed with `dotnet run`
// (the C# compiler ships inside the .NET SDK). The project used to pin `net8.0`, which on a machine that only has a
// newer SDK (e.g. 10.x) needs the Microsoft.NETCore.App.Ref 8.0 targeting pack from NuGet: it works only while that pack
// is in the NuGet cache or the network is up, otherwise `dotnet run` dies with NU1301 restore errors.
// So the target framework is now taken from the newest installed SDK (`dotnet --list-sdks`): the SDK always bundles the
// reference pack and runtime for its own major version, so restore needs no network for a plain console app.
//
// When the toolchain is missing the user gets a clear message instead of a crash. All dependencies are injectable.
import { spawnSync as realSpawnSync } from "child_process";
import { mkdtempSync, rmSync, writeFileSync } from "fs";
import { tmpdir } from "os";
import { join } from "path";

export const MIN_SDK_MAJOR = 6;

// ".NET SDK not found. Install .NET SDK 8 or newer (...): the C# compiler is part of it."
export const MSG_NO_DOTNET =
  ".NET SDK \u043d\u0435 \u043d\u0430\u0439\u0434\u0435\u043d. \u0423\u0441\u0442\u0430\u043d\u043e\u0432\u0438\u0442\u0435 .NET SDK 8 \u0438\u043b\u0438 \u043d\u043e\u0432\u0435\u0435 (https://dotnet.microsoft.com/download): \u043a\u043e\u043c\u043f\u0438\u043b\u044f\u0442\u043e\u0440 C# \u0432\u0445\u043e\u0434\u0438\u0442 \u0432 \u0435\u0433\u043e \u0441\u043e\u0441\u0442\u0430\u0432.";
// ".NET SDK not found: only a runtime without SDK is installed. Install .NET SDK 8 or newer (...)."
export const MSG_NO_SDK =
  ".NET SDK \u043d\u0435 \u043d\u0430\u0439\u0434\u0435\u043d: \u043d\u0430\u0439\u0434\u0435\u043d \u0442\u043e\u043b\u044c\u043a\u043e runtime \u0431\u0435\u0437 SDK. \u0423\u0441\u0442\u0430\u043d\u043e\u0432\u0438\u0442\u0435 .NET SDK 8 \u0438\u043b\u0438 \u043d\u043e\u0432\u0435\u0435 (https://dotnet.microsoft.com/download).";
// ".NET SDK is too old: .NET SDK 6 or newer is needed to run C#."
export const MSG_SDK_TOO_OLD =
  ".NET SDK \u0441\u043b\u0438\u0448\u043a\u043e\u043c \u0441\u0442\u0430\u0440\u044b\u0439: \u043d\u0443\u0436\u0435\u043d .NET SDK 6 \u0438\u043b\u0438 \u043d\u043e\u0432\u0435\u0435 \u0434\u043b\u044f \u0437\u0430\u043f\u0443\u0441\u043a\u0430 C#.";
// "Could not determine the .NET SDK version: "
export const MSG_DETECT_FAILED_PREFIX =
  "\u041d\u0435 \u0443\u0434\u0430\u043b\u043e\u0441\u044c \u043e\u043f\u0440\u0435\u0434\u0435\u043b\u0438\u0442\u044c \u0432\u0435\u0440\u0441\u0438\u044e .NET SDK: ";

/** Major versions found in `dotnet --list-sdks` output ("10.0.400 [C:\Program Files\dotnet\sdk]"). */
export function parseSdkMajors(text) {
  const majors = [];
  for (const line of String(text ?? "").split(/\r?\n/)) {
    const m = /^\s*(\d+)\.\d+\.\d+\S*\s+\[/.exec(line);
    if (m) majors.push(Number(m[1]));
  }
  return majors;
}

/** Target framework for the newest SDK, or null when there is no usable SDK. */
export function pickTfm(majors) {
  if (!Array.isArray(majors) || majors.length === 0) return null;
  const max = Math.max(...majors);
  if (!Number.isInteger(max) || max < MIN_SDK_MAJOR) return null;
  return `net${max}.0`;
}

let cached = null; // only a successful detection is cached; failures are retried (the user may install the SDK meanwhile)
export function resetDotnetCache() {
  cached = null;
}

/** @returns {{ ok: true, tfm: string, major: number } | { ok: false, kind: string, message: string }} */
export function detectDotnet({ spawnSync = realSpawnSync, useCache = true } = {}) {
  if (useCache && cached) return cached;
  let r;
  try {
    r = spawnSync("dotnet", ["--list-sdks"], { encoding: "utf8", windowsHide: true, timeout: 15000 });
  } catch (e) {
    r = { error: e };
  }
  if (r?.error) {
    if (r.error.code === "ENOENT") return { ok: false, kind: "missing", message: MSG_NO_DOTNET };
    return { ok: false, kind: "error", message: MSG_DETECT_FAILED_PREFIX + String(r.error.message || r.error.code || r.error) };
  }
  if (r?.status !== 0) {
    const why = String(r?.stderr || r?.stdout || "exit " + r?.status).trim().split(/\r?\n/)[0];
    return { ok: false, kind: "error", message: MSG_DETECT_FAILED_PREFIX + why };
  }
  const majors = parseSdkMajors(r.stdout);
  if (majors.length === 0) return { ok: false, kind: "no-sdk", message: MSG_NO_SDK };
  const tfm = pickTfm(majors);
  if (!tfm) return { ok: false, kind: "too-old", message: MSG_SDK_TOO_OLD };
  const res = { ok: true, tfm, major: Math.max(...majors) };
  if (useCache) cached = res;
  return res;
}

export function csprojText(tfm) {
  return `<Project Sdk="Microsoft.NET.Sdk">
  <PropertyGroup>
    <OutputType>Exe</OutputType>
    <TargetFramework>${tfm}</TargetFramework>
    <ImplicitUsings>disable</ImplicitUsings>
    <Nullable>disable</Nullable>
  </PropertyGroup>
</Project>`;
}

export function dotnetRunArgs(csproj) {
  return ["run", "--project", csproj];
}

/** No telemetry / first-run banner noise in the program output the lessons compare against. */
export function dotnetEnv(base = process.env) {
  return {
    ...base,
    DOTNET_CLI_TELEMETRY_OPTOUT: "1",
    DOTNET_NOLOGO: "1",
    DOTNET_SKIP_FIRST_TIME_EXPERIENCE: "1",
  };
}

/**
 * Writes the temp project. Returns { ok: false, message } (nothing created) when there is no usable SDK,
 * otherwise { ok: true, dir, csproj, tfm, args, env }. The caller spawns `dotnet` with args/env and removes dir.
 */
export function prepareCsharp(source, deps = {}) {
  const { detect = detectDotnet, mkdtemp = mkdtempSync, write = writeFileSync, remove = rmSync, tmp = tmpdir } = deps;
  const sdk = detect();
  if (!sdk.ok) return { ok: false, message: sdk.message };
  const dir = mkdtemp(join(tmp(), "vexx-cs-"));
  try {
    write(join(dir, "Program.cs"), source, "utf8");
    const csproj = join(dir, "App.csproj");
    write(csproj, csprojText(sdk.tfm), "utf8");
    return { ok: true, dir, csproj, tfm: sdk.tfm, args: dotnetRunArgs(csproj), env: dotnetEnv() };
  } catch (e) {
    try {
      remove(dir, { recursive: true, force: true });
    } catch {
      /* */
    }
    throw e;
  }
}