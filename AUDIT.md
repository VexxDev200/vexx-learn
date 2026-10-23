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

## 8. Round 1b - выполнено (ветка `improve/round-1`, локальные коммиты, без push/релиза)

**Что сделано**
- **S3-дофикс**: `updateBaseUrl` привязан к настроенному owner/repo (`/<owner>/<repo>/...`) на **всех трёх** хостах (raw.githubusercontent.com, github.com, objects.githubusercontent.com); если owner/repo не настроены — пользовательский URL не принимается вообще (fail closed). Тесты: чужой репозиторий на каждом хосте отклоняется. При отклонении `settings:set` возвращает `settingsErrors.updateBaseUrl`, окно настроек остаётся открытым и показывает понятную ошибку (ru/en/he) — не молча. Примечание: ссылки `objects.githubusercontent.com` не содержат owner/repo в пути, поэтому как custom-URL они теперь никогда не проходят (для manifest они и не годятся).
- **Node**: `engines.node >= 22`, абзац в README, новый небольшой workflow `.github/workflows/ci.yml` (typecheck + `npm test` на Node 22). Существующие `release.yml` / `ota-publish.yml` (Node 20) не менялись.
- **S1 — подпись OTA-манифеста (Ed25519)**:
  - `electron/manifest-verify.mjs`: каноничный JSON (ключи отсортированы, без поля `signature`) + подпись/проверка;
  - `electron/ota-public-key.mjs`: ПУБЛИЧНЫЙ ключ в приложении + флаг `REQUIRE_SIGNED_MANIFEST = false`;
  - `electron/update.mjs`: после загрузки manifest.json — проверка подписи. Подписан и верен → ок; подпись есть, но не сходится (подмена, чужой ключ) → обновление отклонено; манифест без подписи → принимается с предупреждением (strict выключен, т.к. клиенты 0.2.11 подписи не проверяют и должны продолжать обновляться), при `REQUIRE_SIGNED_MANIFEST = true` — отклоняется;
  - хэши файлов: если в манифесте есть хэш — проверка обязательна (как и раньше, теперь покрыта тестами для курсов, UI-бандла и exe); для **подписанного** манифеста отсутствие хэша у курса/UI-бандла = отказ; у exe — только предупреждение (portableSha256 не заполняется в CI);
  - `scripts/sign-manifest.mjs` (+ `npm run sign:manifest`, режим `--check`); `scripts/pack-updates.mjs --sign` — необязательный явный шаг. Скрипты ничего не публикуют;
  - тесты `tests/ota-signature.test.mjs`: подписан+верный ключ проходит; подмена отклоняется; чужой ключ отклоняется; без подписи принимается с предупреждением (и отклоняется в strict); хэши; скрипт подписи.
- Закрытый ключ: `C:\Users\smird\keys\vexx-learn-ota-private.pem` (ACL только текущий пользователь), публичный: `...\vexx-learn-ota-public.pem`. Закрытый ключ не в репозитории, не в логах и не в отчётах.

**Отпечаток ПУБЛИЧНОГО ключа** (sha256 от SPKI DER):
`c1065d5f425950d0a97b3fb30211186d44736cc4a1e32f8e2f57c5151220f4f5` (keyId в манифесте = первые 16 символов: `c1065d5f425950d0`).
Пересчитать: `node -e "const c=require('crypto'),f=require('fs');console.log(c.createHash('sha256').update(c.createPublicKey(f.readFileSync('C:/Users/smird/keys/vexx-learn-ota-public.pem')).export({type:'spki',format:'der'})).digest('hex'))"`

**Как подписать релиз (локально)**
1. `npm run release:pack` (или `npm run courses && npm run build:ui && node scripts/pack-updates.mjs --sign` — тогда шаг 2 не нужен).
2. `npm run sign:manifest` — подписывает `release/updates/manifest.json` ключом из `VEXX_OTA_PRIVATE_KEY` или `<home>\keys\vexx-learn-ota-private.pem`; перед записью проверяет подпись встроенным публичным ключом.
3. `node scripts/sign-manifest.mjs --check release/updates/manifest.json` → `valid`.
4. Любое изменение manifest.json (в т.ч. повторный pack: меняется `generatedAt`) требует повторной подписи. Коммит и публикация — вручную, как и раньше.

**Что должен сделать Vexx сам**
- Сохранить копию закрытого ключа (`vexx-learn-ota-private.pem`) на USB-носитель / в менеджер паролей. Потеря ключа = подписанные манифесты больше не выпустить, пока в приложение не будет встроен новый публичный ключ (ротация пока не реализована).
- Проверить, что `update.config.json` не содержит токена (я его не открывал). Файл по-прежнему отслеживается git и упаковывается в asar — решение (`git rm --cached` / .gitignore) не принималось.
- Решить судьбу `ota-publish.yml`: CI собирает и коммитит манифест БЕЗ подписи (закрытого ключа в CI нет и быть не должно) — подпись, поставленная локально, будет перезаписана. Либо подписывать локально и не использовать авто-pack, либо переходить на подпись вне CI.
- Включить `REQUIRE_SIGNED_MANIFEST = true` только после того, как все клиенты обновятся до версии со встроенным ключом и релизы стабильно подписываются.

**Оговорки**
- Проверка подписи заработает только в следующем выпущенном exe/UI-бандле (версия выше 0.2.11); сейчас релиз не делался. Клиенты 0.2.11 поле `signature` игнорируют.
- Пока strict выключен, атакующий с доступом к хостингу манифеста может просто убрать подпись — защита станет полной только после включения strict.
- S4 (подпись самого exe/Authenticode), S5–S7, S8 — по-прежнему не закрыты.

Проверки: typecheck 0 ошибок; `npm test` 25/25; сборка (icon, courses, vite, electron-builder portable во временную папку, затем удалена) успешна, новые модули присутствуют в app.asar; побочный `bundle-manifest.json` откачен.

## 9. CI для OTA: проверка вместо публикации + как выпустить подписанный релиз

**Решение архитектора (выполнено).** `.github/workflows/ota-publish.yml` больше не запускает `release:pack` и не коммитит манифест — CI ничего не пересобирает, не пушит и не имеет закрытого ключа. На каждый push (и вручную) он делает одно: `node scripts/sign-manifest.mjs --check release/updates/manifest.json` (Node 22, без `npm ci`). Проверка падает (exit 1), если:
- манифест без подписи или подпись неверна (подмена, чужой ключ);
- sha256 любого файла рядом с манифестом (курсы `*.json`, `app-ui.zip`) не совпадает с хешем в манифесте, хеша нет или файла нет; имена файлов с `..`/путями отвергаются;
- exe: сверяется только если заполнен `portableSha256` И файл exe найден (`--exe <путь>` или рядом с manifest / на уровень выше); в CI exe нет (`release/*.exe` в .gitignore), поэтому там он пропускается с пометкой, а локально проверяется.

**ОЖИДАЕМО: CI будет КРАСНЫМ до первого подписанного релиза (0.2.12).** Закоммиченный `release/updates/manifest.json` неподписанный, проверка падает намеренно (это написано и в комментарии workflow). Манифест я не подписывал и не менял.

**Доказательство (на временной копии `release/updates`, реальный каталог не менялся):** неподписанная копия → exit 1; после подписи копии → exit 0 (6 файлов сверено); подменённый `app-ui.zip` при валидной подписи → exit 1. Автотесты: `tests/ota-signature.test.mjs` (CLI `--check`: unsigned→1, signed→0, tampered→1; подменённый zip, подменённый курс, нет файла, нет хеша, exe только при `portableSha256`, path traversal).

**Как выпустить подписанный релиз (вручную, всё локально):**
1. Поднять версию в `package.json` (решает Vexx) и собрать exe, если выходит новый exe: `npm run build` → `release/Vexx-Learn-Portable.exe` (именно этот файл потом загружается в GitHub Release — иначе `portableSha256` не совпадёт).
2. `npm run release:pack -- --sign` — собирает курсы, UI-бандл, `release/updates/*` и сразу подписывает манифест ключом из `VEXX_OTA_PRIVATE_KEY` или `C:\Users\smird\keys\vexx-learn-ota-private.pem`. (Альтернатива: `npm run release:pack`, затем `npm run sign:manifest`.)
3. `node scripts/sign-manifest.mjs --check release/updates/manifest.json` → должно быть `signature: valid`, `files: ok`, exit 0 — это ровно то, что запускает CI.
4. Закоммитить `release/updates/` (манифест + файлы вместе, ничего не пересобирать после подписи — любое изменение манифеста требует новой подписи) и запушить; CI станет зелёным.
5. Опубликовать exe (тег `v*` → `release.yml`, как и раньше). Закрытый ключ в CI/репозиторий не класть.

**Оговорки:** пока `REQUIRE_SIGNED_MANIFEST = false`, клиенты принимают и неподписанные манифесты — CI-проверка защищает репозиторий от случайной публикации неподписанного манифеста, но не заменяет strict-режим в клиенте. Старый пункт из раздела 8 про «судьбу ota-publish.yml» решён этим разделом. Автопубликация курсов из CI (раньше: пуш в main → OTA) отключена: курсы теперь доходят до клиентов только через локальный подписанный релиз.

## 10. Доработки после Критика: строгий CLI подписи, S8 (update.config.json)

**sign-manifest (коммит `236721d`).** Путь к манифесту теперь ОБЯЗАТЕЛЕН и для подписи, и для `--check`: без пути, с неизвестным флагом, с двумя путями, с флагом без значения или с `--pubkey/--exe` без `--check` скрипт завершается с кодом 2 и ничего не подписывает (раньше был неявный дефолт `release/updates/manifest.json`). `npm run sign:manifest` теперь явно передаёт `release/updates/manifest.json`; `pack-updates.mjs --sign` передаёт путь явно и работает (покрыто end-to-end тестом на временной копии структуры репозитория с тестовым ключом). Реальный манифест тесты не меняют (проверяется хеш до/после). В разделах 8–9 команды остаются верными (пути указаны).

**S8: проверка `update.config.json` на секреты (содержимое не выводилось, только булевы проверки):**
- префиксы токенов GitHub (`ghp_`, `gho_`, `ghu_`, `ghs_`, `ghr_`, `github_pat_`) в рабочем файле: **нет**;
- ключи вида `token/secret/password/authorization` в рабочем файле: **нет**; длинных (>=36 симв.) «секретоподобных» строк: **нет** (самое длинное слово 19 симв.);
- история git: файл затрагивал 1 коммит; в диффах истории токенов (префиксы), ключей `token/secret/password/authorization` и длинных строк: **нет**.
Вывод: токена в файле и в истории нет. Историю не переписывали.

**Файл выведен из git (коммит `9c1188b`).** `git rm --cached update.config.json` + строка в `.gitignore`; файл на диске остался нетронутым (хеш до/после совпал). В репозиторий добавлен шаблон `update.config.example.json` (placeholder-owner, без секретов). Как приложение читает файл: `loadUpdateConfig(appRoot)` ищет `<appRoot>/update.config.json` и на уровень выше; `package.json build.files` по-прежнему упаковывает его в asar, если он есть на диске. Если файла нет — приложение не падает: берутся значения по умолчанию, owner пустой → OTA выключен (тест). Чтобы чистая сборка (CI/свежий клон) не получила «молча без обновлений», добавлен `scripts/ensure-update-config.mjs` (хук `prebuild` для `npm run build`): файл есть — не трогает и не читает; иначе в CI создаёт его из `GITHUB_REPOSITORY` (только owner/repo), иначе копирует шаблон и громко предупреждает, что OTA в такой сборке отключён. `scripts/gh-release.mjs` теперь понятно сообщает об отсутствии файла.

Проверено: сборка из «чистого» дерева (`git checkout-index`, без `update.config.json`, `node_modules` по ссылке) — `tsc` 0 ошибок, `npm test` 39/39, `npm run build` успешен, в asar лежит созданный prebuild-ом файл-заглушка. Сборка рабочей копии (во временную папку, затем удалена) тоже успешна; `bundle-manifest.json` откачен.

**Что остаётся Vexx.** Файл остаётся в старых коммитах (там нет токена, но owner/repo публичны так или иначе). Убедиться, что у локальной сборки есть реальный `update.config.json` (иначе exe соберётся с OTA OFF — prebuild предупредит). `.env` по-прежнему не в `.gitignore` (не входило в задачу; рекомендуется добавить).

## 11. Round 2 / S4 - защита portable-exe (ветка `improve/round-1`, локальные коммиты, без push/релиза)

**Проблема.** Portable-exe скачивается из GitHub Releases и потом запускается пользователем. Раньше хеш проверялся только если он случайно был в манифесте; в подписанном манифесте отсутствие `portableSha256` давало лишь предупреждение, а exe всё равно скачивался. Подпись манифеста не защищала exe.

**Схема (код: `electron/update.mjs`, `scripts/pack-updates.mjs`, `scripts/sign-manifest.mjs`).**
1. *Релиз (локально).* Сначала собирается exe (`npm run build`), потом `pack-updates --sign`: `portableSha256` берётся из собранного `release/Vexx-Learn-Portable.exe` ДО подписи, поэтому подпись покрывает хеш exe. Если exe нет, `--sign` отказывается (exit 1, прежний манифест не трогается); для релиза только курсов/UI есть явный флаг `--allow-no-exe` (в манифесте `portableSha256: null`). `scripts/ship.mjs` теперь вызывает `pack-updates --sign`.
2. *Клиент, скачивание.* Если манифест подписан (или включён `REQUIRE_SIGNED_MANIFEST`), хеш exe ОБЯЗАТЕЛЕН; без него exe не скачивается (warning + `appDownloadSkipped`, курсы и UI применяются как обычно). Хеш привязан к версии: `manifest.appVersion` должен совпадать с версией релиза (tag), иначе отказ. Файл качается в `<name>.part`, считается SHA-256, при совпадении атомарный rename; при несовпадении `.part` удаляется, pending не записывается, ошибка показывается. Уже лежащий файл (в т.ч. подложенный) при известном хеше не переиспользуется: перекачивается.
3. *Клиент, запуск.* Проверка повторяется при выдаче pending (`updater:pending-app`) и в `shell:open-path`: файл в `userData/pending-updates` открывается только если его размер и SHA-256 совпадают с записью; при несовпадении файл удаляется, pending сбрасывается. Прочие файлы в `pending-updates` открыть нельзя. Это защищает от подмены между скачиванием и запуском.
4. *Прочее.* URL ассета обязан лежать в настроенном owner/repo; редиректы только на https-хосты из allowlist (проверяется и финальный хост); `tag_name` валидируется (`SAFE_VERSION`, защита от path traversal).

**Проверка всех путей удаления файла с неверной суммой.** (a) скачивание: `.part` удаляется до rename; (b) при ошибке сети/редиректа/размера `.part` удаляется; (c) pending-запись с неверным хешем: файл и запись удаляются при `updater:pending-app`; (d) `shell:open-path`: то же перед открытием; (e) старый/подложенный файл с тем же именем заменяется перекачкой, если не совпали запись pending или хеш; если запись и размер совпали, файл переиспользуется без повторного хеширования, но полный хеш всё равно проверяется при выдаче/открытии (п. 3). Каждый путь покрыт в `tests/portable-exe.test.mjs` (13 тестов). Для проверки, что тесты не «зелёные впустую», хеш-проверки были временно отключены: тесты упали (файл восстановлен, сверка хеша файла).

**Тесты.** Новый обязательный кейс: подписанный манифест БЕЗ `portableSha256` (поля нет / null) - exe не скачивается, pending нет, сбоя нет; unsigned без хеша - по-старому с предупреждением (совместимость); `appVersion` не совпал; подложенный файл; чужой репозиторий/тег/редирект; пост-скачивание подмена; IPC. В `ota-signature.test.mjs`: pack-updates e2e во временной раскладке (хеш exe попадает в манифест до подписи, `--sign` без exe отказывает, `--allow-no-exe` работает, `--check` пишет заметку про отсутствие хеша, `ship.mjs` содержит `--sign`). Реальный `release/updates/manifest.json` не менялся (SHA-256 до/после совпадает).

**Как выпустить релиз с защищённым exe.**
1. `npm run build` (получаем `release/Vexx-Learn-Portable.exe`).
2. `npm run release:pack -- --sign` (или `npm run ship`, он делает это сам): манифест с `portableSha256` и подписью.
3. `node scripts/sign-manifest.mjs --check release/updates/manifest.json --exe release/Vexx-Learn-Portable.exe`: проверка подписи, хешей курсов/UI и exe.
4. Загрузить в GitHub Release ИМЕННО ЭТОТ exe (тот же файл, не пересобранный).

**Совместимость с 0.2.11.** Старые клиенты манифест не проверяют и подписи/`portableSha256` игнорируют: поведение не меняется, лишние поля безвредны. Защита действует только в exe, выпущенных после этого изменения.

**Оговорки и открытые решения.**
- `REQUIRE_SIGNED_MANIFEST = false`: пока строгий режим выключен, тот, кто может переписать манифест, может убрать подпись и свести клиента к unsigned-пути (там exe проверяется по хешу только если он есть, но хеш уже неаутентичен). Включать строгий режим после того, как основная масса клиентов будет на версии с проверкой.
- CI не может проверить хеш exe (exe не в репозитории, `release/*.exe` в .gitignore): это только локально, `--check --exe`.
- **Конфликт с `.github/workflows/release.yml`** (не менялся): по тегу CI собирает СВОЙ exe и загружает его в Release. Сборка не воспроизводимая, хеш будет другим, и клиенты с проверкой отвергнут такой exe. Нужно решение Архитектора: либо убрать сборку/загрузку exe из release.yml (exe грузится локально через ship/gh-release), либо делать подпись/хеш из CI-exe (тогда в CI понадобится ключ, что исключено).
- Подписанный манифест без `portableSha256` не вызывает пользовательскую ошибку: exe просто не предлагается; это страхует только guard в `pack-updates`.
- Для unsigned-манифеста без хеша (legacy) в pending записывается `sha256: null`, и проверок при запуске нет: это осознанная совместимость, пока строгий режим выключен.
- CI-проверка `ota-publish` остаётся красной до первого подписанного релиза (0.2.12).
