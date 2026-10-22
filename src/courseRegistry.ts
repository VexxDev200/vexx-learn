import cppData from "./content/data/cpp.json";
import csharpData from "./content/data/csharp.json";
import javaData from "./content/data/java.json";
import pythonData from "./content/data/python.json";
import type { Lang, LessonDef } from "./content/types";
import { toRuntimeLesson } from "./i18n/resolve";

export type CourseRegistry = {
  python: LessonDef[];
  java: LessonDef[];
  cpp: LessonDef[];
  csharp: LessonDef[];
};

export function bundledRegistry(): CourseRegistry {
  return {
    python: pythonData as LessonDef[],
    java: javaData as LessonDef[],
    cpp: cppData as LessonDef[],
    csharp: csharpData as LessonDef[],
  };
}

export function registryFromApiCourses(courses: Record<string, LessonDef[]>): CourseRegistry {
  const b = bundledRegistry();
  return {
    python: courses.python?.length ? courses.python : b.python,
    java: courses.java?.length ? courses.java : b.java,
    cpp: courses.cpp?.length ? courses.cpp : b.cpp,
    csharp: courses.csharp?.length ? courses.csharp : b.csharp,
  };
}

export function buildTracks(registry: CourseRegistry, lang: Lang) {
  const map = (defs: LessonDef[]) => defs.map((d) => toRuntimeLesson(d, lang));
  return {
    python: map(registry.python),
    java: map(registry.java),
    cpp: map(registry.cpp),
    csharp: map(registry.csharp),
  };
}

export function defsForTrack(registry: CourseRegistry, track: string): LessonDef[] {
  if (track === "python") return registry.python;
  if (track === "java") return registry.java;
  if (track === "cpp") return registry.cpp;
  if (track === "csharp") return registry.csharp;
  return [];
}
