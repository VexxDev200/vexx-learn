import type { LessonDef } from "./types";

const H = (ru: string, en: string, he: string) => ({ ru, en, he });

export const PYTHON_COURSE: LessonDef[] = [
  {
    id: "py-01",
    track: "python",
    minutes: 6,
    title: H("1. Первая программа", "1. Your first program", "1. התוכנית הראשונה"),
    theory: H(
      "## Программа\n\nКомпьютер выполняет команды **по порядку**.\n\n`print()` показывает текст в консоли.\n\n```python\nprint(\"Hello\")\n```",
      "## Programs\n\nThe computer runs commands **in order**.\n\n`print()` shows text in the console.\n\n```python\nprint(\"Hello\")\n```",
      "## תוכנית\n\nהמחשב מריץ פקודות **לפי סדר**.\n\n`print()` מציג טקסט בקונסול.\n\n```python\nprint(\"Hello\")\n```"
    ),
    exampleCode: 'print("Vexx Learn")\nprint(2026)',
    exampleExplain: H("Текст в кавычках, число — без.", "Text in quotes; numbers without.", "טקסט במרכאות, מספר בלי."),
    task: H("Выведи `Hello` и `World` на двух строках.", "Print `Hello` and `World` on two lines.", "הדפס `Hello` ו-`World` בשתי שורות."),
    starterCode: 'print("Hello")\nprint("World")\n',
    checks: [{ expectedStdout: "Hello\nWorld" }],
  },
  {
    id: "py-02",
    track: "python",
    minutes: 8,
    title: H("2. Переменные", "2. Variables", "2. משתנים"),
    theory: H(
      "`name = \"Alex\"` — имя слева, значение справа.\n\nИспользуй переменные в `print(name)`.",
      "`name = \"Alex\"` — name on the left, value on the right.\n\nUse variables in `print(name)`.",
      "`name = \"Alex\"` — שם משמאל, ערך מימין.\n\nהשתמש ב-`print(name)`."
    ),
    exampleCode: "x = 7\ny = 3\nprint(x + y)",
    exampleExplain: H("Сложение чисел.", "Adding numbers.", "חיבור מספרים."),
    task: H("`a=12`, `b=8`. Выведи сумму (20).", "Set `a=12`, `b=8`. Print the sum (20).", "`a=12`, `b=8`. הדפס סכום (20)."),
    starterCode: "a = 12\nb = 8\n",
    checks: [{ expectedStdout: "20", hint: H("print(a + b)", "print(a + b)", "print(a + b)") }],
  },
  {
    id: "py-03",
    track: "python",
    minutes: 10,
    title: H("3. f-строки", "3. f-strings", "3. מחרוזות f"),
    theory: H(
      "`print(f\"Hi {name}\")` подставляет значение в `{}`.",
      "`print(f\"Hi {name}\")` inserts values inside `{}`.",
      "`print(f\"Hi {name}\")` מכניס ערכים לתוך `{}`."
    ),
    exampleCode: 'n = 5\nprint(f"Result: {n * 2}")',
    exampleExplain: H("Внутри {} можно выражения.", "Expressions inside {}.", "ביטויים בתוך {}."),
    task: H("`price=40`. Выведи `Total: 40`.", "`price=40`. Print `Total: 40`.", "`price=40`. הדפס `Total: 40`."),
    starterCode: "price = 40\n",
    checks: [{ expectedStdout: "Total: 40", hint: H('print(f"Total: {price}")', 'print(f"Total: {price}")', 'print(f"Total: {price}")') }],
  },
  {
    id: "py-04",
    track: "python",
    minutes: 12,
    title: H("4. if / else", "4. if / else", "4. if / else"),
    theory: H(
      "```python\nif x > 0:\n    print(\"plus\")\nelse:\n    print(\"minus\")\n```\nОтступ 4 пробела обязателен.",
      "Same structure — **indent 4 spaces** after `if`/`else`.",
      "אותו מבנה — **הזחה של 4 רווחים** אחרי if/else."
    ),
    exampleCode: "v = 0\nif v == 0:\n    print(\"zero\")\nelse:\n    print(\"other\")",
    exampleExplain: H("`==` сравнение, `=` присваивание.", "`==` compare, `=` assign.", "`==` השוואה, `=` השמה."),
    task: H("`n=7`. Если n>5 → `big`, иначе `small`.", "`n=7`. If n>5 print `big`, else `small`.", "`n=7`. אם n>5 הדפס `big`, אחרת `small`."),
    starterCode: "n = 7\n",
    checks: [{ expectedStdout: "big" }],
  },
  {
    id: "py-05",
    track: "python",
    minutes: 12,
    title: H("5. Цикл for", "5. for loop", "5. לולאת for"),
    theory: H(
      "`for i in range(3):` → 0,1,2. `range(1,4)` → 1,2,3.",
      "`for i in range(3):` → 0,1,2. `range(1,4)` → 1,2,3.",
      "`for i in range(3):` → 0,1,2. `range(1,4)` → 1,2,3."
    ),
    exampleCode: "s = 0\nfor i in range(1, 4):\n    s += i\nprint(s)",
    exampleExplain: H("Сумма 1+2+3 = 6.", "Sum 1+2+3 = 6.", "סכום 1+2+3 = 6."),
    task: H("Выведи 2,4,6 каждое с новой строки.", "Print 2, 4, 6 each on its own line.", "הדפס 2, 4, 6 כל אחד בשורה."),
    starterCode: "for i in range(1, 4):\n    print(i * 2)\n",
    checks: [{ expectedStdout: "2\n4\n6" }],
  },
  {
    id: "py-06",
    track: "python",
    minutes: 10,
    title: H("6. Списки", "6. Lists", "6. רשימות"),
    theory: H(
      "`nums = [1,2,3]` — индекс с 0: `nums[0]`. `len(nums)` — длина.",
      "`nums = [1,2,3]` — index from 0. `len(nums)` is length.",
      "`nums = [1,2,3]` — אינדקס מ-0. `len(nums)` אורך."
    ),
    exampleCode: "a = [10, 20, 30]\nprint(a[1])",
    exampleExplain: H("Индекс 1 → 20.", "Index 1 → 20.", "אינדקס 1 → 20."),
    task: H("Список `[3,1,4]`. Выведи `max` через `max(...)`.", "List `[3,1,4]`. Print max using `max(...)`.", "רשימה `[3,1,4]`. הדפס max עם `max(...)`."),
    starterCode: "nums = [3, 1, 4]\n",
    checks: [{ expectedStdout: "4", hint: H("print(max(nums))", "print(max(nums))", "print(max(nums))") }],
  },
  {
    id: "py-07",
    track: "python",
    minutes: 14,
    title: H("7. Функции", "7. Functions", "7. פונקציות"),
    theory: H(
      "```python\ndef add(a, b):\n    return a + b\n```",
      "Functions group reusable logic. Use `return`.",
      "פונקציות מאגדות לוגיקה. השתמש ב-`return`."
    ),
    exampleCode: "def sq(n):\n    return n * n\nprint(sq(5))",
    exampleExplain: H("sq(5) → 25.", "sq(5) → 25.", "sq(5) → 25."),
    task: H("`mul(a,b)` и выведи `mul(6,7)` → 42.", "Write `mul(a,b)` and print `mul(6,7)` → 42.", "כתוב `mul(a,b)` והדפס `mul(6,7)` → 42."),
    starterCode: "def mul(a, b):\n    pass\n\nprint(mul(6, 7))\n",
    checks: [{ expectedStdout: "42", hint: H("return a * b", "return a * b", "return a * b") }],
  },
  {
    id: "py-08",
    track: "python",
    minutes: 14,
    title: H("8. Словари", "8. Dictionaries", "8. מילונים"),
    theory: H(
      "`user = {\"name\": \"Li\", \"age\": 18}` — ключ → значение.",
      "Dict maps keys to values: `user[\"name\"]`.",
      "מילון ממפה מפתחות לערכים."
    ),
    exampleCode: 'd = {"x": 1, "y": 2}\nprint(d["x"] + d["y"])',
    exampleExplain: H("Доступ по ключу в кавычках.", "Access by string key.", "גישה במפתח מחרוזת."),
    task: H("Словарь `scores`: ann=90, bob=85. Выведи сумму.", "Dict `scores`: ann=90, bob=85. Print sum.", "מילון scores: ann=90, bob=85. הדפס סכום."),
    starterCode: 'scores = {"ann": 90, "bob": 85}\n',
    checks: [{
      expectedStdout: "175",
      hint: H(
        "print(scores[\"ann\"] + scores[\"bob\"])",
        "print(scores[\"ann\"] + scores[\"bob\"])",
        "print(scores[\"ann\"] + scores[\"bob\"])"
      ),
    }],
  },
  {
    id: "py-09",
    track: "python",
    minutes: 12,
    title: H("9. while", "9. while loop", "9. while"),
    theory: H(
      "`while n > 0:` повторяет пока условие True. Не забывай менять `n`, иначе бесконечный цикл.",
      "`while condition:` repeats while True. Update variables inside.",
      "`while` חוזר כל עוד התנאי True."
    ),
    exampleCode: "n = 3\nwhile n > 0:\n    print(n)\n    n -= 1",
    exampleExplain: H("3,2,1.", "Prints 3,2,1.", "מדפיס 3,2,1."),
    task: H("Считай от 5 до 1 (каждое число с новой строки).", "Count down 5 to 1, one per line.", "ספור מ-5 ל-1, שורה לכל מספר."),
    starterCode: "n = 5\nwhile n >= 1:\n    print(n)\n    n -= 1\n",
    checks: [{ expectedStdout: "5\n4\n3\n2\n1" }],
  },
  {
    id: "py-10",
    track: "python",
    minutes: 12,
    title: H("10. Строки", "10. Strings", "10. מחרוזות"),
    theory: H(
      "`len(s)`, `s.upper()`, `s.split()` — базовые методы строк.",
      "Strings: `len`, `.upper()`, `.split()`.",
      "מחרוזות: len, upper, split."
    ),
    exampleCode: 'w = "vexx learn"\nprint(w.title())',
    exampleExplain: H("title() — заглавные буквы слов.", "title() capitalizes words.", "title() ראשי תיבות."),
    task: H('Строка `"a,b,c"`. split по `,` и выведи длину списка (3).', 'Split `"a,b,c"` by comma, print list length (3).', 'פצל `"a,b,c"` בפסיק, הדפס אורך (3).'),
    starterCode: 's = "a,b,c"\n',
    checks: [{ expectedStdout: "3", hint: H("print(len(s.split(\",\")))", "print(len(s.split(\",\")))", "print(len(s.split(\",\")))") }],
  },
  {
    id: "py-11",
    track: "python",
    minutes: 15,
    title: H("11. Файлы (идея)", "11. Files (concept)", "11. קבצים (רעיון)"),
    theory: H(
      "Чтение файлов: `open(path).read()` — в реальных проектах используй `with open(...) as f:`.\n\nЗдесь — логика без диска.",
      "Files use `open`. In production use `with open(...) as f:`.\n\nThis task uses strings only.",
      "קבצים עם open. בפרויקטים: with open."
    ),
    exampleCode: 'data = "line1\\nline2"\nprint(data.splitlines()[1])',
    exampleExplain: H("Имитация двух строк.", "Two-line simulation.", "שתי שורות מדומות."),
    task: H('Переменная `text="one\\ntwo\\nthree"`. Выведи вторую строку `two`.', 'Variable `text` with three lines. Print second line `two`.', 'הדפס השורה השנייה two.'),
    starterCode: 'text = "one\\ntwo\\nthree"\nlines = text.splitlines()\n',
    checks: [{ expectedStdout: "two", hint: H("print(lines[1])", "print(lines[1])", "print(lines[1])") }],
  },
  {
    id: "py-12",
    track: "python",
    minutes: 15,
    title: H("12. Мини-проект", "12. Mini project", "12. מיני-פרויקט"),
    theory: H(
      "Собери функцию + цикл + список — так выглядят маленькие утилиты.",
      "Combine functions, loops, lists — small tools look like this.",
      "שלב פונקציות, לולאות ורשימות."
    ),
    exampleCode: "def total(xs):\n    s = 0\n    for x in xs:\n        s += x\n    return s\nprint(total([1,2,3]))",
    exampleExplain: H("Сумма списка.", "Sum of list.", "סכום רשימה."),
    task: H("`evens(nums)` — сколько чётных. `evens([1,2,3,4])` → 2.", "`evens(nums)` counts even numbers. `[1,2,3,4]` → 2.", "ספור זוגיים — תשובה 2."),
    starterCode: "def evens(nums):\n    c = 0\n    for n in nums:\n        pass\n    return c\n\nprint(evens([1, 2, 3, 4]))\n",
    checks: [{ expectedStdout: "2", hint: H("if n % 2 == 0: c += 1", "if n % 2 == 0: c += 1", "if n % 2 == 0: c += 1") }],
  },
  {
    id: "py-13",
    track: "python",
    kind: "ethics",
    minutes: 20,
    title: H("13. Безопасность и этика", "13. Security & ethics", "13. אבטחה ואתיקה"),
    theory: H(
      "## Законно и полезно\n\n- **Вирусы, RAT, стилеры** — вредоносное ПО. Создавать и распространять **незаконно**.\n\n- Учись **защите**: сложные пароли, 2FA, не запускай неизвестные `.exe`, обновления ОС.\n\n- **Этичный хакинг** — только с **письменным разрешением** (bug bounty, pentest по договору).\n\n- В этом курсе мы учим **создавать**, а не ломать чужие системы.",
      "## Legal & safe\n\n- **Malware, RATs, stealers** harm people and are **illegal** to build/distribute.\n\n- Learn **defense**: passwords, 2FA, updates, don't run unknown files.\n\n- **Ethical hacking** only with **written permission**.\n\n- This course teaches **building**, not attacking others.",
      "## חוקי ובטוח\n\n- **תוכנות זדוניות** — בלתי חוקיות ומזיקות.\n\n- למד **הגנה**: סיסמאות, 2FA, עדכונים.\n\n- **האקינג אתי** רק עם אישור בכתב."
    ),
    exampleCode: 'tips = ["2FA", "updates", "no unknown exe"]\nfor t in tips:\n    print(t)',
    exampleExplain: H("Три правила защиты.", "Three safety rules.", "שלושה כללי בטיחות."),
    task: H("Выведи три строки: `learn`, `build`, `protect`.", "Print three lines: `learn`, `build`, `protect`.", "הדפס learn, build, protect."),
    starterCode: 'print("learn")\nprint("build")\nprint("protect")\n',
    checks: [{ expectedStdout: "learn\nbuild\nprotect" }],
  },
  {
    id: "py-exam",
    track: "python",
    kind: "exam",
    minutes: 45,
    title: H("Финальный экзамен Python", "Python final exam", "מבחן סופי Python"),
    theory: H(
      "## Экзамен\n\nНапиши код по заданию. Все тесты должны пройти.\n\nМожно использовать всё из курса.",
      "## Exam\n\nWrite code for the task. All tests must pass.",
      "## מבחן\n\nכתוב קוד. כל הבדיקות חייבות לעבור."
    ),
    exampleCode: "def min2(a, b):\n    return a if a < b else b\nprint(min2(3, 9))",
    exampleExplain: H("Пример функции.", "Sample function.", "דוגמה."),
    task: H(
      "Функция `grade(scores)` — список оценок. Верни среднее (одно число). Для `[10,20,30]` выведи `20.0` или `20` (допустимы оба).",
      "Function `grade(scores)` returns average. For `[10,20,30]` print `20` (int or float OK).",
      "פונקציה grade מחזירה ממוצע. ל-[10,20,30] הדפס 20."
    ),
    starterCode: "def grade(scores):\n    pass\n\nprint(grade([10, 20, 30]))\n",
    checks: [
      {
        expectedStdout: "20",
        hint: H("return sum(scores)/len(scores)", "return sum(scores)/len(scores)", "ממוצע"),
      },
    ],
  },
];
