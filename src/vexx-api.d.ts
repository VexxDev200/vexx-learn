import type { LessonDef } from "./content/types";
import type { VexxSettings } from "./settings/types";

export type LessonCheck = {
  stdin?: string;
  expectedStdout?: string;
  hint?: string;
};

export type Lesson = {
  id: string;
  track: string;
  kind?: "lesson" | "exam" | "ethics" | "project";
  editorLang?: "python" | "java" | "cpp" | "csharp";
  title: string;
  minutes: number;
  theory: string;
  exampleCode: string;
  exampleExplain: string;
  task: string;
  starterCode: string;
  checks: LessonCheck[];
  comingSoon?: boolean;
};

export type UpdateResult = {
  checked: boolean;
  coursesUpdated: boolean;
  coursesVersion: number;
  bundledCoursesVersion?: number;
  appVersion: string;
  remoteAppVersion: string | null;
  appUpdateUrl: string | null;
  appLocalPath?: string | null;
  appDownloaded?: boolean;
  appUpdateAvailable?: boolean;
  uiUpdated?: boolean;
  needsReload?: boolean;
  effectiveAppVersion?: string;
  message: string;
  error: string | null;
};

export type CoursesPayload = {
  courses: Record<string, LessonDef[]>;
  coursesVersion: number;
  source: string;
};

export type VexxLearnApi = {
  listLessons: () => Promise<Record<string, Lesson[]>>;
  getProgress: () => Promise<{
    completed: string[];
    streak?: { count: number; lastStudyDate: string };
  }>;
  completeLesson: (id: string) => Promise<{
    completed: string[];
    streak?: { count: number; lastStudyDate: string };
  }>;
  getCourses: () => Promise<CoursesPayload>;
  getSettings: () => Promise<VexxSettings>;
  setSettings: (
    patch: Partial<VexxSettings>
  ) => Promise<VexxSettings & { settingsErrors?: { updateBaseUrl?: string } }>;
  getAppVersion: () => Promise<string>;
  checkUpdates: () => Promise<UpdateResult>;
  getPendingAppUpdate: () => Promise<{ version: string; url: string; path?: string } | null>;
  onUpdateResult: (cb: (r: UpdateResult) => void) => () => void;
  getUpdateCapabilities: () => Promise<{ uiOta: boolean }>;
  getUpdateSource: () => Promise<{
    coursesBaseUrl: string;
    manifestUrl: string;
    githubConfigured: boolean;
    githubRepo: string | null;
    portableAssetName: string;
  }>;
  runPython: (code: string, stdin?: string) => Promise<RunResult>;
  checkPython: (code: string, checks: LessonCheck[]) => Promise<CheckResult>;
  runJava: (code: string) => Promise<RunResult>;
  checkJava: (code: string, checks: LessonCheck[]) => Promise<CheckResult>;
  runCpp: (code: string) => Promise<RunResult>;
  checkCpp: (code: string, checks: LessonCheck[]) => Promise<CheckResult>;
  runCsharp: (code: string) => Promise<RunResult>;
  checkCsharp: (code: string, checks: LessonCheck[]) => Promise<CheckResult>;
  runInteractive: (
    lang: string,
    code: string
  ) => Promise<{ ok: boolean; error?: string; sessionId?: number }>;
  sendRunStdin: (text: string) => void;
  stopRun: () => void;
  onRunEvent: (cb: (ev: RunStreamEvent) => void) => () => void;
  openExternal: (url: string) => Promise<void>;
  openPath: (filePath: string) => Promise<string>;
  getPendingAppUpdate: () => Promise<{
    version: string;
    url: string;
    localPath?: string;
  } | null>;
};

export type RunStreamEvent =
  | { type: "started"; sessionId?: number }
  | { type: "stdout"; data: string; sessionId?: number }
  | { type: "stderr"; data: string; sessionId?: number }
  | { type: "done"; ok: boolean; exitCode: number; aborted?: boolean; sessionId?: number };

export type RunResult = {
  ok: boolean;
  stdout: string;
  stderr: string;
  exitCode: number;
};

export type CheckResult = {
  allPass: boolean;
  results: Array<{
    pass: boolean;
    stdout: string;
    stderr: string;
    expected?: string;
    hint?: string;
  }>;
};

declare global {
  interface Window {
    vexxLearn?: VexxLearnApi;
  }
}
