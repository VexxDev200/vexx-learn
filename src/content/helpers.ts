import type { L } from "./types";

export const H = (ru: string, en: string, he: string): L => ({ ru, en, he });

/** Развёрнутая теория: вступление + блок + итог */
export function theoryBlock(
  ru: { intro: string; body: string; tip: string },
  en: { intro: string; body: string; tip: string },
  he: { intro: string; body: string; tip: string }
): L {
  const fmt = (x: { intro: string; body: string; tip: string }) =>
    `${x.intro}\n\n${x.body}\n\n> **Совет:** ${x.tip}`;
  return {
    ru: fmt(ru),
    en: fmt({ ...en, tip: en.tip }),
    he: fmt({ ...he, tip: he.tip }),
  };
}
