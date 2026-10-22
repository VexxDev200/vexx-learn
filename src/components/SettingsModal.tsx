import type { Lang } from "../content/types";
import { tUi } from "../i18n/ui";
import type { AccentId, AppTheme, VexxSettings } from "../settings/types";
import { Logo } from "./Logo";

type UpdateInfo = {
  coursesVersion: number;
  appVersion: string;
  remoteAppVersion: string | null;
  appUpdateUrl: string | null;
  effectiveAppVersion?: string;
  remoteAppVersion?: string | null;
  message: string;
  error: string | null;
};

type Props = {
  lang: Lang;
  open: boolean;
  settings: VexxSettings;
  updateInfo: UpdateInfo | null;
  uiOtaSupported: boolean;
  checking: boolean;
  onClose: () => void;
  onChange: (patch: Partial<VexxSettings>) => void;
  onSave: () => void;
  onCheckUpdates: () => void;
};

const THEMES: AppTheme[] = ["default", "midnight", "light", "neon"];
const ACCENTS: AccentId[] = ["teal", "violet", "amber", "rose", "cyan"];

export function SettingsModal({
  lang,
  open,
  settings,
  updateInfo,
  uiOtaSupported,
  checking,
  onClose,
  onChange,
  onSave,
  onCheckUpdates,
}: Props) {
  if (!open) return null;

  return (
    <div className="modal-backdrop" role="presentation" onClick={onClose}>
      <div
        className="settings-modal"
        role="dialog"
        aria-labelledby="settings-title"
        onClick={(e) => e.stopPropagation()}
      >
        <header className="settings-header">
          <Logo size={48} />
          <div>
            <h2 id="settings-title">{tUi(lang, "settingsTitle")}</h2>
            <p className="meta">{tUi(lang, "settingsSubtitle")}</p>
          </div>
          <button type="button" className="modal-close" onClick={onClose} aria-label="Close">
            ×
          </button>
        </header>

        <section className="settings-section">
          <h3>{tUi(lang, "appearance")}</h3>
          <label className="settings-label">{tUi(lang, "theme")}</label>
          <div className="chip-row">
            {THEMES.map((th) => (
              <button
                key={th}
                type="button"
                className={`chip ${settings.theme === th ? "active" : ""}`}
                onClick={() => onChange({ theme: th })}
              >
                {tUi(lang, `theme_${th}`)}
              </button>
            ))}
          </div>
          <label className="settings-label">{tUi(lang, "accentColor")}</label>
          <div className="chip-row accent-chips">
            {ACCENTS.map((ac) => (
              <button
                key={ac}
                type="button"
                className={`accent-chip accent-${ac} ${settings.accent === ac ? "active" : ""}`}
                onClick={() => onChange({ accent: ac })}
                title={tUi(lang, `accent_${ac}`)}
              />
            ))}
          </div>
        </section>

        <section className="settings-section">
          <h3>{tUi(lang, "editorSettings")}</h3>
          <label className="settings-label">
            {tUi(lang, "fontSize")}: {settings.editorFontSize}px
          </label>
          <input
            type="range"
            min={12}
            max={22}
            value={settings.editorFontSize}
            onChange={(e) => onChange({ editorFontSize: Number(e.target.value) })}
          />
          <label className="settings-check">
            <input
              type="checkbox"
              checked={settings.reduceMotion}
              onChange={(e) => onChange({ reduceMotion: e.target.checked })}
            />
            {tUi(lang, "reduceMotion")}
          </label>
        </section>

        <section className="settings-section">
          <h3>{tUi(lang, "updates")}</h3>
          <p className="meta github-hint">{tUi(lang, "updatesAutoHint")}</p>
          {!uiOtaSupported && (
            <p className="meta github-hint warn">{tUi(lang, "upd_need_new_installer")}</p>
          )}
          <label className="settings-check">
            <input
              type="checkbox"
              checked={settings.autoUpdateCourses}
              onChange={(e) => onChange({ autoUpdateCourses: e.target.checked })}
            />
            {tUi(lang, "autoUpdateCourses")}
          </label>
          <label className="settings-check">
            <input
              type="checkbox"
              checked={settings.autoCheckApp}
              onChange={(e) => onChange({ autoCheckApp: e.target.checked })}
            />
            {tUi(lang, "autoCheckApp")}
          </label>
          <div className="settings-update-row">
            <button type="button" className="btn" disabled={checking} onClick={onCheckUpdates}>
              {checking ? tUi(lang, "checkingUpdates") : tUi(lang, "checkUpdates")}
            </button>
            {updateInfo && (
              <span className="meta update-status">
                {tUi(lang, `upd_${updateInfo.message}`) || updateInfo.message}
                {updateInfo.error ? ` — ${updateInfo.error}` : ""}
              </span>
            )}
          </div>
          {updateInfo && (
            <p className="meta version-line">
              {tUi(lang, "appVer")}:{" "}
              {updateInfo.effectiveAppVersion || updateInfo.appVersion}
              {updateInfo.remoteAppVersion &&
              updateInfo.remoteAppVersion !==
                (updateInfo.effectiveAppVersion || updateInfo.appVersion)
                ? ` (${tUi(lang, "onServer")}: ${updateInfo.remoteAppVersion})`
                : ""}
            </p>
          )}
        </section>

        <footer className="settings-footer">
          <button type="button" className="btn primary" onClick={onSave}>
            {tUi(lang, "saveSettings")}
          </button>
        </footer>
      </div>
    </div>
  );
}
