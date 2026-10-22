export type StreakState = {
  count: number;
  lastStudyDate: string; // YYYY-MM-DD local
};

const KEY = "vexx-learn-streak";

function todayLocal(): string {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function dayDiff(a: string, b: string): number {
  const da = new Date(a + "T12:00:00");
  const db = new Date(b + "T12:00:00");
  return Math.round((db.getTime() - da.getTime()) / 86400000);
}

export function loadStreak(): StreakState {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return { count: 0, lastStudyDate: "" };
    const p = JSON.parse(raw) as StreakState;
    return { count: Number(p.count) || 0, lastStudyDate: String(p.lastStudyDate || "") };
  } catch {
    return { count: 0, lastStudyDate: "" };
  }
}

export function saveStreak(s: StreakState): void {
  localStorage.setItem(KEY, JSON.stringify(s));
}

/** Call when user completes a lesson (any kind except none). */
export function recordStudyDay(): StreakState {
  const today = todayLocal();
  const prev = loadStreak();
  if (prev.lastStudyDate === today) return prev;
  let count = 1;
  if (prev.lastStudyDate) {
    const diff = dayDiff(prev.lastStudyDate, today);
    if (diff === 1) count = prev.count + 1;
    else if (diff === 0) count = prev.count;
    else count = 1;
  }
  const next = { count, lastStudyDate: today };
  saveStreak(next);
  return next;
}

export function mergeStreakFromServer(server?: StreakState | null): StreakState {
  const local = loadStreak();
  if (!server?.lastStudyDate) return local;
  if (!local.lastStudyDate) {
    saveStreak(server);
    return server;
  }
  const merged =
    server.count > local.count ||
    (server.count === local.count && server.lastStudyDate > local.lastStudyDate)
      ? server
      : local;
  saveStreak(merged);
  return merged;
}
