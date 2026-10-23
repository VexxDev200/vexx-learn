import Editor from "@monaco-editor/react";
import { blankCodeForEditor } from "./editor/blankCode";
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

const TRACK_IDS = ["python", "java", "cpp", "csharp", "security"] as const;

async function runLessonBatch(
  api: NonNullable<typeof window.vexxLearn>,
  editorLang: string,
  code: string
) {
  switch (editorLang) {
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
  const [uiOtaSupported, setUiOtaSupported] = useState(true);
  const tracks = useMemo(() => buildTracks(registry, lang), [registry, lang]);
  const [track, setTrack] = useState("python");
  const [lessonId, setLessonId] = useState<string | null>("py-01");
  const [code, setCode] = useState("");
  const [consoleText, setConsoleText] = useState("");
  const [consoleOk, setConsoleOk] = useState(true);
  const [completed, setCompleted] = useState<string[]>([]);
  const [streak, setStreak] = useState<StreakState>({ count: 0, lastStudyDate: "" });
  const [failContext, setFailContext] = useState<"run" | "check">("run");
  const [loading, setLoading] = useState(true);

  const consoleRef = useRef<HTMLDivElement>(null);
  const consoleInputRef = useRef<HTMLInputElement>(null);
  const [runActive, setRunActive] = useState(false);
  const [consoleInput, setConsoleInput] = useState("");
  const [hasElectron, setHasElectron] = useState(false);
  const [appVersion, setAppVersion] = useState("");
  const [coursesVersion, setCoursesVersion] = useState(0);
  const runSessionRef = useRef(0);
  const langRef = useRef(lang);
  langRef.current = lang;

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
    setCoursesVersion(payload.coursesVersion || 0);
    setRegistry(registryFromApiCourses(payload.courses));
  }, [api]);

  const applyUpdateResult = useCallback(
    async (r: UpdateResult) => {
      setUpdateInfo(r);
      if (r.coursesUpdated) await reloadCourses();
      if (r.coursesUpdated || r.uiUpdated || r.needsReload) {
        const ver = await api?.getAppVersion();
        if (ver) {
          setUpdateInfo((prev) =>
            prev
              ? {
                  ...prev,
                  ...r,
                  appVersion: ver,
                  effectiveAppVersion: ver,
                }
              : prev
          );
        }
      }
      if (r.appDownloaded) {
        setUpdateBanner(tUi(lang, "upd_app_downloaded"));
      } else if (r.uiUpdated || r.needsReload) {
        setUpdateBanner(tUi(lang, "upd_ui_updated"));
      } else if (r.coursesUpdated) {
        setUpdateBanner(tUi(lang, "upd_courses_updated"));
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
    (async () => {
      if (!api) {
        applyVexxTheme(loadSettingsFromStorage());
        setLoading(false);
        return;
      }
      try {
        const [prog, remoteSettings, coursesPayload, caps] = await Promise.all([
          api.getProgress(),
          api.getSettings(),
          api.getCourses(),
          api.getUpdateCapabilities?.() ?? Promise.resolve({ uiOta: false }),
        ]);
        setUiOtaSupported(Boolean(caps?.uiOta));
        setCompleted(prog.completed || []);
        setStreak(mergeStreakFromServer(prog.streak));
        const merged = { ...loadSettingsFromStorage(), ...remoteSettings };
        setSettings(merged);
        setSettingsDraft(merged);
        saveSettingsToStorage(merged);
        applyVexxTheme(merged);
        setRegistry(registryFromApiCourses(coursesPayload.courses));
        setCoursesVersion(coursesPayload.coursesVersion || 0);
        const ver = await api.getAppVersion();
        setAppVersion(ver);
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
        const r = await api.checkUpdates();
        await applyUpdateResult(r);
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
    if (runActive || consoleOk || !lesson) return null;
    return explainError(
      consoleText,
      lang,
      lesson.editorLang || "python",
      failContext
    );
  }, [runActive, consoleOk, consoleText, lang, lesson, failContext]);

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
    window.vexxLearn?.stopRun?.();
    setRunActive(false);
    setLessonId(l.id);
    setCode(blankCodeForEditor(l.editorLang || "python"));
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

  useEffect(() => {
    if (!api?.onRunEvent) return;
    return api.onRunEvent((ev) => {
      if (ev.type === "started") {
        if (ev.sessionId != null) runSessionRef.current = ev.sessionId;
        setRunActive(true);
        setConsoleText("");
        setConsoleOk(true);
        setConsoleInput("");
        window.setTimeout(() => consoleInputRef.current?.focus(), 0);
        return;
      }

      const sid = ev.sessionId;
      if (sid != null && sid !== runSessionRef.current) return;

      if (ev.type === "stdout" || ev.type === "stderr") {
        setConsoleText((prev) => prev + ev.data);
      } else if (ev.type === "done") {
        setRunActive(false);
        setConsoleOk(ev.ok);
        setConsoleText((prev) => {
          const t = prev.trimEnd();
          if (t) return t;
          const uiLang = langRef.current;
          return ev.ok ? `(${tUi(uiLang, "output")})` : "";
        });
      }
    });
  }, [api]);

  useEffect(() => {
    return () => {
      window.vexxLearn?.stopRun?.();
    };
  }, []);

  const runCode = async () => {
    if (!lesson) return;
    if (!api) {
      setConsoleText(tUi(lang, "noElectron"));
      setConsoleOk(false);
      return;
    }

    const editorLang = lesson.editorLang || "python";
    setFailContext("run");
    setConsoleText(tUi(lang, "running"));
    setConsoleOk(true);
    setRunActive(false);

    if (!api.runInteractive || !api.onRunEvent) {
      const r = await runLessonBatch(api, editorLang, code);
      if (!r) {
        setConsoleText(tUi(lang, "noElectron"));
        setConsoleOk(false);
        return;
      }
      const out = (r.stdout || "") + (r.stderr ? `\n${r.stderr}` : "");
      setConsoleText(out.trimEnd() || (r.ok ? `(${tUi(lang, "output")})` : r.stderr || ""));
      setConsoleOk(r.ok);
      return;
    }

    try {
      const r = await api.runInteractive(editorLang, code);
      if (r?.sessionId != null) runSessionRef.current = r.sessionId;
      if (!r?.ok && r?.error) {
        setRunActive(false);
        setConsoleText(r.error);
        setConsoleOk(false);
        return;
      }
      if (r?.ok && r.sessionId != null) {
        setRunActive(true);
        setConsoleText((t) => (t === tUi(lang, "running") ? "" : t));
      }
    } catch {
      setRunActive(false);
      setConsoleText(tUi(lang, "runNeedsRestart"));
      setConsoleOk(false);
    }
  };

  const changeLang = (l: Lang) => {
    if (l === lang) return;
    api?.stopRun?.();
    setRunActive(false);
    setLang(l);
  };

  const submitConsoleInput = () => {
    if (!api?.sendRunStdin || !runActive) return;
    api.sendRunStdin(`${consoleInput}\n`);
    setConsoleInput("");
  };

  const stopRunning = () => {
    api?.stopRun?.();
    setRunActive(false);
  };

  const checkTask = async () => {
    if (!api || !lesson) return;
    api.stopRun?.();
    setRunActive(false);
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
      if (r.uiUpdated || r.needsReload) {
        const ver = await api.getAppVersion();
        setUpdateInfo((prev) =>
          prev ? { ...prev, appVersion: ver, effectiveAppVersion: ver, message: r.message } : prev
        );
      }
    } finally {
      setCheckingUpdates(false);
    }
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
        uiOtaSupported={uiOtaSupported}
        onClose={() => setSettingsOpen(false)}
        onChange={(patch) => setSettingsDraft((s) => ({ ...s, ...patch }))}
        onSave={saveSettingsHandler}
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
              onClick={() => changeLang(l)}
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

        {TRACK_IDS.map((id) => (
          <button
            key={id}
            type="button"
            className={`track-btn ${id === "security" ? "track-security" : ""} ${track === id ? "active" : ""}`}
            onClick={() => switchTrack(id)}
          >
            {tUi(lang, `track_${id}`)}
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
        {appVersion ? (
          <div className="app-version meta" dir="ltr">
            v{appVersion}
            {coursesVersion ? ` · c${coursesVersion}` : ""}
          </div>
        ) : null}
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
                  {runActive ? (
                    <button type="button" className="btn" onClick={stopRunning}>
                      {tUi(lang, "stopRun")}
                    </button>
                  ) : null}
                  <button type="button" className="btn" onClick={runCode} disabled={runActive}>
                    {tUi(lang, "run")}
                  </button>
                  <button type="button" className="btn primary" onClick={checkTask}>
                    {tUi(lang, "check")}
                  </button>
                  <button
                    type="button"
                    className="btn"
                    onClick={() =>
                      setCode(blankCodeForEditor(lesson.editorLang || "python"))
                    }
                  >
                    {tUi(lang, "reset")}
                  </button>
                </div>
                <div className="editor-wrap" dir="ltr">
                  <Editor
                    key={lesson.id}
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
                  <div className="console-label">
                    {tUi(lang, "console")}
                    {runActive ? (
                      <span className="console-live meta"> · {tUi(lang, "runLive")}</span>
                    ) : null}
                  </div>
                  <div className={`console ${consoleOk ? "ok" : "err"}`}>
                    {consoleText || (runActive ? "" : tUi(lang, "output"))}
                  </div>
                  {runActive ? (
                    <form
                      className="console-input-row"
                      dir="ltr"
                      onSubmit={(e) => {
                        e.preventDefault();
                        submitConsoleInput();
                      }}
                    >
                      <span className="console-input-prefix">&gt;</span>
                      <input
                        ref={consoleInputRef}
                        type="text"
                        className="console-input"
                        value={consoleInput}
                        onChange={(e) => setConsoleInput(e.target.value)}
                        placeholder={tUi(lang, "consoleInput")}
                        autoComplete="off"
                        spellCheck={false}
                      />
                    </form>
                  ) : null}
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
