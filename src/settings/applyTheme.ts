import { DEFAULT_SETTINGS, type AccentId, type AppTheme, type VexxSettings } from "./types";

const ACCENTS: Record<AccentId, { accent: string; dim: string; glow: string }> = {
  teal: { accent: "#5eead4", dim: "#2dd4bf", glow: "rgba(45, 212, 191, 0.12)" },
  violet: { accent: "#a78bfa", dim: "#8b5cf6", glow: "rgba(139, 92, 246, 0.14)" },
  amber: { accent: "#fcd34d", dim: "#f59e0b", glow: "rgba(245, 158, 11, 0.12)" },
  rose: { accent: "#fb7185", dim: "#f43f5e", glow: "rgba(244, 63, 94, 0.12)" },
  cyan: { accent: "#22d3ee", dim: "#06b6d4", glow: "rgba(6, 182, 212, 0.12)" },
};

const THEMES: Record<AppTheme, Record<string, string>> = {
  default: {
    "--bg": "#0a0d14",
    "--panel": "#121826",
    "--panel2": "#1a2234",
    "--border": "#2d3a52",
    "--text": "#eef2ff",
    "--muted": "#94a3b8",
  },
  midnight: {
    "--bg": "#050508",
    "--panel": "#0c0c12",
    "--panel2": "#14141f",
    "--border": "#252532",
    "--text": "#f1f5f9",
    "--muted": "#71717a",
  },
  light: {
    "--bg": "#f1f5f9",
    "--panel": "#ffffff",
    "--panel2": "#e2e8f0",
    "--border": "#cbd5e1",
    "--text": "#0f172a",
    "--muted": "#64748b",
  },
  neon: {
    "--bg": "#0a0014",
    "--panel": "#12001f",
    "--panel2": "#1a0a2e",
    "--border": "#3b1d5c",
    "--text": "#faf5ff",
    "--muted": "#c4b5fd",
  },
};

export function applyVexxTheme(settings: VexxSettings): void {
  const root = document.documentElement;
  root.dataset.theme = settings.theme;
  root.dataset.accent = settings.accent;

  const theme = THEMES[settings.theme];
  const acc = ACCENTS[settings.accent];
  for (const [k, v] of Object.entries(theme)) {
    root.style.setProperty(k, v);
  }
  root.style.setProperty("--accent", acc.accent);
  root.style.setProperty("--accent-dim", acc.dim);
  root.style.setProperty("--glow", `0 0 40px ${acc.glow}`);

  if (settings.reduceMotion) {
    root.style.setProperty("--motion", "0");
  } else {
    root.style.removeProperty("--motion");
  }
}

function sanitizeUpdateBaseUrl(url: string): string {
  const u = (url || "").trim().replace(/\/+$/, "");
  if (/^https:\/\/raw\.githubusercontent\.com\/[\w.-]+\/[\w.-]+$/i.test(u)) return "";
  return url.trim();
}

export function loadSettingsFromStorage(): VexxSettings {
  try {
    const raw = localStorage.getItem("vexx-learn-settings");
    if (!raw) return { ...DEFAULT_SETTINGS };
    const merged = { ...DEFAULT_SETTINGS, ...JSON.parse(raw) } as VexxSettings;
    merged.updateBaseUrl = sanitizeUpdateBaseUrl(merged.updateBaseUrl);
    return merged;
  } catch {
    return { ...DEFAULT_SETTINGS };
  }
}

export function saveSettingsToStorage(s: VexxSettings): void {
  localStorage.setItem("vexx-learn-settings", JSON.stringify(s));
}
