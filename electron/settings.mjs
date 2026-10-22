import { existsSync, mkdirSync, readFileSync, writeFileSync } from "fs";
import { dirname, join } from "path";

const DEFAULT = {
  theme: "default",
  accent: "teal",
  editorFontSize: 14,
  autoUpdateCourses: true,
  autoCheckApp: true,
  updateBaseUrl: "",
  reduceMotion: false,
};

export function settingsPath(userData) {
  return join(userData, "vexx-learn-settings.json");
}

export function loadSettings(userData) {
  const p = settingsPath(userData);
  try {
    if (!existsSync(p)) return { ...DEFAULT };
    return { ...DEFAULT, ...JSON.parse(readFileSync(p, "utf8")) };
  } catch {
    return { ...DEFAULT };
  }
}

export function saveSettings(userData, data) {
  const p = settingsPath(userData);
  mkdirSync(dirname(p), { recursive: true });
  writeFileSync(p, JSON.stringify({ ...DEFAULT, ...data }, null, 2), "utf8");
}
