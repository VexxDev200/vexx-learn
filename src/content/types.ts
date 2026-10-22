import type { LessonCheck } from "../vexx-api";

export type Lang = "ru" | "en" | "he";

export type L = Record<Lang, string>;

export type LessonDef = {
  id: string;
  track: "python" | "java" | "cpp" | "csharp";
  kind?: "lesson" | "exam" | "ethics";
  minutes: number;
  title: L;
  theory: L;
  exampleCode: string;
  exampleExplain: L;
  task: L;
  starterCode: string;
  checks: LessonCheck[];
  editorLang?: "python" | "java" | "cpp" | "csharp";
};
