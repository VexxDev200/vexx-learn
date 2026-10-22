export type AppTheme = "default" | "midnight" | "light" | "neon";
export type AccentId = "teal" | "violet" | "amber" | "rose" | "cyan";

export type VexxSettings = {
  theme: AppTheme;
  accent: AccentId;
  editorFontSize: number;
  autoUpdateCourses: boolean;
  autoCheckApp: boolean;
  updateBaseUrl: string;
  reduceMotion: boolean;
};

export const DEFAULT_SETTINGS: VexxSettings = {
  theme: "default",
  accent: "teal",
  editorFontSize: 14,
  autoUpdateCourses: true,
  autoCheckApp: true,
  updateBaseUrl: "",
  reduceMotion: false,
};
