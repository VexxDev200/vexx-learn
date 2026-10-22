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
  setSettings: (patch: Partial<VexxSettings>) => Promise<VexxSettings>;
  getAppVersion: () => Promise<string>;
  checkUpdates: () => Promise<UpdateResult>;
  getPendingAppUpdate: () => Promise<{ version: string; url: string } | null>;
  onUpdateResult: (cb: (r: UpdateResult) => void) => () => void;
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
  openExternal: (url: string) => Promise<void>;
  openPath: (filePath: string) => Promise<string>;
  getPendingAppUpdate: () => Promise<{
    version: string;
    url: string;
    localPath?: string;
  } | null>;
};

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
