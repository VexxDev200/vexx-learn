# Vexx Learn

Лаунчер обучения кодингу: теория, пример, редактор, **Запустить** и **Проверить задание**.

Сейчас: **Python** (8 уроков). Java / C++ / C# — в меню «скоро».

## Требования

- Windows 11 (у тебя)
- [Node.js](https://nodejs.org/) **22+**
- [Python 3](https://www.python.org/downloads/) с галочкой **Add to PATH**

## Проверки (typecheck и тесты)

```bash
npm run typecheck
npm test
```

`npm test` использует встроенный `node:test` и `--experimental-test-module-mocks`, поэтому нужен **Node.js 22 или новее** (в `package.json` задано `engines.node >= 22`).

## Запуск (разработка)

```bash
cd vexx-learn
npm install
npm run dev
```

## Новый чат в Cursor

**File → Open Folder** → `vexx-learn` — дальше вся работа в отдельном проекте.

## Добавить урок

1. `lessons/python/py-XX.json` — поля как в `py-01.json`
2. Добавь id в `lessons/python/manifest.json` → `order`

## Сборка exe

```bash
npm run build
```

Артефакт в `release/`.
