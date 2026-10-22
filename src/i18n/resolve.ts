import type { Lang, L, LessonDef } from "../content/types";
import type { Lesson } from "../vexx-api";

export function pick(lang: Lang, block: L): string {
  return block[lang] || block.en || block.ru || "";
}

export function toRuntimeLesson(def: LessonDef, lang: Lang): Lesson {
  return {
    id: def.id,
    track: def.track,
    kind: def.kind,
    minutes: def.minutes,
    title: pick(lang, def.title),
    theory: pick(lang, def.theory),
    exampleCode: def.exampleCode,
    exampleExplain: pick(lang, def.exampleExplain),
    task: pick(lang, def.task),
    starterCode: def.starterCode,
    checks: def.checks.map((c) => {
      const hintRaw = c.hint as string | L | undefined;
      return {
        ...c,
        hint: hintRaw
          ? typeof hintRaw === "string"
            ? hintRaw
            : pick(lang, hintRaw as L)
          : undefined,
      };
    }),
    editorLang: def.editorLang ?? (def.track === "java" ? "java" : "python"),
  };
}
