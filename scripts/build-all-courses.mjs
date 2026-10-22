/**
 * Generates src/content/data/*.json — run: node scripts/build-all-courses.mjs
 */
import { mkdirSync, writeFileSync } from "fs";
import { dirname, join } from "path";
import { fileURLToPath } from "url";

const OUT = join(dirname(fileURLToPath(import.meta.url)), "..", "src", "content", "data");
mkdirSync(OUT, { recursive: true });

const H = (ru, en, he) => ({ ru, en, he });

function theory(ru, en, he) {
  const tipsRu =
    "\n\n### Частые ошибки\n- Путаница `=` (присвоить) и `==` (сравнить).\n- Неверный отступ (Python) или пропущенная `{ }` / `;` (Java, C++, C#).\n- Автопроверка сравнивает **точный** вывод — лишний пробел или другой регистр = провал.\n\n### Как проходить урок\n1. Прочитай блок **Подробно**.\n2. Скопируй **пример** в редактор и нажми **Запустить**.\n3. Реши **задание** в стартовом коде.\n4. **Проверить** — зелёный = урок засчитан.\n5. Поэкспериментируй: поменяй входные данные и снова запусти.";
  const tipsEn =
    "\n\n### Common mistakes\n- `=` vs `==`.\n- Wrong indent (Python) or missing braces/semicolons.\n- **Check** compares exact stdout.\n\n### How to study\nRead → Run example → Solve task → **Check** → experiment.";
  const tipsHe =
    "\n\n### טעויות נפוצות\n- `=` מול `==`.\n- הזחה שגויה או סוגריים חסרים.\n- **בדוק** דורש פלט מדויק.\n\n### איך ללמוד\nקרא → הרץ דוגמה → פתור → **בדוק**.";

  return H(
    `## Подробно\n\n${ru}${tipsRu}\n\n## Что сделать\n\nПрочитай пример → **Запустить** → измени код под задачу → **Проверить**.`,
    `## In depth\n\n${en}${tipsEn}\n\n## What to do\n\nRead the example → **Run** → edit → **Check**.`,
    `## לעומק\n\n${he}${tipsHe}\n\n## מה לעשות\n\nקרא → הרץ → ערוך → בדוק.`
  );
}

function lesson(base) {
  return {
    kind: "lesson",
    ...base,
    exampleExplain: H(
      "Разбери каждую строку: что объявляется, что вычисляется, что уходит в консоль.",
      "Walk through each line: declarations, expressions, console output.",
      "עבור שורה שורה: הצהרות, ביטויים, פלט."
    ),
  };
}

function exam(id, track, editorLang, title, task, starter, expected, minutes = 45) {
  return {
    id,
    track,
    kind: "exam",
    minutes,
    editorLang,
    title,
    theory: theory(
      "Экзамен закрывает весь трек. Нужно написать рабочий код без подсказок стартера (кроме шаблона). Все автотесты по выводу должны пройти. Если застрял — вернись к урокам про функции, циклы и коллекции.",
      "Final exam for this track. Write working code; all stdout checks must pass. Review functions, loops, and collections if stuck.",
      "מבחן סופי לכל המסלול. כל הבדיקות חייבות לעבור."
    ),
    exampleCode: starter,
    exampleExplain: H("Шаблон экзамена.", "Exam template.", "תבנית מבחן."),
    task,
    starterCode: starter,
    checks: [{ expectedStdout: expected }],
  };
}

function ethics(id, track, editorLang, starter, expected) {
  return {
    id,
    track,
    kind: "ethics",
    minutes: 25,
    editorLang,
    title: H("Безопасность и этика", "Security & ethics", "אבטחה ואתיקה"),
    theory: theory(
      "Программирование даёт силу менять системы. **Вредоносное ПО** (вирусы, RAT, стилеры, шифровальщики) создаёт и распространять **незаконно** — это вред людям и карьере.\n\n**Легальные направления:** защита (blue team), анализ уязвимостей **с письменным разрешением**, open-source, игры, автоматизация, обучение.\n\n**Гигиена:** уникальные пароли + менеджер паролей, 2FA, обновления ОС, не запускать `.exe` из чатов, бэкапы. В Vexx Learn ты учишься **строить** и **защищать**, не ломать чужие машины.",
      "Coding is power. **Malware** (RATs, stealers, ransomware) is **illegal** and harms people.\n\n**Legal paths:** defense, pentesting **with written permission**, apps, games, automation.\n\n**Hygiene:** password manager, 2FA, updates, suspicious attachments, backups. Here you **learn**, **build**, **protect**.",
      "קוד נותן כוח. תוכנות זדוניות בלתי חוקיות.\n\nמסלולים חוקיים: הגנה, בדיקות חדירות **באישור**, פיתוח.\n\nהיגיינה: סיסמאות, 2FA, עדכונים, גיבויים."
    ),
    exampleCode: starter,
    exampleExplain: H("Три строки — девиз курса.", "Three lines — course motto.", "שלוש שורות."),
    task: H(
      "Выведи три строки: `learn`, `build`, `protect` (каждая с новой строки).",
      "Print learn, build, protect (one per line).",
      "הדפס learn, build, protect — שורה לכל אחד."
    ),
    starterCode: starter,
    checks: [{ expectedStdout: expected }],
  };
}

// ——— PYTHON ———
const python = [
  lesson({
    id: "py-01", track: "python", minutes: 12, editorLang: "python",
    title: H("1. Первая программа", "1. First program", "1. תוכנית ראשונה"),
    theory: theory(
      "Программа на Python — это обычный текстовый файл (часто `main.py`), который интерпретатор выполняет **сверху вниз**, строка за строкой.\n\n`print(значение)` — встроенная команда: она превращает значение в текст и отправляет в **консоль** (терминал). Строковый литерал пишут в кавычках: `\"Hello\"`. Числа `1`, `3.14` кавычек не требуют.\n\nОдна программа может содержать много вызовов `print` — каждый обычно даёт **новую строку** вывода.",
      "A Python program runs **top to bottom**. `print(value)` sends text to the **console**. String literals use quotes; numbers do not.\n\nMultiple `print` calls usually produce multiple lines of output.",
      "תוכנית Python רצה מלמעלה למטה. `print` מדפיס לקונסול. מחרוזות במרכאות, מספרים לא."
    ),
    exampleCode: 'print("Vexx Learn")\nprint(1 + 2)',
    task: H("Выведи `Hello` и `World` на двух строках.", "Print Hello and World on two lines.", "Hello ו-World בשתי שורות."),
    starterCode: 'print("Hello")\nprint("World")\n',
    checks: [{ expectedStdout: "Hello\nWorld" }],
  }),
  lesson({
    id: "py-02", track: "python", minutes: 14, editorLang: "python",
    title: H("2. Переменные", "2. Variables", "2. משתנים"),
    theory: theory(
      "**Переменная** — имя, привязанное к значению в памяти: `age = 17`. Слева имя, справа выражение. После присваивания имя можно использовать: `print(age + 1)`.\n\nИмена: буквы, цифры, `_`, без пробелов; не начинать с цифры. Регистр важен: `Age` и `age` — разные имена.\n\nПеременные можно переприсваивать: `x = 1` затем `x = x + 1` → в `x` будет `2`.",
      "A **variable** binds a name to a value: `age = 17`. Use the name in later expressions. Names are case-sensitive. Reassignment is allowed.",
      "משתנה שומר שם וערך. `age = 17`. שמות רגישים לרישיות."
    ),
    exampleCode: "a = 10\nb = 5\nprint(a + b)",
    task: H("Задай a=12, b=8 и выведи сумму 20.", "Set a=12, b=8 and print 20.", "a=12, b=8, הדפס 20."),
    starterCode: "a = 12\nb = 8\nprint(a + b)\n",
    checks: [{ expectedStdout: "20" }],
  }),
  lesson({
    id: "py-03", track: "python", minutes: 14, editorLang: "python",
    title: H("3. Типы данных", "3. Data types", "3. טיפוסים"),
    theory: theory(
      "У каждого значения есть **тип**. Частые: `int` (целые), `float` (дробные), `str` (строки), `bool` (`True` / `False`).\n\n`type(x)` показывает тип во время выполнения. Строку и число нельзя складывать `+` без преобразования: `str(42)` или f-строка `f\"n={n}\"`.\n\n`True` и `False` участвуют в условиях и циклах.",
      "Values have **types**: int, float, str, bool. `type(x)` inspects a value. Convert before mixing str and numbers.",
      "int, float, str, bool. `type(x)` לבדיקת טיפוס."
    ),
    exampleCode: "n = 42\nprint(type(n).__name__)",
    task: H("n=42 → выведи имя типа `int`.", "For n=42 print type name `int`.", "הדפס int."),
    starterCode: "n = 42\nprint(type(n).__name__)\n",
    checks: [{ expectedStdout: "int" }],
  }),
  lesson({
    id: "py-04", track: "python", minutes: 15, editorLang: "python",
    title: H("4. f-строки", "4. f-strings", "4. מחרוזות f"),
    theory: theory(
      "**f-строка** (formatted string): префикс `f` перед кавычками, выражения в `{ }`: `name = \"Ann\"; print(f\"Hi {name}\")`.\n\nВнутри `{}` можно писать любое выражение: `f\"{a*b}\"`, `f\"{len(items)} items\"`. Это читаемее, чем `\"Price: \" + str(p)`.\n\nДля фиксированного числа знаков после запятой позже пригодится `f\"{x:.2f}\"` — пока достаточно простых вставок.",
      "**f-strings** embed expressions in `{}`. Cleaner than concatenating str() everywhere.",
      "מחרוזות f עם `{ביטוי}` בתוך המחרוזת."
    ),
    exampleCode: 'hours = 5\nrate = 10\nprint(f"Total: {hours * rate}")',
    task: H("hours=5, rate=10 → строка `Total: 50`.", "Print `Total: 50`.", "Total: 50."),
    starterCode: "hours = 5\nrate = 10\nprint(f\"Total: {hours * rate}\")\n",
    checks: [{ expectedStdout: "Total: 50" }],
  }),
  lesson({
    id: "py-05", track: "python", minutes: 16, editorLang: "python",
    title: H("5. if / elif / else", "5. if / elif / else", "5. תנאים"),
    theory: theory(
      "**Ветвление** выбирает, какой блок выполнить. Синтаксис: `if условие:` → блок с отступом; опционально `elif` и `else`.\n\nВ Python отступ **4 пробела** (или один Tab) — часть синтаксиса. Операторы сравнения: `==`, `!=`, `<`, `>`, `<=`, `>=`. Логика: `and`, `or`, `not`.\n\nУсловие должно давать `bool`. Например `if score >= 60:` — порог сдачи.",
      "**Branches** with if/elif/else and indented blocks. Comparison: ==, !=, <, >. Combine with and/or/not.",
      "if/elif/else עם הזחה. אופרטורי השוואה."
    ),
    exampleCode: "score = 75\nif score >= 60:\n    print('pass')\nelse:\n    print('fail')",
    task: H("score=75 → `pass` если >=60, иначе `fail`.", "score=75 → pass if >=60.", "pass."),
    starterCode: "score = 75\nif score >= 60:\n    print('pass')\nelse:\n    print('fail')\n",
    checks: [{ expectedStdout: "pass" }],
  }),
  lesson({
    id: "py-06", track: "python", minutes: 16, editorLang: "python",
    title: H("6. Цикл for", "6. for loop", "6. לולאת for"),
    theory: theory(
      "`for переменная in последовательность:` выполняет тело цикла для каждого элемента.\n\n`range(n)` даёт 0..n-1. `range(1, 4)` → 1,2,3. `range(0, 10, 2)` — шаг 2.\n\nЦиклы используют для сумм, поиска в списке, отрисовки таблиц в консоли.",
      "`for x in seq:` iterates. `range(start, stop, step)` generates number sequences.",
      "for עם range לספירה וחזרות."
    ),
    exampleCode: "for i in range(1, 4):\n    print(i)",
    task: H("Выведи 1, 2, 3 — каждое с новой строки.", "Print 1, 2, 3 on separate lines.", "1\\n2\\n3."),
    starterCode: "for i in range(1, 4):\n    print(i)\n",
    checks: [{ expectedStdout: "1\n2\n3" }],
  }),
  lesson({
    id: "py-07", track: "python", minutes: 16, editorLang: "python",
    title: H("7. while", "7. while", "7. while"),
    theory: theory(
      "`while условие:` повторяет блок, пока условие истинно. Перед циклом инициализируй счётчик; **внутри** обязательно меняй данные, иначе цикл не закончится.\n\nПример: обратный отсчёт `n -= 1` до нуля. `break` выходит из цикла досрочно, `continue` пропускает оставшуюся часть итерации.",
      "`while cond:` loops until false. Update variables inside to avoid infinite loops. break/continue control flow.",
      "while עד שהתנאי שקר. עדכן משתנים בלולאה."
    ),
    exampleCode: "n = 3\nwhile n:\n    print(n)\n    n -= 1",
    task: H("Обратный отсчёт 5→1.", "Count down 5 to 1.", "5 עד 1."),
    starterCode: "n = 5\nwhile n >= 1:\n    print(n)\n    n -= 1\n",
    checks: [{ expectedStdout: "5\n4\n3\n2\n1" }],
  }),
  lesson({
    id: "py-08", track: "python", minutes: 16, editorLang: "python",
    title: H("8. Списки", "8. Lists", "8. רשימות"),
    theory: theory(
      "**Список** `[1, 2, 3]` — упорядоченная коллекция. Индексация с **0**: `a[0]` первый, `a[-1]` последний. Срез `a[1:3]` — элементы с индекса 1 до 2.\n\nМетоды: `append(x)`, `pop()`, `len(a)`. Функция `sum(a)` для чисел. Списки **изменяемые** (mutable).",
      "**Lists** are ordered, mutable sequences. Index from 0; slices `a[i:j]`. append, len, sum.",
      "רשימות בסדר, אינדקס מ-0, mutable."
    ),
    exampleCode: "nums = [1, 2, 3, 4]\nprint(sum(nums))",
    task: H("[1,2,3,4] → сумма 10.", "Sum list to 10.", "סכום 10."),
    starterCode: "nums = [1, 2, 3, 4]\nprint(sum(nums))\n",
    checks: [{ expectedStdout: "10" }],
  }),
  lesson({
    id: "py-09", track: "python", minutes: 16, editorLang: "python",
    title: H("9. Словари", "9. Dicts", "9. מילונים"),
    theory: theory(
      "**Словарь** `{ключ: значение}` — быстрый поиск по ключу (хеш-таблица). Ключи часто строки; значения — любой тип.\n\n`d[\"name\"]`, `d.get(\"name\", default)`, `d.keys()`, `d.values()`. Удобно для JSON-подобных данных, настроек, счётчиков.",
      "**Dicts** map keys to values. Access `d[key]` or `d.get(key, default)`.",
      "מילון: מפתח → ערך."
    ),
    exampleCode: 'd = {"a": 1, "b": 2}\nprint(d["a"] + d["b"])',
    task: H('{"a":1,"b":2} → выведи 3.', "Print sum of values: 3.", "3."),
    starterCode: 'd = {"a": 1, "b": 2}\nprint(d["a"] + d["b"])\n',
    checks: [{ expectedStdout: "3" }],
  }),
  lesson({
    id: "py-10", track: "python", minutes: 18, editorLang: "python",
    title: H("10. Функции", "10. Functions", "10. פונקציות"),
    theory: theory(
      "`def имя(параметры):` объявляет функцию. Тело с отступом. `return значение` отдаёт результат вызывающему коду.\n\nФункции убирают дублирование и дают имена идеям: `area(w,h)` вместо повторения формулы. Параметры — локальные имена; можно задавать значения по умолчанию `def f(x=0):`.",
      "`def name(params):` with `return`. Functions name behavior and avoid copy-paste.",
      "def, return, פרמטרים."
    ),
    exampleCode: "def double(n):\n    return n * 2\nprint(double(9))",
    task: H("Функция double(9) → 18.", "double(9) → 18.", "18."),
    starterCode: "def double(n):\n    return n * 2\nprint(double(9))\n",
    checks: [{ expectedStdout: "18" }],
  }),
  lesson({
    id: "py-11", track: "python", minutes: 16, editorLang: "python",
    title: H("11. Строки", "11. Strings", "11. מחרוזות"),
    theory: theory(
      "Строки — последовательности символов. **Неизменяемые**: методы возвращают **новую** строку.\n\n`.lower()`, `.upper()`, `.strip()` убирает пробелы по краям, `.split(',')` режет на список, `','.join(parts)` склеивает.\n\n`len(s)`, проверка подстроки `\"ab\" in s`.",
      "Strings are immutable. Methods like strip, split, join return new strings.",
      "מחרוזות immutable; split, join, strip."
    ),
    exampleCode: 's = "a,b,c"\nprint(len(s.split(",")))',
    task: H('"a,b,c".split → длина 3.', "split → length 3.", "אורך 3."),
    starterCode: 's = "a,b,c"\nprint(len(s.split(",")))\n',
    checks: [{ expectedStdout: "3" }],
  }),
  lesson({
    id: "py-12", track: "python", minutes: 18, editorLang: "python",
    title: H("12. try / except", "12. try / except", "12. try/except"),
    theory: theory(
      "Ошибки времени выполнения (деление на ноль, неверный `int('x')`) без обработки останавливают программу.\n\n`try:` — рискованный код; `except ТипОшибки:` — план Б. Лови **конкретные** исключения, не голый `except:` без нужды.\n\n`finally:` выполняется всегда (закрыть файл). Для обучения достаточно простого try/except.",
      "try/except handles runtime errors. Catch specific exceptions when possible.",
      "try/except לטיפול בשגיאות."
    ),
    exampleCode: "try:\n    print(int('42'))\nexcept ValueError:\n    print(0)",
    task: H("Безопасно: int('42') → 42.", "Print 42 from int('42').", "42."),
    starterCode: "try:\n    print(int('42'))\nexcept ValueError:\n    print(0)\n",
    checks: [{ expectedStdout: "42" }],
  }),
  lesson({
    id: "py-13", track: "python", minutes: 18, editorLang: "python",
    title: H("13. Мини-проект", "13. Mini project", "13. מיני-פרויקט"),
    theory: theory(
      "Собери **функцию + цикл + список**. Алгоритм: прочитай задачу → пример на бумаге → напиши функцию → проверь на маленьком входе → запусти автотест.\n\nДекомпозиция: большую задачу режь на маленькие функции с понятными именами.",
      "Combine functions, loops, lists. Decompose the problem into small named steps.",
      "שלב פונקציות, לולאות ורשימות."
    ),
    exampleCode: "def count_even(xs):\n    return sum(1 for x in xs if x % 2 == 0)\nprint(count_even([2,3,4,6]))",
    task: H("count_even([2,3,4,6]) → 3.", "count_even → 3.", "3."),
    starterCode:
      "def count_even(xs):\n    c = 0\n    for x in xs:\n        if x % 2 == 0:\n            c += 1\n    return c\nprint(count_even([2, 3, 4, 6]))\n",
    checks: [{ expectedStdout: "3" }],
  }),
  lesson({
    id: "py-14", track: "python", minutes: 16, editorLang: "python",
    title: H("14. Множества и кортежи", "14. Sets & tuples", "14. set ו-tuple"),
    theory: theory(
      "**Кортеж** `(1, 2)` — как список, но **неизменяемый**. Удобен для координат, записей из БД.\n\n**Множество** `{1, 2, 3}` — уникальные элементы, быстрая проверка `x in s`. Операции: объединение `|`, пересечение `&`.\n\n`set([1,1,2])` → `{1,2}`.",
      "**Tuples** are immutable sequences. **Sets** hold unique items; fast membership test.",
      "tuple לא משתנה; set לערכים ייחודיים."
    ),
    exampleCode: "t = (10, 20)\nprint(t[0] + t[1])",
    task: H("Кортеж (3, 7) → выведи 10.", "Tuple (3,7) → print 10.", "10."),
    starterCode: "t = (3, 7)\nprint(t[0] + t[1])\n",
    checks: [{ expectedStdout: "10" }],
  }),
  lesson({
    id: "py-15", track: "python", minutes: 20, editorLang: "python",
    title: H("15. Классы (ООП)", "15. Classes", "15. מחלקות"),
    theory: theory(
      "`class Имя:` описывает объект. `__init__(self, ...)` — конструктор; `self` — текущий экземпляр.\n\nМетоды — функции внутри класса. `obj = Point(3, 4)` создаёт объект. ООП группирует данные и поведение (игровой персонаж, пользователь, счётчик).",
      "`class` + `__init__(self)` define objects. Methods use `self` for instance state.",
      "class עם __init__ ו-self."
    ),
    exampleCode:
      "class Box:\n    def __init__(self, v):\n        self.v = v\n    def double(self):\n        return self.v * 2\nb = Box(5)\nprint(b.double())",
    task: H("Класс Counter со start=3, метод value() → 3.", "Counter with value() → 3.", "3."),
    starterCode:
      "class Counter:\n    def __init__(self, start):\n        self.start = start\n    def value(self):\n        return self.start\nprint(Counter(3).value())\n",
    checks: [{ expectedStdout: "3" }],
  }),
  lesson({
    id: "py-16", track: "python", minutes: 16, editorLang: "python",
    title: H("16. import и math", "16. import & math", "16. import"),
    theory: theory(
      "Стандартная библиотека Python огромна. `import math` подключает модуль; `math.sqrt(9)` → 3.0.\n\n`from math import pi` импортирует одно имя. Модули помогают не писать всё в одном файле.\n\nПозже: `import json`, `pathlib` — сейчас достаточно `math`.",
      "`import math` loads a module. Use `math.sqrt`, constants like `pi`.",
      "import math לפונקציות מוכנות."
    ),
    exampleCode: "import math\nprint(int(math.sqrt(16)))",
    task: H("import math → выведи 5 для sqrt(25).", "Print 5 for sqrt(25).", "5."),
    starterCode: "import math\nprint(int(math.sqrt(25)))\n",
    checks: [{ expectedStdout: "5" }],
  }),
  lesson({
    id: "py-17", track: "python", minutes: 18, editorLang: "python",
    title: H("17. Comprehensions", "17. Comprehensions", "17. comprehensions"),
    theory: theory(
      "**List comprehension**: `[x*2 for x in range(3)]` → `[0,2,4]`. Короткая запись цикла + списка.\n\nУсловие в конце: `[x for x in nums if x > 0]`. Читаемость важнее «магии» — если длинно, вернись к обычному `for`.",
      "List comprehensions build lists in one expression. Optional `if` filter at the end.",
      "list comprehension ביטוי קומפקטי."
    ),
    exampleCode: "print([n * n for n in range(1, 4)])",
    task: H("Список квадратов 1,4,9 как строка — выведи сумму 14.", "Squares 1,4,9 sum to 14.", "14."),
    starterCode: "squares = [n * n for n in range(1, 4)]\nprint(sum(squares))\n",
    checks: [{ expectedStdout: "14" }],
  }),
  ethics("py-18", "python", "python", 'print("learn")\nprint("build")\nprint("protect")\n', "learn\nbuild\nprotect"),
  exam(
    "py-exam",
    "python",
    "python",
    H("Экзамен Python", "Python exam", "מבחן Python"),
    H(
      "Напиши `avg(nums)` — среднее арифметическое. Выведи `avg([10, 20, 30])` → 20.",
      "Implement avg(nums). Print avg([10,20,30]) → 20.",
      "avg → 20."
    ),
    "def avg(nums):\n    if not nums:\n        return 0\n    return sum(nums) / len(nums)\nprint(int(avg([10, 20, 30])))\n",
    "20"
  ),
];

// ——— JAVA ———
function javaLesson(id, n, titleRu, titleEn, titleHe, ru, en, he, ex, taskRu, taskEn, taskHe, starter, expected, hint) {
  return lesson({
    id,
    track: "java",
    minutes: 16,
    editorLang: "java",
    title: H(`${n}. ${titleRu}`, `${n}. ${titleEn}`, `${n}. ${titleHe}`),
    theory: theory(ru, en, he),
    exampleCode: ex,
    task: H(taskRu, taskEn, taskHe),
    starterCode: starter,
    checks: [{ expectedStdout: expected, ...(hint ? { hint: H(hint, hint, hint) } : {}) }],
  });
}

const javaMain = (body) =>
  `public class Main {\n  public static void main(String[] args) {\n    ${body}\n  }\n}`;

const java = [
  javaLesson(
    "java-01", 1, "Hello, Java", "Hello, Java", "Hello, Java",
    "Каждый Java-файл — **класс**. Точка входа: `public static void main(String[] args)`. Вывод: `System.out.println(\"текст\");` — не забудь `;` в конце.\n\nИмя публичного класса должно совпадать с именем файла (`Main.java` → `class Main`).",
    "A Java file defines a **class**. Entry point: `public static void main`. Output: `System.out.println(...);` with semicolons.",
    "class Main עם main. System.out.println לפלט.",
    javaMain('System.out.println("Java");'),
    "Выведи строку Java", "Print Java", "הדפס Java",
    javaMain('System.out.println("Java");'),
    "Java\n"
  ),
  javaLesson(
    "java-02", 2, "Переменные", "Variables", "משתנים",
    "Типы: `int`, `double`, `boolean`, `String` (с большой S — класс). Объявление: `int a = 5;`. Переменные внутри `main` локальные.\n\nАрифметика как в математике; целочисленное деление `7/2` → 3.",
    "Declare types explicitly: int, double, boolean, String. Statements end with `;`.",
    "int, double, String עם ; בסוף.",
    javaMain("int a = 5;\n    int b = 7;\n    System.out.println(a + b);"),
    "Выведи 12", "Print 12", "12",
    javaMain("System.out.println(5 + 7);"),
    "12\n"
  ),
  javaLesson(
    "java-03", 3, "Условия if", "if statements", "if",
    "`if (условие) { ... } else { ... }`. Условие в скобках. Блоки в `{ }`. Сравнение: `==`, `!=`, `<`, `>`.\n\nДля строк используй `.equals()`, не `==`.",
    "if/else with braces. Use `.equals()` for String content comparison.",
    "if/else עם סוגריים מסולסלים.",
    javaMain('if (2 < 3) System.out.println("yes");'),
    "Выведи yes", "Print yes", "yes",
    javaMain('System.out.println("yes");'),
    "yes\n"
  ),
  javaLesson(
    "java-04", 4, "Цикл for", "for loop", "for",
    "Классика: `for (int i = 0; i < n; i++) { ... }`. Переменная `i` видна только в цикле.\n\n`i++` увеличивает на 1. Можно идти вниз: `i--`.",
    "for (init; condition; step) { } — classic counting loop.",
    "for עם i++.",
    javaMain("for (int i = 1; i <= 2; i++) System.out.println(i);"),
    "Строки 1 и 2", "Lines 1 and 2", "1 ו-2",
    javaMain("for (int i = 1; i <= 2; i++) System.out.println(i);"),
    "1\n2\n"
  ),
  javaLesson(
    "java-05", 5, "Цикл while", "while loop", "while",
    "`while (условие) { }` — проверка **до** входа в тело. Обновляй переменные внутри.\n\n`do { } while (условие)` — минимум одна итерация (позже).",
    "while (cond) { } — check before each iteration. Update state inside.",
    "while עם עדכון משתנה.",
    javaMain("int n = 2;\n    while (n > 0) {\n      System.out.println(n);\n      n--;\n    }"),
    "2 затем 1", "Print 2 then 1", "2 ואז 1",
    javaMain("int n = 2;\n    while (n > 0) {\n      System.out.println(n);\n      n--;\n    }"),
    "2\n1\n"
  ),
  javaLesson(
    "java-06", 6, "Методы", "Methods", "מתודות",
    "`static int mul(int a, int b) { return a * b; }` — метод в том же классе. `return` отдаёт значение.\n\nВызов из `main`: `System.out.println(mul(3, 4));`.",
    "static methods belong to the class. return sends a value back to the caller.",
    "static method עם return.",
    `public class Main {\n  static int mul(int a, int b) {\n    return a * b;\n  }\n  public static void main(String[] args) {\n    System.out.println(mul(3, 4));\n  }\n}`,
    "mul(3,4) → 12", "mul(3,4) → 12", "12",
    `public class Main {\n  static int mul(int a, int b) {\n    return a * b;\n  }\n  public static void main(String[] args) {\n    System.out.println(mul(3, 4));\n  }\n}`,
    "12\n"
  ),
  javaLesson(
    "java-07", 7, "Массивы", "Arrays", "מערכים",
    "`int[] a = {2, 3, 5};` — фиксированная длина. `a.length` (поле, не метод). Индекс с 0.\n\nПеребор: `for (int v : a) { sum += v; }` (for-each).",
    "Arrays: fixed size, index from 0, `.length` field. for-each: `for (int v : a)`.",
    "מערך עם length ואינדקס.",
    javaMain("int[] a = {2, 3};\n    System.out.println(a[0] + a[1]);"),
    "Сумма 2+3=5", "Sum to 5", "5",
    javaMain("int[] a = {2, 3};\n    System.out.println(a[0] + a[1]);"),
    "5\n"
  ),
  javaLesson(
    "java-08", 8, "Строки", "Strings", "מחרוזות",
    "`String s = \"abc\";` — неизменяемые. `s.length()`, `s.charAt(0)`, `s.substring(1)`.\n\nСклейка: `+` или `String.format`.",
    "String is immutable. length(), charAt(), substring(), concatenation with +.",
    "String immutable; length().",
    javaMain('String s = "abc";\n    System.out.println(s.length());'),
    "Длина abc → 3", "Length 3", "3",
    javaMain('String s = "abc";\n    System.out.println(s.length());'),
    "3\n"
  ),
  javaLesson(
    "java-09", 9, "Классы", "Classes", "מחלקות",
    "Поля и методы в одном классе. Пока всё `static` для простоты. Позже — объекты `new`.\n\nИнкапсуляция: private поля + public методы (в продвинутых уроках).",
    "Classes group fields and methods. static members belong to the class itself.",
    "מחלקה עם שדות ומתודות.",
    `public class Main {\n  static int twice(int x) {\n    return x * 2;\n  }\n  public static void main(String[] args) {\n    System.out.println(twice(5));\n  }\n}`,
    "twice(5) → 10", "twice(5) → 10", "10",
    `public class Main {\n  static int twice(int x) {\n    return x * 2;\n  }\n  public static void main(String[] args) {\n    System.out.println(twice(5));\n  }\n}`,
    "10\n"
  ),
  javaLesson(
    "java-10", 10, "Массив + цикл", "Arrays + loops", "מערך ולולאה",
    "Сумма элементов: цикл for или for-each. Это база для обработки данных, статистики, игровых инвентарей.",
    "Sum array elements with a loop — foundation for data processing.",
    "סכום מערך בלולאה.",
    javaMain("int[] a = {1, 2, 3};\n    int s = 0;\n    for (int v : a) s += v;\n    System.out.println(s);"),
    "Сумма 1+2+3=6", "Sum 6", "6",
    javaMain("int[] a = {1, 2, 3};\n    int s = 0;\n    for (int v : a) s += v;\n    System.out.println(s);"),
    "6\n"
  ),
  javaLesson(
    "java-11", 11, "switch", "switch", "switch",
    "`switch (x) { case 1: ... break; default: ... }` — выбор по дискретным значениям. `break` обязателен, иначе провалится в следующий case.\n\nС Java 14+ есть switch-expression — пока классический switch.",
    "switch selects by value; use break to avoid fall-through.",
    "switch עם case ו-break.",
    javaMain('int d = 2;\n    switch (d) {\n      case 2: System.out.println("two"); break;\n      default: System.out.println("other");\n    }'),
    "При d=2 выведи two", "Print two", "two",
    javaMain('int d = 2;\n    switch (d) {\n      case 2: System.out.println("two"); break;\n      default: System.out.println("other");\n    }'),
    "two\n"
  ),
  javaLesson(
    "java-12", 12, "try / catch", "try / catch", "try/catch",
    "`try { ... } catch (Exception e) { ... }` — перехват ошибок. `Integer.parseInt(\"42\")` может бросить `NumberFormatException`.\n\nНе показывай стек пользователю в проде — логируй и дай понятное сообщение.",
    "try/catch handles exceptions like bad parseInt input.",
    "try/catch לשגיאות.",
    javaMain('try {\n      System.out.println(Integer.parseInt("7"));\n    } catch (NumberFormatException e) {\n      System.out.println(0);\n    }'),
    "parseInt 7 → 7", "Print 7", "7",
    javaMain('System.out.println(Integer.parseInt("7"));'),
    "7\n"
  ),
  javaLesson(
    "java-13", 13, "Мини-проект", "Mini project", "מיני-פרויקט",
    "Метод `max3(a,b,c)` возвращает наибольшее из трёх. Сравни через if — без Math.max, чтобы закрепить условия.",
    "Write max3(a,b,c) using if — reinforces conditionals.",
    "max3 עם if.",
    `public class Main {\n  static int max3(int a, int b, int c) {\n    int m = a;\n    if (b > m) m = b;\n    if (c > m) m = c;\n    return m;\n  }\n  public static void main(String[] args) {\n    System.out.println(max3(1, 9, 4));\n  }\n}`,
    "max3(1,9,4) → 9", "max3 → 9", "9",
    `public class Main {\n  static int max3(int a, int b, int c) {\n    return a;\n  }\n  public static void main(String[] args) {\n    System.out.println(max3(1, 9, 4));\n  }\n}`,
    "9\n",
    "if (b > m) m = b;"
  ),
  ethics(
    "java-14",
    "java",
    "java",
    javaMain('System.out.println("learn");\n    System.out.println("build");\n    System.out.println("protect");'),
    "learn\nbuild\nprotect"
  ),
  exam(
    "java-exam",
    "java",
    "java",
    H("Экзамен Java", "Java exam", "מבחן Java"),
    H("Метод sum3(1,2,3) → 6.", "sum3(1,2,3) → 6.", "6."),
    `public class Main {\n  static int sum3(int a, int b, int c) {\n    return a + b + c;\n  }\n  public static void main(String[] args) {\n    System.out.println(sum3(1, 2, 3));\n  }\n}`,
    "6\n"
  ),
];

// ——— C++ ———
const cppWrap = (body) => `#include <iostream>\nusing namespace std;\nint main() {\n${body}\n  return 0;\n}`;

function cppLesson(id, n, titleRu, titleEn, titleHe, ru, en, he, code, expected, taskRu, taskEn, taskHe) {
  return lesson({
    id,
    track: "cpp",
    minutes: 16,
    editorLang: "cpp",
    title: H(`${n}. ${titleRu}`, `${n}. ${titleEn}`, `${n}. ${titleHe}`),
    theory: theory(ru, en, he),
    exampleCode: code,
    task: H(taskRu ?? "Выполни задание.", taskEn ?? "Complete the task.", taskHe ?? "השלם."),
    starterCode: code,
    checks: [{ expectedStdout: expected }],
  });
}

const cppFull = (src) => src;

const cpp = [
  cppLesson(
    "cpp-01", 1, "Hello", "Hello", "Hello",
    "`#include <iostream>` подключает потоки ввода-вывода. `using namespace std;` — чтобы писать `cout` без `std::`.\n\n`cout << \"текст\";` выводит. `<< endl` или `<< \"\\n\"` — перевод строки.",
    "iostream + cout << for output. endl or \\n for newline.",
    "cout להדפסה.",
    cppWrap('  cout << "Hi";'),
    "Hi"
  ),
  cppLesson(
    "cpp-02", 2, "Переменные", "Variables", "משתנים",
    "`int`, `double`, `char`, `bool`. Объявление `int a = 4;`. Для строк: `#include <string>` и `string s = \"ab\";`.",
    "Built-in types and string from <string>.",
    "int, double, string.",
    cppWrap("  int a = 4, b = 5;\n  cout << a + b;"),
    "9"
  ),
  cppLesson(
    "cpp-03", 3, "if / else", "if / else", "if",
    "Условия как в C: `if (x > 0) { } else { }`. Тернарный оператор: `cond ? a : b`.",
    "if/else and ternary operator.",
    "if/else.",
    cppWrap('  cout << (3 > 2 ? "ok" : "no");'),
    "ok"
  ),
  cppLesson(
    "cpp-04", 4, "for", "for", "for",
    "`for (int i = 1; i <= 3; i++)` — классический счётчик. Все три части в скобках.",
    "Classic for(init; cond; step) loop.",
    "לולאת for.",
    cppWrap('  for (int i = 1; i <= 3; i++)\n    cout << i << "\\n";'),
    "1\n2\n3"
  ),
  cppLesson(
    "cpp-05", 5, "while", "while", "while",
    "`while (cond) { }` — цикл с предусловием. Следи за изменением переменной цикла.",
    "while loop with precondition.",
    "while.",
    cppWrap("  int n = 2;\n  while (n) {\n    cout << n << \"\\n\";\n    n--;\n  }"),
    "2\n1"
  ),
  cppLesson(
    "cpp-06", 6, "Функции", "Functions", "פונקציות",
    "Функцию объявляют **до** `main` или вынеси прототип: `int add(int,int);`. Возврат через `return`.\n\nПараметры передаются по значению (копия) — для больших структур позже ссылки `&`.",
    "Define functions before main or use prototypes. return gives a value back.",
    "פונקציה לפני main.",
    cppFull(
      `#include <iostream>\nusing namespace std;\nint add(int a, int b) {\n  return a + b;\n}\nint main() {\n  cout << add(2, 3);\n  return 0;\n}`
    ),
    "5"
  ),
  cppLesson(
    "cpp-07", 7, "Массивы", "Arrays", "מערכים",
    "`int a[] = {1, 2, 3};` — размер из инициализатора. Индекс с 0. Длина не хранится в массиве — помни размер отдельно.",
    "C-style arrays, fixed size at compile time, index from 0.",
    "מערך C.",
    cppWrap("  int a[] = {1, 2, 3};\n  cout << a[0] + a[2];"),
    "4"
  ),
  cppLesson(
    "cpp-08", 8, "vector", "vector", "vector",
    "`#include <vector>` — динамический массив: `vector<int> v = {1, 2};`, `v.push_back(3)`, `v.size()`.",
    "std::vector grows dynamically; prefer over raw arrays in modern C++.",
    "vector דינמי.",
    cppFull(
      `#include <iostream>\n#include <vector>\nusing namespace std;\nint main() {\n  vector<int> v = {1, 2};\n  cout << v[0] + v[1];\n  return 0;\n}`
    ),
    "3"
  ),
  cppLesson(
    "cpp-09", 9, "Строки", "Strings", "מחרוזות",
    "`string` из `<string>`. `size()`, `+` для склейки, сравнение `==` для содержимого.",
    "std::string with size() and + concatenation.",
    "std::string.",
    cppFull(
      `#include <iostream>\n#include <string>\nusing namespace std;\nint main() {\n  string s = "ab";\n  cout << s.size();\n  return 0;\n}`
    ),
    "2"
  ),
  cppLesson(
    "cpp-10", 10, "Мини-проект", "Mini project", "מיני-פרויקט",
    "Функция `sq(x)` и вывод `sq(4)`. Свяжи объявление функции и main в одном файле.",
    "Function sq + main — single translation unit.",
    "פונקציה + main.",
    cppFull(
      `#include <iostream>\nusing namespace std;\nint sq(int x) {\n  return x * x;\n}\nint main() {\n  cout << sq(4);\n  return 0;\n}`
    ),
    "16"
  ),
  cppLesson(
    "cpp-11", 11, "struct", "struct", "struct",
    "`struct Point { int x, y; };` — группировка полей. `Point p{3, 4};` — агрегатная инициализация.",
    "struct groups related fields; aggregate initialization.",
    "struct לשדות.",
    cppFull(
      `#include <iostream>\nusing namespace std;\nstruct Point {\n  int x, y;\n};\nint main() {\n  Point p{3, 4};\n  cout << p.x + p.y;\n  return 0;\n}`
    ),
    "7"
  ),
  cppLesson(
    "cpp-12", 12, "Ввод cin", "Input cin", "cin",
    "`cin >> n` читает из stdin. В автопроверке ввод подставляет раннер — здесь достаточно вывести прочитанное значение + 1.\n\nДля строк: `cin >> word` читает до пробела.",
    "cin >> reads formatted input. In lessons we often simulate with fixed values.",
    "cin לקלט.",
    cppWrap("  int n = 5;\n  cout << n + 1;"),
    "6",
    "n=5 → выведи 6", "Print 6", "6"
  ),
  cppLesson(
    "cpp-13", 13, "Ссылки", "References", "הפניות",
    "`int& ref = x` — псевдоним переменной. В параметрах `void f(int& x)` меняет оригинал без копии.\n\nЗдесь: функция `inc(int& n) { n++; }`.",
    "References alias variables; `int&` for in-out parameters.",
    "int& כינוי.",
    cppFull(
      `#include <iostream>\nusing namespace std;\nvoid inc(int& n) {\n  n++;\n}\nint main() {\n  int v = 10;\n  inc(v);\n  cout << v;\n  return 0;\n}`
    ),
    "11"
  ),
  ethics(
    "cpp-14",
    "cpp",
    "cpp",
    cppWrap('  cout << "learn\\n";\n  cout << "build\\n";\n  cout << "protect";'),
    "learn\nbuild\nprotect"
  ),
  exam(
    "cpp-exam",
    "cpp",
    "cpp",
    H("Экзамен C++", "C++ exam", "מבחן C++"),
    H("Выведи число 42.", "Print 42.", "42."),
    cppWrap("  cout << 42;"),
    "42"
  ),
];

// ——— C# ———
const csWrap = (body) => `using System;\nclass Program {\n  static void Main() {\n    ${body}\n  }\n}`;

function csLesson(id, n, titleRu, titleEn, titleHe, ru, en, he, code, expected, taskRu, taskEn, taskHe) {
  return lesson({
    id,
    track: "csharp",
    minutes: 16,
    editorLang: "csharp",
    title: H(`${n}. ${titleRu}`, `${n}. ${titleEn}`, `${n}. ${titleHe}`),
    theory: theory(ru, en, he),
    exampleCode: code,
    task: H(taskRu ?? "Выполни задание.", taskEn ?? "Do the task.", taskHe ?? "בצע."),
    starterCode: code,
    checks: [{ expectedStdout: expected }],
  });
}

const csharp = [
  csLesson(
    "cs-01", 1, "Hello", "Hello", "Hello",
    "C# — язык .NET. `Console.WriteLine(\"text\");` печатает строку. Каждый файл — класс с `static void Main()`.\n\nПроект собирается `dotnet run` (в лаунчере это уже настроено).",
    "Console.WriteLine for output. Entry: static void Main inside a class.",
    "Console.WriteLine.",
    csWrap('Console.WriteLine("C#");'),
    "C#\n"
  ),
  csLesson(
    "cs-02", 2, "Переменные", "Variables", "משתנים",
    "`int`, `double`, `string`, `bool`. `var x = 3` — вывод типа компилятором. Строки в двойных кавычках.",
    "Types and var for inferred locals.",
    "int, string, var.",
    csWrap("Console.WriteLine(3 + 4);"),
    "7\n"
  ),
  csLesson(
    "cs-03", 3, "if / else", "if / else", "if",
    "Как Java/C++: `if (cond) { } else { }`. Условие в скобках.",
    "if/else blocks.",
    "if/else.",
    csWrap('Console.WriteLine("ok");'),
    "ok\n"
  ),
  csLesson(
    "cs-04", 4, "for", "for", "for",
    "`for (int i = 1; i <= 2; i++) Console.WriteLine(i);`",
    "Classic for loop.",
    "for.",
    csWrap("for (int i = 1; i <= 2; i++) Console.WriteLine(i);"),
    "1\n2\n"
  ),
  csLesson(
    "cs-05", 5, "while", "while", "while",
    "while с декрементом счётчика — тот же паттерн, что в Python/Java.",
    "while countdown pattern.",
    "while.",
    csWrap("int n = 2;\n    while (n > 0) { Console.WriteLine(n); n--; }"),
    "2\n1\n"
  ),
  csLesson(
    "cs-06", 6, "Методы", "Methods", "מתודות",
    "`static int Add(int a, int b) => a + b;` или с телом `{ return a+b; }`. Методы живут в классе `Program`.",
    "static methods in Program class.",
    "static method.",
    `using System;\nclass Program {\n  static int Add(int a, int b) { return a + b; }\n  static void Main() { Console.WriteLine(Add(2, 3)); }\n}`,
    "5\n"
  ),
  csLesson(
    "cs-07", 7, "Массивы", "Arrays", "מערכים",
    "`int[] a = {1, 2, 3};` — `a.Length` (с большой L). Индекс с 0.",
    "Arrays with Length property.",
    "מערך עם Length.",
    csWrap("Console.WriteLine(new int[] { 1, 2, 3 }.Length);"),
    "3\n"
  ),
  csLesson(
    "cs-08", 8, "List<T>", "List<T>", "List",
    "`using System.Collections.Generic;` → `List<int> xs = new List<int> { 1, 2 };` — динамический список, `Add`, `Count`.",
    "List<int> dynamic collection; Count, Add.",
    "List<int>.",
    `using System;\nusing System.Collections.Generic;\nclass Program {\n  static void Main() {\n    var xs = new List<int> { 1, 2, 3 };\n    Console.WriteLine(xs.Count);\n  }\n}`,
    "3\n"
  ),
  csLesson(
    "cs-09", 9, "Классы", "Classes", "מחלקות",
    "`class User { public int Id; public string Name; }` — поля и методы. `new User()` создаёт объект.",
    "class with fields; new for instances.",
    "class ו-new.",
    `using System;\nclass Box {\n  public int V;\n  public int Twice() => V * 2;\n}\nclass Program {\n  static void Main() {\n    var b = new Box { V = 5 };\n    Console.WriteLine(b.Twice());\n  }\n}`,
    "10\n"
  ),
  csLesson(
    "cs-10", 10, "foreach", "foreach", "foreach",
    "`foreach (var x in arr) { }` — перебор коллекций без индекса.",
    "foreach iterates any IEnumerable.",
    "foreach.",
    `using System;\nclass Program {\n  static void Main() {\n    int s = 0;\n    foreach (var x in new[] { 2, 3, 4 }) s += x;\n    Console.WriteLine(s);\n  }\n}`,
    "9\n"
  ),
  csLesson(
    "cs-11", 11, "try / catch", "try / catch", "try/catch",
    "`try { } catch (Exception ex) { }` — обработка ошибок. `int.Parse(\"12\")` при ошибке бросает.",
    "try/catch for parse and IO errors.",
    "try/catch.",
    csWrap('Console.WriteLine(int.Parse("12"));'),
    "12\n"
  ),
  csLesson(
    "cs-12", 12, "Мини-проект", "Mini project", "מיני-פרויקט",
    "Метод `Max(int a, int b)` и вывод для `Max(7, 3)` → 7.",
    "Max method with if.",
    "Max.",
    `using System;\nclass Program {\n  static int Max(int a, int b) => a > b ? a : b;\n  static void Main() { Console.WriteLine(Max(7, 3)); }\n}`,
    "7\n"
  ),
  csLesson(
    "cs-13", 13, "Строки", "Strings", "מחרוזות",
    "`string` immutable. `s.Length`, `s.ToUpper()`, интерполяция `$\"Hi {name}\"`.",
    "string interpolation and ToUpper.",
    "מחרוזות עם $.",
    csWrap('var name = "vexx";\n    Console.WriteLine($"hi {name}");'),
    "hi vexx\n"
  ),
  ethics(
    "cs-14",
    "csharp",
    "csharp",
    csWrap('Console.WriteLine("learn");\n    Console.WriteLine("build");\n    Console.WriteLine("protect");'),
    "learn\nbuild\nprotect"
  ),
  exam(
    "cs-exam",
    "csharp",
    "csharp",
    H("Экзамен C#", "C# exam", "מבחן C#"),
    H("Выведи сумму 1+2+3 → 6.", "Print 1+2+3 → 6.", "6."),
    csWrap("Console.WriteLine(1 + 2 + 3);"),
    "6\n"
  ),
];

writeFileSync(join(OUT, "python.json"), JSON.stringify(python, null, 2));
writeFileSync(join(OUT, "java.json"), JSON.stringify(java, null, 2));
writeFileSync(join(OUT, "cpp.json"), JSON.stringify(cpp, null, 2));
writeFileSync(join(OUT, "csharp.json"), JSON.stringify(csharp, null, 2));

const coursesVersion = Number(
  `${new Date().getFullYear()}${String(new Date().getMonth() + 1).padStart(2, "0")}${String(
    new Date().getDate()
  ).padStart(2, "0")}${String(python.length + java.length).padStart(3, "0")}`
);
writeFileSync(
  join(OUT, "bundle-manifest.json"),
  JSON.stringify(
    {
      coursesVersion,
      generatedAt: new Date().toISOString(),
      counts: { python: python.length, java: java.length, cpp: cpp.length, csharp: csharp.length },
    },
    null,
    2
  )
);
console.log("OK", { python: python.length, java: java.length, cpp: cpp.length, csharp: csharp.length, coursesVersion });
