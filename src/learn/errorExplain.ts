import type { Lang } from "../content/types";

type Rule = {
  test: RegExp;
  ru: string;
  en: string;
  he: string;
};

const COMMON: Rule[] = [
  {
    test: /IndentationError|unexpected indent|expected an indented block/i,
    ru: "Python: после `:` нужен отступ (обычно 4 пробела). Все строки внутри `if`/`for`/`def` должны быть сдвинуты одинаково.",
    en: "Python: lines after `:` must be indented (usually 4 spaces).",
    he: "Python: אחרי `:` צריך הזחה.",
  },
  {
    test: /SyntaxError|invalid syntax/i,
    ru: "Синтаксис: пропущена кавычка, скобка или двоеточие. Сверь строку из traceback с примером в уроке.",
    en: "Syntax error: missing quote, bracket, or colon.",
    he: "שגיאת תחביר.",
  },
  {
    test: /NameError|is not defined/i,
    ru: "Имя не объявлено: опечатка в переменной или ты используешь её до присваивания.",
    en: "Name not defined: typo or used before assignment.",
    he: "שם לא מוגדר.",
  },
  {
    test: /;' expected|expected ';'/i,
    ru: "Java/C#: в конце многих строк нужна точка с запятой `;`.",
    en: "Java/C#: many statements need a trailing `;`.",
    he: "חסר `;` בסוף שורה.",
  },
  {
    test: /class.*expected|expected class/i,
    ru: "Java: публичный класс должен называться как файл — обычно `Main` в `Main.java`.",
    en: "Java: public class name must match the file (often `Main`).",
    he: "Java: שם class חייב להתאים לקובץ.",
  },
  {
    test: /cout|undeclared identifier.*cout/i,
    ru: "C++: подключи `#include <iostream>` и `using namespace std;` или пиши `std::cout`.",
    en: "C++: include `<iostream>` and use `cout` / `std::cout`.",
    he: "C++: חסר iostream.",
  },
  {
    test: /expected ';' before|error: expected/i,
    ru: "C++: часто не хватает `;` после оператора или `}` в не том месте.",
    en: "C++: missing `;` or brace mismatch.",
    he: "C++: `;` או סוגריים.",
  },
  {
    test: /CS\d{4}|error CS/i,
    ru: "C#: читай код ошибки (CS…) — обычно `;`, скобки или неверное имя типа.",
    en: "C#: read the CS#### code — often `;`, braces, or wrong type.",
    he: "C#: קוד שגיאה CS.",
  },
  {
    test: /cannot find symbol|compilation failed/i,
    ru: "Java: компилятор не нашёл метод/переменную — проверь `static`, типы и имя `Main`.",
    en: "Java compile: symbol not found — check `static`, types, `Main`.",
    he: "Java: סמל לא נמצא.",
  },
  {
    test: /python.*not found|ENOENT.*python/i,
    ru: "Python не установлен или не в PATH. Установи с python.org и отметь Add to PATH.",
    en: "Python not in PATH. Install from python.org.",
    he: "Python לא ב-PATH.",
  },
  {
    test: /javac|java.*not found/i,
    ru: "JDK не найден. Установи Java (JDK 17+) и добавь в PATH.",
    en: "JDK not found. Install JDK 17+.",
    he: "JDK חסר.",
  },
  {
    test: /g\+\+|cannot open/i,
    ru: "C++: компилятор g++ не найден (MinGW / MSYS2).",
    en: "C++: g++ compiler not found.",
    he: "g++ חסר.",
  },
  {
    test: /dotnet|NET SDK/i,
    ru: "C#: нужен .NET SDK 8. Скачай с dotnet.microsoft.com.",
    en: "C#: install .NET 8 SDK.",
    he: "נדרש .NET SDK.",
  },
];

const OUTPUT_HINT: Rule[] = [
  {
    test: /.*/,
    ru: "Автопроверка сравнивает вывод **посимвольно**: лишний пробел, другой регистр или лишняя пустая строка = провал. Сверь с «Ожидалось».",
    en: "Auto-check compares **exact** stdout — spaces and newlines matter.",
    he: "הפלט חייב להיות מדויק.",
  },
];

export function explainError(
  stderr: string,
  lang: Lang,
  editorLang: string,
  context: "run" | "check" = "run"
): string | null {
  const text = (stderr || "").trim();
  if (!text && context === "run") return null;

  const blob = text + " " + editorLang;
  for (const r of COMMON) {
    if (r.test.test(blob)) {
      return lang === "ru" ? r.ru : lang === "he" ? r.he : r.en;
    }
  }
  if (context === "check" && !text) {
    const h = OUTPUT_HINT[0];
    return lang === "ru" ? h.ru : lang === "he" ? h.he : h.en;
  }
  if (text) {
    return lang === "ru"
      ? "Читай текст ошибки сверху вниз — последняя строка часто главная. Исправь и снова Запустить."
      : lang === "he"
        ? "קרא את השגיאה מלמעלה למטה."
        : "Read the error top to bottom; fix and Run again.";
  }
  return null;
}
