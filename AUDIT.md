# AUDIT.md — vexx-learn, круг 1 (только чтение + скрипт проверки)

Дата: 2026-10-23 (Asia/Jerusalem). Версия приложения: 0.2.11. Аудитор: Grok Bot.
Секреты не открывались: `.env` отсутствует, `update.config.json` не читался (проверены только факт наличия, git-статус и попадание в сборку).

## 0. Состояние репозитория

- Ветка создана: `improve/round-1` (от `main`, коммит `66da698`). Тег отката: `pre-round-1` (на `66da698`).
- Рабочее дерево было НЕ чистым ещё до аудита: 12 изменённых файлов и 6 новых (WIP Vexx: `.github/workflows/ota-publish.yml`, `scripts/*`, `src/*`, `SHIP.bat`, `ship.cmd` и др.). Ничего не stash-илось и не сбрасывалось: при `git switch -c` эти правки переехали на новую ветку как есть. **Тег `pre-round-1` их не содержит** — перед правками круга 2 их стоит закоммитить отдельным коммитом.
- Страховочный zip (без node_modules, dist, release, .git, .env, update.config.json): `C:\Documents\12.09 project\vexx-learn-backup-<дата>.zip` (~290 КБ).
- Добавлено аудитом: `scripts/validate-lessons.mjs`, `AUDIT.md`. Побочный эффект `npm run courses` (перегенерация `src/content/data/bundle-manifest.json`) откатан `git checkout`.
- Версия, push, релиз, `update.config.json` — не трогались. `package-lock.json` не изменён.

## 1. Безопасность (по убыванию серьёзности)

Предложенное исправление №1 — пункт S1 (подпись OTA). Ничего из этого пока НЕ исправлено.

**S1 — КРИТИЧНО. OTA UI-бандла = удалённое выполнение кода на всех клиентах.**
`electron/update.mjs`, `electron/app-ui.mjs`: приложение раз в 3 мин (`electron/main.mjs`, `UPDATE_POLL_MS`) скачивает `manifest.json` и `app-ui.zip` с `raw.githubusercontent.com`, распаковывает в userData и грузит как UI через `loadFile`. Целостность: только SHA-256, который лежит в том же манифесте (нет подписи), и проверка ОПЦИОНАЛЬНА (`if (remote.sha256?.[track])`; для UI `expectedSha256` может быть `undefined` — тогда проверки нет). Загруженный UI получает весь preload-API (запуск python/java/cpp/dotnet, `openPath`, `setSettings`), `sandbox:false`. Итог: кто получит запись в `main` (украденный токен GitHub, взломанный CI — `ota-publish.yml` сам коммитит `release/updates` от бота), тот исполняет код у всех пользователей. Исправление: подпись манифеста (Ed25519, публичный ключ вшит в приложение, приватный — вне репозитория), обязательная проверка хешей (отказ, если хеша нет), проверка путей в zip, схема-валидация JSON курсов.

**S2 — ВЫСОКО. Произвольный запуск файлов/URL из рендерера.** `electron/main.mjs`: `shell:open-path` вызывает `shell.openPath(filePath)` без проверки (UI запускает так скачанный portable-exe: `src/components/SettingsModal.tsx:153`); `shell:open` — `shell.openExternal(url)` без allowlist схем (http/https). Исправление: открывать только путь внутри `userData/pending-updates` с проверкой хеша, URL только `https:`.

**S3 — ВЫСОКО. Источник обновлений задаётся из рендерера и не требует HTTPS.** `settings:set` (`electron/main.mjs`) сливает любой `patch` в настройки; `updateBaseUrl` принимается как есть (`electron/update.mjs: resolveCoursesBase`, в UI `src/settings/applyTheme.ts` отсекается только «голый» raw-URL, схема не проверяется). Допустим `http://` и любой хост → подмена манифеста в сети. Исправление: в main принимать только `https://raw.githubusercontent.com/<owner>/<repo>/…` (или убрать поле), whitelist ключей настроек.

**S4 — ВЫСОКО. Portable-exe обновление: хеш необязателен, подписи нет.** `electron/update.mjs`: `remote.portableSha256` проверяется, только если есть в манифесте; `downloadUrl` берётся из GitHub API без проверки хоста; exe не подписан (electron-builder: «no signing info identified»). Исправление: обязательный хеш из подписанного манифеста, проверка `https://github.com/<owner>/<repo>/releases/…`, по возможности Authenticode.

**S5 — ВЫСОКО. Хардненинг окна Electron.** `electron/main.mjs`: `contextIsolation:true`, `nodeIntegration:false` — хорошо; НО `sandbox:false`, нет CSP (ни meta в `index.html`, ни заголовков), нет `setWindowOpenHandler`/`will-navigate`, IPC-обработчики не проверяют отправителя и аргументы. Шрифты Google (`index.html`) и Monaco с `cdn.jsdelivr.net` (в `dist/assets/index-*.js` вшит URL CDN) — сторонний скрипт в привилегированном окне и не работает офлайн. Исправление: `sandbox:true` (preload уже CJS, `contextBridge` работает), строгая CSP, Monaco и шрифты локально, deny на navigation/window.open.

**S6 — СРЕДНЕ. Код пользователя выполняется без песочницы.** `electron/main.mjs`, `electron/interactiveRun.mjs`: `spawn(python|javac|java|g++|dotnet)` с правами пользователя, `env: {...process.env}` передаётся дочернему процессу, нет лимитов памяти и размера вывода (stdout копится в строке), интерактивный запуск живёт до 10 мин. Для учебного приложения это ожидаемо, но пользователь должен быть предупреждён; минимум — чистое окружение (без `process.env`), лимит вывода, отдельный cwd у python.

**S7 — СРЕДНЕ. Зависимости (`npm audit`: 17 уязвимостей — 2 critical, 14 high, 1 low).** Production-дерево: `dompurify` (critical, транзитивно через monaco-editor) и 1 low. Dev/сборка: `electron ^34` (high, версия вне поддержки), `electron-builder ^25` (high), `tar` (critical), `extract-zip`, `sharp` (high). Исправление: обновить electron/electron-builder/sharp (breaking, проверять отдельным коммитом), поднять `@monaco-editor/react`/`monaco-editor`.

**S8 — СРЕДНЕ. Конфиг обновлений в git и в сборке.** `update.config.json` ТРЕКАЕТСЯ git (`git ls-files` его показывает, строка в `.gitignore` не действует на уже отслеживаемый файл) и входит в `build.files` → лежит внутри `app.asar` (подтверждено списком asar). По коду он читает только нечувствительные ключи (`githubOwner/Repo/branch/updatesPath/portableAssetName`), содержимое я не открывал: Vexx должен сам убедиться, что там нет токена. `.env` в `.gitignore` не внесён (файла сейчас нет). Исправление: `.env*` в `.gitignore`, `update.config.example.json` в репозитории, реальный конфиг не коммитить; решить, нужен ли он в asar.

**S9 — НИЗКО.** Нет таймаутов/лимита размера на `downloadFile`, файлы читаются целиком в память для хеша; GitHub Actions закреплены по тегу, а не по SHA; `ota-publish.yml` с `contents: write` пушит прямо в `main`; курсы из OTA не проходят проверку схемы (битый JSON с сервера сломает UI).

Положительное: security-курс (35 уроков) содержит только безопасный учебный код — в `exampleCode/starterCode` нет сети, subprocess, os.system, eval/exec, pickle, файловых операций; боевых эксплойтов не найдено.

## 2. Сборка, lint, тесты

| Шаг | Результат |
|---|---|
| node / npm | v24.14.0 / 11.9.0; `node_modules` и lockfile есть, `npm ci` не требовался |
| `npm run icon` | OK |
| `npm run courses` | OK: python 21, java 17, cpp 17, csharp 17, security 35; `verify-security-lessons`: 35 уроков, все проверки пройдены |
| `vite build` | OK (220 модулей). Предупреждение: чанк `index-*.js` 744 кБ (> 500 кБ), нет code-splitting |
| `electron-builder --win portable` | OK (собрано во временную папку вне проекта, чтобы не затереть `release/Vexx-Learn-Portable.exe`; папка удалена). Предупреждения: `author is missed in package.json`, подпись пропущена («no signing info») |
| `npx tsc --noEmit` | **FAIL: 24 ошибки** (в `npm run build` tsc не запускается, поэтому сборка зелёная). Примеры: `src/App.tsx:213,253` (индексирование по string), `src/components/SettingsModal.tsx:10,13` (дубликат `remoteAppVersion`), `src/content/pythonCourse.ts` (9 мест: `{ru,en,he}` вместо string), `src/content/javaCourse.ts:157`, `src/editor/setupMonaco.ts:254,264,337` |
| `npm run lint` | скрипта нет, конфига ESLint/Prettier нет |
| `npm test` | скрипта нет |

## 3. Тесты

Тестов нет вообще: ни файлов `*.test.*`/`*.spec.*`, ни vitest/jest, ни скрипта `test`. Единственные проверки — `scripts/verify-security-lessons.mjs` (security-курс) и новый `scripts/validate-lessons.mjs`. Не покрыто: OTA (`update.mjs`, `app-ui.mjs`), IPC, запуск кода, прогресс/серии, i18n-резолвер, UI.

## 4. Курсы (`node scripts/validate-lessons.mjs`, опция `--json`)

Итог: **0 ошибок, 246 предупреждений**. Треки: python 21, java 17, cpp 17, csharp 17, security 35 (совпадает с `bundle-manifest.json`; хеши `release/updates/*` совпадают с `src/content/data`). Дубликатов id, битых ссылок между уроками, невалидного JSON, пустых уроков нет; манифест `lessons/*/manifest.json` согласован с файлами.

Предупреждения (что стоит чинить):
- `starter-equals-example` — 90: `starterCode` равен `exampleCode` (в уроке с проверкой стартовый код уже может быть готовым решением). python 13 (напр. `py-03`, `py-04`, `py-exam`), java 13, cpp 17, csharp 17, security 30 (напр. `sec-21`…`sec-27`, `sec-ethics`) — файлы `src/content/data/<track>.json`.
- `check-no-hint` — 108: в `checks[]` нет `hint` (python 21, java 17, cpp 17, csharp 17, security 36).
- `untranslated` — 47: `title/theory.en|he` совпадает с `ru` (python 6, напр. `py-05`, `py-07`, `py-12`; java 7; cpp 11; csharp 11; security 12, напр. `sec-22`, `sec-28`).
- `short-theory` — 1: `lessons/python/py-05.json` (116 символов).
Структурное замечание: `lessons/` (8 python-уроков в старой «plain-string» форме) — второй, расходящийся источник правды, попадает в asar и отдаётся IPC `lessons:list`; актуальный контент — `src/content/data/*.json`.

## 5. Функциональные баги, найденные при чтении

- `electron/main.mjs`: `loadPendingAppUpdate` не импортирован из `update.mjs`, IPC `updater:pending-app` падает с ReferenceError.
- `electron/update.mjs`: `savePendingAppUpdate({...})` вызывается с одним аргументом, а сигнатура `(userData, info)` → TypeError, после скачивания portable-exe «ожидающее обновление» не сохраняется, выставляется ошибка.
- `semverGt` продублирован в `update.mjs` и `portable-sync.mjs`; `electron/preload.mjs` (76 байт) — лишний файл рядом с `preload.cjs`.

## 6. TOP-5 слабых мест

1. OTA без подписи и с необязательной проверкой хеша даёт удалённое выполнение кода через загружаемый UI — `electron/update.mjs`, `electron/app-ui.mjs`.
2. Нет CSP, `sandbox:false`, Monaco/шрифты грузятся с внешних CDN, IPC без валидации (`shell:open-path`, `shell:open`, `settings:set`) — `electron/main.mjs`, `index.html`, `electron/preload.cjs`.
3. Нет ни одного теста и линтера, а `tsc` падает с 24 ошибками, скрытыми тем, что `npm run build` его не запускает — `package.json`, `src/App.tsx`, `src/content/pythonCourse.ts`.
4. 17 уязвимостей npm (включая critical `dompurify` в production-дереве и устаревший Electron 34) — `package.json`, `package-lock.json`.
5. Содержимое курсов: в 90 уроках стартовый код равен примеру, в 108 проверках нет подсказок, 47 заголовков/текстов не переведены, плюс дублирующая папка `lessons/` — `src/content/data/*.json`, `lessons/`.
## 7. Round 1a — результаты (ветка `improve/round-1`, локальные коммиты, без push/релиза)

Сделано (каждое исправление — отдельный коммит с тестом):
- **Баг** `electron/main.mjs`: добавлен импорт `loadPendingAppUpdate` — IPC `updater:pending-app` больше не падает. Тест: `tests/main-pending-app.test.mjs` (был красный до правки).
- **Баг** `electron/update.mjs`: `savePendingAppUpdate(userData, info)` вызывается с правильными аргументами, функция создаёт папку; exe с неверной контрольной суммой удаляется. Тесты: `tests/update-pending.test.mjs`.
- **S3**: `settings:set` принимает только известные ключи; `updateBaseUrl` — пустая строка или `https://` на `raw.githubusercontent.com` / `github.com` / `objects.githubusercontent.com` (для raw — только путь настроенного owner/repo, берётся из кода, файл конфига не печатается). Та же проверка при использовании (`resolveCoursesBase`), так что старое плохое значение из файла настроек игнорируется. Код: `electron/security-policy.mjs`. Тесты: `tests/settings-policy.test.mjs` (http, file, javascript, data, чужие хосты, креды, порт отклоняются).
- **S2**: `shell:open` — только `https://`; `shell:open-path` — только внутри `userData` и папки приложения (resolve + realpath, блок `..` и symlink/junction). Тесты: `tests/shell-policy.test.mjs`.
- **tsc**: 24 ошибки исправлены без изменения поведения (типы `LessonDefCheck`, `Record<string, Lesson[]>`, дубль поля в `SettingsModal`, типы параметров Monaco); `npm run typecheck` = 0 ошибок.
- Добавлены скрипты `npm test` (`node:test`, нужен Node 22+) и `npm run typecheck`.

Проверки: typecheck 0 ошибок; `npm test` 14/14; сборка (icon, courses, vite, electron-builder portable во временную папку) успешна.

Отложено: подпись OTA (S1, раунд 1b), S4, S5 (sandbox/CSP), S6, S7, S8 (`update.config.json` остаётся в git и в asar — решение за Vexx), контент курсов, линтер.
