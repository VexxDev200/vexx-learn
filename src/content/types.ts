import type { LessonCheck } from "../vexx-api";

export type Lang = "ru" | "en" | "he";

export type L = Record<Lang, string>;

/** Lesson check in course data: hint may be a plain string or a localized {ru,en,he} block. */
export type LessonDefCheck = Omit<LessonCheck, "hint"> & { hint?: string | L };

export type LessonDef = {
  id: string;
  track: "python" | "java" | "cpp" | "csharp" | "security";
  kind?: "lesson" | "exam" | "ethics" | "project";
  minutes: number;
  title: L;
  theory: L;
  exampleCode: string;
  exampleExplain: L;
  task: L;
  starterCode: string;
  checks: LessonDefCheck[];
  editorLang?: "python" | "java" | "cpp" | "csharp";
};
