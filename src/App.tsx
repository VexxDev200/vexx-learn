import Editor from "@monaco-editor/react";
import { setupMonaco, VEXX_EDITOR_OPTIONS } from "./editor/setupMonaco";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import ReactMarkdown from "react-markdown";
import { SettingsModal } from "./components/SettingsModal";
import { Logo } from "./components/Logo";
import {
  buildTracks,
  bundledRegistry,
  defsForTrack,
  registryFromApiCourses,
  type CourseRegistry,
} from "./courseRegistry";
import type { Lang } from "./content/types";
import { LANG_LABEL, tUi } from "./i18n/ui";
import { applyVexxTheme, loadSettingsFromStorage, saveSettingsToStorage } from "./settings/applyTheme";
import type { VexxSettings } from "./settings/types";
import { explainError } from "./learn/errorExplain";
import { mergeStreakFromServer, type StreakState } from "./learn/streak";
import type { Lesson, UpdateResult } from "./vexx-api";

const TRACKS: { id: string; label: string; ready: boolean }[] = [
  { id: "python", label: "Python", ready: true },
  { id: "java", label: "Java", ready: true },
  { id: "cpp", label: "C++", ready: true },
  { id: "csharp", label: "C#", ready: true },
];

function runLesson(api: typeof window.vexxLearn, lang: string, code: string) {
  if (!api) return Promise.resolve(null);
  switch (lang) {
    case "java":
      return api.runJava(code);
    case "cpp":
      return api.runCpp(code);
    case "csharp":
      return api.runCsharp(code);
    default:
      return api.runPython(code);
  }
}

function checkLesson(
  api: typeof window.vexxLearn,
  lang: string,
  code: string,
  checks: Lesson["checks"]
) {
  if (!api) return Promise.resolve(null);
  switch (lang) {
    case "java":
      return api.checkJava(code, checks);
    case "cpp":
      return api.checkCpp(code, checks);
    case "csharp":
      return api.checkCsharp(code, checks);
    default:
      return api.checkPython(code, checks);
  }
}

function examUnlocked(track: string, completed: string[], registry: CourseRegistry): boolean {
  const defs = defsForTrack(registry, track).filter((l) => l.kind !== "exam");
  return defs.every((l) => completed.includes(l.id));
}

export function App() {
  const [lang, setLang] = useState<Lang>(() => {
    const s = localStorage.getItem("vexx-learn-lang");
    return s === "en" || s === "he" || s === "ru" ? s : "ru";
  });
  const [registry, setRegistry] = useState<CourseRegistry>(() => bundledRegistry());
  const [settings, setSettings] = useState<VexxSettings>(() => loadSettingsFromStorage());
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [settingsDraft, setSettingsDraft] = useState<VexxSettings>(() => loadSettingsFromStorage());
  const [updateInfo, setUpdateInfo] = useState<UpdateResult | null>(null);
  const [checkingUpdates, setCheckingUpdates] = useState(false);
  const [updateBanner, setUpdateBanner] = useState<string | null>(null);
  const tracks = useMemo(() => buildTracks(registry, lang), [registry, lang]);
  const [track, setTrack] = useState("python");
  const [lessonId, setLessonId] = useState<string | null>("py-01");
  const [code, setCode] = useState(() => bundledRegistry().python[0]?.starterCode ?? "");
  const [consoleText, setConsoleText] = useState("");
  const [consoleOk, setConsoleOk] = useState(true);
  const [completed, setCompleted] = useState<string[]>([]);
  const [streak, setStreak] = useState<StreakState>({ count: 0, lastStudyDate: "" });
  const [failContext, setFailContext] = useState<"run" | "check">("run");
  const [loading, setLoading] = useState(true);

  const consoleRef = useRef<HTMLDivElement>(null);
  const [hasElectron, setHasElectron] = useState(false);

  useEffect(() => {
    const ok = () => Boolean(window.vexxLearn);
    if (ok()) setHasElectron(true);
    const id = window.setInterval(() => {
      if (ok()) setHasElectron(true);
    }, 300);
    return () => window.clearInterval(id);
  }, []);

  const api = hasElectron ? window.vexxLearn : undefined;

  useEffect(() => {
    document.documentElement.lang = lang;
    // Monaco breaks when <html dir="rtl"> — UI RTL via .app-rtl only.
    document.documentElement.dir = "ltr";
    localStorage.setItem("vexx-learn-lang", lang);
  }, [lang]);

  useEffect(() => {
    applyVexxTheme(settings);
  }, [settings]);

  const reloadCourses = useCallback(async () => {
    if (!api?.getCourses) return;
    const payload = await api.getCourses();
    setRegistry(registryFromApiCourses(payload.courses));
  }, [api]);

  const applyUpdateResult = useCallback(
    async (r: UpdateResult) => {
      setUpdateInfo(r);
      if (r.coursesUpdated) {
        await reloadCourses();
        setUpdateBanner(tUi(lang, "upd_courses_updated"));
      }
      if (
        r.message === "app_update_downloaded" ||
        r.message === "courses_and_app_downloaded"
      ) {
        setUpdateBanner(tUi(lang, "upd_app_downloaded"));
      } else if (r.message === "app_update_available" || r.message === "courses_and_app") {
        setUpdateBanner(tUi(lang, "upd_app_update_available"));
      }
    },
    [lang, reloadCourses]
  );

  useEffect(() => {
    if (!api) return;
    const unsub = api.onUpdateResult?.((r) => {
      applyUpdateResult(r);
    });
    return () => unsub?.();
  }, [api, applyUpdateResult]);

  useEffect(() => {
    const l = tracks[track]?.find((x) => x.id === lessonId) ?? tracks[track]?.[0];
    if (l) {
      setLessonId(l.id);
      setCode(l.starterCode);
    }
  }, [lang]);

  useEffect(() => {
    (async () => {
      if (!api) {
        applyVexxTheme(loadSettingsFromStorage());
        setLoading(false);
        return;
      }
      try {
        const [prog, remoteSettings, coursesPayload] = await Promise.all([
          api.getProgress(),
          api.getSettings(),
          api.getCourses(),
        ]);
        setCompleted(prog.completed || []);
        setStreak(mergeStreakFromServer(prog.streak));
        const merged = { ...loadSettingsFromStorage(), ...remoteSettings };
        setSettings(merged);
        setSettingsDraft(merged);
        saveSettingsToStorage(merged);
        applyVexxTheme(merged);
        setRegistry(registryFromApiCourses(coursesPayload.courses));
        const ver = await api.getAppVersion();
        setUpdateInfo({
          checked: false,
          coursesUpdated: false,
          coursesVersion: coursesPayload.coursesVersion,
          appVersion: ver,
          remoteAppVersion: null,
          appUpdateUrl: null,
          message: "courses_up_to_date",
          error: null,
        });
        if (merged.autoUpdateCourses || merged.autoCheckApp) {
          const r = await api.checkUpdates();
          await applyUpdateResult(r);
        }
      } catch {
        /* */
      }
      setLoading(false);
    })();
  }, [api, applyUpdateResult]);

  const lessons = tracks[track] || [];
  const lesson = useMemo(
    () => lessons.find((l) => l.id === lessonId) ?? null,
    [lessons, lessonId]
  );

  const errorWhy = useMemo(() => {
    if (consoleOk || !lesson) return null;
    return explainError(
      consoleText,
      lang,
      lesson.editorLang || "python",
      failContext
    );
  }, [consoleOk, consoleText, lang, lesson, failContext]);

  const progressPct = useMemo(() => {
    const defs = defsForTrack(registry, track).filter((l) => l.kind !== "exam");
    if (!defs.length) return 0;
    const done = defs.filter((d) => completed.includes(d.id)).length;
    return Math.round((done / defs.length) * 100);
  }, [track, completed, registry]);

  const pickLesson = useCallback((l: Lesson) => {
    if (l.kind === "exam" && !examUnlocked(track, completed, registry)) {
      setConsoleText(tUi(lang, "examLock"));
      setConsoleOk(false);
      return;
    }
    setLessonId(l.id);
    setCode(l.starterCode);
    setConsoleText("");
    setConsoleOk(true);
    setFailContext("run");
  }, [track, completed, lang, registry]);

  const switchTrack = (id: string) => {
    setTrack(id);
    const first = tracks[id]?.[0];
    if (first) pickLesson(first);
  };

  useEffect(() => {
    consoleRef.current?.scrollIntoView({ block: "nearest", behavior: "smooth" });
  }, [consoleText]);

  const runCode = async () => {
    if (!lesson) return;
    if (!api) {
      setConsoleText(tUi(lang, "noElectron"));
      setConsoleOk(false);
      return;
    }
    setConsoleText(tUi(lang, "running"));
    setConsoleOk(true);
    setFailContext("run");
    const r = await runLesson(api, lesson.editorLang || "python", code);
    if (!r) {
      setConsoleText(`${tUi(lang, "noElectron")}\n(no response from runner)`);
      setConsoleOk(false);
      return;
    }
    const out = (r.stdout || "") + (r.stderr ? `\n${r.stderr}` : "");
    setConsoleText(out.trimEnd() || (r.ok ? `(${tUi(lang, "output")})` : r.stderr || "Error"));
    setConsoleOk(r.ok);
  };

  const checkTask = async () => {
    if (!api || !lesson) return;
    if (lesson.kind === "exam" && !examUnlocked(track, completed, registry)) {
      setConsoleText(tUi(lang, "examLock"));
      setConsoleOk(false);
      return;
    }
    setConsoleText(tUi(lang, "checking") + "\n");
    setFailContext("check");
    const r = await checkLesson(api, lesson.editorLang || "python", code, lesson.checks);
    if (!r) return;
    const lines: string[] = [];
    r.results.forEach((x, i) => {
      lines.push(
        x.pass
          ? `✓ ${tUi(lang, "testOk")} ${i + 1}`
          : `✗ ${tUi(lang, "testFail")} ${i + 1}`
      );
      if (!x.pass && x.hint) lines.push(`  ${tUi(lang, "hint")}: ${x.hint}`);
      if (!x.pass && x.expected !== undefined) {
        lines.push(`  ${tUi(lang, "expected")}: ${JSON.stringify(x.expected)}`);
        lines.push(`  ${tUi(lang, "got")}: ${JSON.stringify(x.stdout.trimEnd())}`);
      }
      if (x.stderr) lines.push(x.stderr);
    });
    if (r.allPass) {
      lines.push(
        lesson.kind === "exam"
          ? `\n🎉 ${tUi(lang, "examDone")}`
          : `\n🎉 ${tUi(lang, "lessonDone")}`
      );
      const p = await api.completeLesson(lesson.id);
      setCompleted(p.completed);
      if (p.streak) setStreak(mergeStreakFromServer(p.streak));
    }
    setConsoleText(lines.join("\n"));
    setConsoleOk(r.allPass);
  };

  const editorOptions = useMemo(
    () => ({
      ...VEXX_EDITOR_OPTIONS,
      fontSize: settings.editorFontSize,
    }),
    [settings.editorFontSize]
  );

  const openSettings = () => {
    setSettingsDraft(settings);
    setSettingsOpen(true);
  };

  const saveSettingsHandler = async () => {
    setSettings(settingsDraft);
    saveSettingsToStorage(settingsDraft);
    applyVexxTheme(settingsDraft);
    if (api?.setSettings) await api.setSettings(settingsDraft);
    setSettingsOpen(false);
    if (settingsDraft.autoUpdateCourses || settingsDraft.autoCheckApp) {
      setCheckingUpdates(true);
      try {
        const r = await api?.checkUpdates();
        if (r) await applyUpdateResult(r);
      } finally {
        setCheckingUpdates(false);
      }
    }
  };

  const checkUpdatesHandler = async () => {
    if (!api) return;
    setCheckingUpdates(true);
    try {
      const r = await api.checkUpdates();
      await applyUpdateResult(r);
    } finally {
      setCheckingUpdates(false);
    }
  };

  const downloadAppHandler = async () => {
    if (!api) return;
    const pending = await api.getPendingAppUpdate();
    if (pending?.localPath) {
      await api.openPath(pending.localPath);
      return;
    }
    const url = updateInfo?.appUpdateUrl;
    if (url) api.openExternal(url);
  };

  if (loading) {
    return <div className="placeholder">{tUi(lang, "loading")}</div>;
  }

  return (
    <div className={`app${lang === "he" ? " app-rtl" : ""}`}>
      <SettingsModal
        lang={lang}
        open={settingsOpen}
        settings={settingsDraft}
        updateInfo={updateInfo}
        checking={checkingUpdates}
        onClose={() => setSettingsOpen(false)}
        onChange={(patch) => setSettingsDraft((s) => ({ ...s, ...patch }))}
        onSave={saveSettingsHandler}
        onCheckUpdates={checkUpdatesHandler}
        onDownloadApp={downloadAppHandler}
      />
      <aside className="sidebar">
        <div className="brand-row">
          <Logo size={44} />
          <div className="brand-text">
            <div className="brand">Vexx <span>Learn</span></div>
            <p className="meta tagline">{tUi(lang, "tagline")}</p>
          </div>
        </div>
        {updateBanner && (
          <div className="update-banner">
            {updateBanner}
            <button type="button" className="link-btn" onClick={() => setUpdateBanner(null)}>×</button>
          </div>
        )}

        <div className="lang-row">
          <span className="meta">{tUi(lang, "lang")}</span>
          {(["ru", "en", "he"] as Lang[]).map((l) => (
            <button
              key={l}
              type="button"
              className={`lang-btn ${lang === l ? "active" : ""}`}
              onClick={() => setLang(l)}
            >
              {LANG_LABEL[l]}
            </button>
          ))}
        </div>

        <div className="progress-wrap">
          <span className="meta">{tUi(lang, "progress")}: {progressPct}%</span>
          <div className="progress-bar">
            <div className="progress-fill" style={{ width: `${progressPct}%` }} />
          </div>
          <div className="streak-pill" title={tUi(lang, "streakHint")}>
            <span className="meta">{tUi(lang, "streak")}</span>
            <strong>{streak.count}</strong>
          </div>
        </div>

        {TRACKS.map((t) => (
          <button
            key={t.id}
            type="button"
            className={`track-btn ${track === t.id ? "active" : ""} ${!t.ready ? "soon" : ""}`}
            onClick={() => t.ready && switchTrack(t.id)}
          >
            {t.label}
            {!t.ready ? ` · ${tUi(lang, "soon")}` : ""}
          </button>
        ))}

        <div className="lesson-list">
          {lessons.map((l) => {
            const locked = l.kind === "exam" && !examUnlocked(track, completed, registry);
            return (
              <button
                key={l.id}
                type="button"
                disabled={locked}
                className={`lesson-item ${lessonId === l.id ? "active" : ""} ${completed.includes(l.id) ? "done" : ""} ${l.kind === "exam" ? "exam" : ""} ${l.kind === "ethics" ? "ethics" : ""} ${l.kind === "project" ? "project" : ""} ${locked ? "locked" : ""}`}
                onClick={() => pickLesson(l)}
              >
                {l.title}
              </button>
            );
          })}
        </div>

        <button type="button" className="settings-btn" onClick={openSettings}>
          {tUi(lang, "settings")}
        </button>
      </aside>

      <div className="main">
        {lesson ? (
          <>
            <header className="topbar">
              <h1>
                {lesson.title}
                {lesson.kind === "project" ? (
                  <span className="meta lesson-kind"> · {tUi(lang, "kindProject")}</span>
                ) : null}
              </h1>
              <span className="meta">~{lesson.minutes} min</span>
            </header>
            <div className="content">
              <article className="theory" dir={lang === "he" ? "rtl" : "ltr"}>
                <ReactMarkdown>{lesson.theory}</ReactMarkdown>
                <div className="example-box">
                  <strong>{tUi(lang, "example")}</strong>
                  <pre>{lesson.exampleCode}</pre>
                  <p>{lesson.exampleExplain}</p>
                  <button type="button" className="btn" onClick={() => setCode(lesson.exampleCode)}>
                    {tUi(lang, "insertExample")}
                  </button>
                </div>
              </article>
              <div className="editor-pane">
                {!hasElectron && (
                  <div className="electron-warn" role="status">
                    {tUi(lang, "noElectron")}
                  </div>
                )}
                <div className="editor-toolbar">
                  <span className="editor-hint meta">{tUi(lang, "suggestHint")}</span>
                  <button type="button" className="btn" onClick={runCode}>
                    {tUi(lang, "run")}
                  </button>
                  <button type="button" className="btn primary" onClick={checkTask}>
                    {tUi(lang, "check")}
                  </button>
                  <button
                    type="button"
                    className="btn"
                    onClick={() => setCode(lesson.starterCode)}
                  >
                    {tUi(lang, "reset")}
                  </button>
                </div>
                <div className="editor-wrap" dir="ltr">
                  <Editor
                    key={`${lesson.id}-${lang}`}
                    height="100%"
                    language={lesson.editorLang || "python"}
                    theme="vexx-dark"
                    value={code}
                    onChange={(v) => setCode(v ?? "")}
                    beforeMount={setupMonaco}
                    options={editorOptions}
                  />
                </div>
                <div className="console-panel" ref={consoleRef}>
                  <div className="console-label">{tUi(lang, "console")}</div>
                  <div className={`console ${consoleOk ? "ok" : "err"}`}>
                    {consoleText || tUi(lang, "output")}
                  </div>
                  {errorWhy ? (
                    <div className="error-why" role="note">
                      <strong>{tUi(lang, "whyError")}</strong>
                      {errorWhy}
                    </div>
                  ) : null}
                </div>
              </div>
            </div>
            <div className="task-bar">
              <strong>{tUi(lang, "task")}:</strong> {lesson.task}
            </div>
          </>
        ) : (
          <div className="placeholder">{tUi(lang, "pickLesson")}</div>
        )}
      </div>
    </div>
  );
}
