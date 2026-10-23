/**
 * Advanced security & defense arc — insert before ethics/exam in each track.
 * Educational: validation, hashing, rate limits, DDoS mitigation concepts, logging.
 */

export function securityTheory(ru, en, he) {
  const tailRu =
    "\n\n### Практика защиты\n- Валидация на **входе**, не доверяй пользователю и сети.\n- Секреты не в коде — env / vault.\n- Логируй отказы и аномалии, не пароли.\n- **DDoS** и флуды лечатся лимитами, кэшем, CDN, масштабированием — не «одним if».\n\n### Как сдавать\nТочный вывод → **Проверить**. Несколько тестов = все должны пройти.";
  const tailEn =
    "\n\n### Defense practice\nValidate input. No secrets in source. Log denials, not passwords. **DDoS** needs rate limits, caching, CDN, scale.\n\n### Pass\nExact stdout; every check must pass.";
  const tailHe =
    "\n\n### הגנה\nאימות קלט. בלי סודות בקוד. לוג לדחיות.\n\n### מעבר\nפלט מדויק.";
  return {
    ru: `## Подробно\n\n${ru}${tailRu}\n\n## Задание\n\nРеализуй по теории → **Запустить** → **Проверить**.`,
    en: `## In depth\n\n${en}${tailEn}\n\n## Task\n\nImplement → **Run** → **Check**.`,
    he: `## לעומק\n\n${he}${tailHe}\n\n## משימה\n\nמימוש → הרץ → בדוק.`,
  };
}

export function buildPythonSecurity(lesson, project, H) {
  const T = (ru, en, he) => securityTheory(ru, en, he);
  return [
    lesson({
      id: "py-19",
      track: "python",
      minutes: 30,
      editorLang: "python",
      title: H("19. Валидация ввода", "19. Input validation", "19. אימות קלט"),
      theory: T(
        "**OWASP:** не доверяй данным с клиента. Проверяй тип, длину, диапазон.\n\n`strip()` убирает пробелы. `isdigit()` для целых строк. При ошибке возвращай код/None, не падай с traceback пользователю.\n\nЭто база против инъекций и крашей API.",
        "Validate length, type, range on every external input. strip(), isdigit(). Fail closed with safe defaults.",
        "אימות אורך וטיפוס בכל קלט חיצוני."
      ),
      exampleCode:
        'def safe_pos_int(s):\n    s = s.strip()\n    if not s.isdigit():\n        return -1\n    return int(s)\nprint(safe_pos_int(" 42 "))',
      task: H(
        "Функция `safe_pos_int`: для `\" 7 \"` → 7, для `\"x\"` → -1. Выведи оба результата на двух строках.",
        "safe_pos_int: \" 7 \" → 7, \"x\" → -1. Print both lines.",
        "7 ואז -1 בשורות נפרדות."
      ),
      starterCode:
        'def safe_pos_int(s):\n    s = s.strip()\n    if not s.isdigit():\n        return -1\n    return int(s)\nprint(safe_pos_int(" 7 "))\nprint(safe_pos_int("x"))\n',
      checks: [{ expectedStdout: "7\n-1" }],
    }),
    lesson({
      id: "py-20",
      track: "python",
      minutes: 32,
      editorLang: "python",
      title: H("20. SQL-инъекции (защита)", "20. SQL injection defense", "20. הגנה מ-SQLi"),
      theory: T(
        "Конкатенация `\"SELECT * FROM u WHERE id=\" + user` — **опасна**: `1 OR 1=1` ломает логику.\n\n**Параметризованные запросы:** плейсхолдер `?` и кортеж значений — СУБД отделяет код от данных.\n\nВ уроке смоделируй `build_query(table, col, val)` → строка с **экранированием** кавычек в `val` (учебный вариант; в проде только параметры).",
        "Never build SQL with raw user strings. Use placeholders. Here: escape quotes in a teaching helper.",
        "לא לחבר SQL עם קלט גולמי. placeholders."
      ),
      exampleCode:
        'def esc(s):\n    return s.replace("\\\\", "\\\\\\\\").replace("\'", "\\\\\'")\ndef build_query(val):\n    return "SELECT id FROM users WHERE name=\'" + esc(val) + "\'"\nprint(build_query("O\'Brien"))',
      task: H(
        "`build_query(\"admin\")` должно содержать `name='admin'`. Выведи эту строку.",
        "Print build_query(\"admin\").",
        "הדפס build_query."
      ),
      starterCode:
        'def esc(s):\n    return s.replace("\\\\", "\\\\\\\\").replace("\'", "\\\\\'")\ndef build_query(val):\n    return "SELECT id FROM users WHERE name=\'" + esc(val) + "\'"\nprint(build_query("admin"))\n',
      checks: [{ expectedStdout: "SELECT id FROM users WHERE name='admin'" }],
    }),
    lesson({
      id: "py-21",
      track: "python",
      minutes: 28,
      editorLang: "python",
      title: H("21. Хеш паролей", "21. Password hashing", "21. גיבוב סיסמאות"),
      theory: T(
        "Пароли **никогда** не хранят в открытом виде. `hashlib.sha256` даёт отпечаток; в проде — **bcrypt/argon2** с солью.\n\nЗдесь: `sha256(password.encode()).hexdigest()[:8]` для короткого отпечатка в консоли.\n\nОдинаковый пароль → одинаковый хеш (без соли — только для обучения).",
        "Store password hashes, not plaintext. sha256 demo; production uses salted slow hashes.",
        "גיבוב, לא טקסט גלוי."
      ),
      exampleCode: 'import hashlib\nprint(hashlib.sha256(b"vexx").hexdigest()[:8])',
      task: H("Выведи первые 8 hex символов sha256 от `vexx`.", "Print first 8 hex chars of sha256(\"vexx\").", "bfabb5f9"),
      starterCode: 'import hashlib\nprint(hashlib.sha256(b"vexx").hexdigest()[:8])\n',
      checks: [{ expectedStdout: "bfabb5f9" }],
    }),
    lesson({
      id: "py-22",
      track: "python",
      minutes: 30,
      editorLang: "python",
      title: H("22. Сравнение секретов", "22. Secret comparison", "22. השוואת סודות"),
      theory: T(
        "Сравнение `==` для токенов может дать **timing attack** (по времени ответа угадывают байты).\n\n`hmac.compare_digest(a, b)` сравнивает за постоянное время (для строк одинаковой длины).\n\nВсегда сравнивай хеши, не сырые пароли.",
        "Use hmac.compare_digest for secrets. Compare hashes in auth flows.",
        "compare_digest לסודות."
      ),
      exampleCode:
        'import hmac\na = "token123"\nb = "token123"\nprint(1 if hmac.compare_digest(a, b) else 0)',
      task: H("Сравни `secret` и `secret` через compare_digest → выведи 1.", "compare_digest equal secrets → 1.", "1"),
      starterCode:
        'import hmac\nprint(1 if hmac.compare_digest("secret", "secret") else 0)\n',
      checks: [{ expectedStdout: "1" }],
    }),
    lesson({
      id: "py-23",
      track: "python",
      minutes: 35,
      editorLang: "python",
      title: H("23. Rate limit", "23. Rate limiting", "23. הגבלת קצב"),
      theory: T(
        "**Rate limit** — N запросов с одного IP за окно времени. Защита от брутфорса пароля и от **application-layer flood**.\n\nСчётчик в словаре: `counts[ip] += 1`. Если `> limit` → отказ.\n\nВ проде: Redis + sliding window, nginx `limit_req`.",
        "Per-IP counters cap request rate. Foundation of brute-force and abuse defense.",
        "מונה לכל IP."
      ),
      exampleCode:
        'def hit(counts, ip, limit=3):\n    counts[ip] = counts.get(ip, 0) + 1\n    return counts[ip] <= limit\nc = {}\nfor _ in range(4):\n    print(1 if hit(c, "10.0.0.1") else 0)',
      task: H("4 запроса с лимитом 3 → выведи 1,1,1,0 (по строке).", "Four hits limit 3 → 1,1,1,0.", "1,1,1,0"),
      starterCode:
        'def hit(counts, ip, limit=3):\n    counts[ip] = counts.get(ip, 0) + 1\n    return counts[ip] <= limit\nc = {}\nfor _ in range(4):\n    print(1 if hit(c, "10.0.0.1") else 0)\n',
      checks: [{ expectedStdout: "1\n1\n1\n0" }],
    }),
    lesson({
      id: "py-24",
      track: "python",
      minutes: 40,
      editorLang: "python",
      title: H("24. DDoS: типы и защита", "24. DDoS types & mitigation", "24. DDoS והגנה"),
      theory: T(
        "**DDoS** — перегрузка сервиса трафиком с многих источников.\n\n- **Volumetric** (UDP/ICMP flood) — забить канал.\n- **Protocol** (SYN flood) — исчерпать таблицы соединений.\n- **Application** (HTTP flood) — дорогие запросы к API.\n\n**Защита:** anycast/CDN (Cloudflare, Akamai), rate limit, WAF, autoscale, капча на логин, blackhole у провайдера. **Легально:** нагрузочное тестирование **только** свои системы по контракту.\n\nЗадача: симулятор — 10 «запросов», лимит 4/сек → сколько **пропущено**?",
        "DDoS layers: volumetric, protocol, application. Mitigate with CDN, rate limits, WAF. Task: count allowed requests in a simulation.",
        "שכבות DDoS והגנה. ספור בקשות שעברו."
      ),
      exampleCode:
        'LIMIT = 4\nallowed = 0\nfor i in range(10):\n    if i < LIMIT:\n        allowed += 1\nprint(allowed)',
      task: H("10 запросов, пропускаем только первые 4 → выведи 4.", "10 requests, allow first 4 → print 4.", "4"),
      starterCode:
        'LIMIT = 4\nallowed = 0\nfor i in range(10):\n    if i < LIMIT:\n        allowed += 1\nprint(allowed)\n',
      checks: [{ expectedStdout: "4" }],
    }),
    lesson({
      id: "py-25",
      track: "python",
      minutes: 32,
      editorLang: "python",
      title: H("25. Логи и SOC", "25. Logs & SOC", "25. לוגים ו-SOC"),
      theory: T(
        "Безопасность = **наблюдаемость**. Лог: время, IP, действие, результат.\n\nФормат `LEVEL|ip|event`. SOC ищет паттерны: много `FAIL_LOGIN`, скан портов.\n\nЗадача: посчитай строки с `FAIL` в списке.",
        "Structured logs enable detection. Count FAIL events in a list.",
        "ספור אירועי FAIL."
      ),
      exampleCode:
        'logs = ["INFO|1.1.1.1|ok", "FAIL|2.2.2.2|login", "FAIL|2.2.2.2|login"]\nprint(sum(1 for L in logs if L.startswith("FAIL")))',
      task: H("В списке 3 лога (2 FAIL) → выведи 2.", "Two FAIL lines → print 2.", "2"),
      starterCode:
        'logs = ["INFO|1.1.1.1|ok", "FAIL|2.2.2.2|login", "FAIL|2.2.2.2|login"]\nprint(sum(1 for L in logs if "FAIL" in L.split("|")[0]))\n',
      checks: [{ expectedStdout: "2" }],
    }),
    lesson({
      id: "py-26",
      track: "python",
      minutes: 28,
      editorLang: "python",
      title: H("26. XSS (экранирование)", "26. XSS escaping", "26. XSS"),
      theory: T(
        "**XSS** — внедрение HTML/JS в страницу. Защита: экранировать `<`, `>`, `&`, `\"` при выводе в HTML.\n\n`replace` для учебника; в вебе — шаблонизатор + CSP заголовки.\n\n`escape_html(\"<script>\")` → безопасный текст.",
        "Escape HTML metacharacters to mitigate XSS when rendering user content.",
        "בריחה מ-HTML."
      ),
      exampleCode:
        'def escape_html(s):\n    return s.replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;")\nprint(escape_html("<b>"))',
      task: H("escape_html(\"<b>\") → `&lt;b&gt;`. Выведи.", "Print escaped <b>.", "&lt;b&gt;"),
      starterCode:
        'def escape_html(s):\n    return s.replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;")\nprint(escape_html("<b>"))\n',
      checks: [{ expectedStdout: "&lt;b&gt;" }],
    }),
    project({
      id: "py-proj-sec",
      track: "python",
      minutes: 45,
      editorLang: "python",
      title: H("Проект: мини-авторизация", "Project: mini auth", "פרויקט: auth"),
      theoryRu:
        "Собери: хеш пароля, 3 попытки логина, на 4-й — `LOCKED`. Пароль `vexx`, попытки `wrong`×3 + `vexx` не успеет — выведи итоговый статус.",
      theoryEn: "Hash password, 3 tries, 4th prints LOCKED.",
      theoryHe: "3 ניסיונות ואז LOCKED.",
      exampleCode:
        'import hashlib\ndef h(p):\n    return hashlib.sha256(p.encode()).hexdigest()[:8]\nHP = h("vexx")\ntries = ["wrong", "wrong", "wrong", "vexx"]\nfor i, p in enumerate(tries):\n    if i >= 3:\n        print("LOCKED")\n        break\n    if h(p) == HP:\n        print("OK")\n        break\nelse:\n    print("FAIL")',
      task: H(
        "3 неверных пароля подряд → на 4-й итерации выведи только `LOCKED`.",
        "After 3 wrong passwords print LOCKED on 4th check.",
        "LOCKED"
      ),
      starterCode:
        'import hashlib\ndef h(p):\n    return hashlib.sha256(p.encode()).hexdigest()[:8]\nHP = h("vexx")\ntries = ["wrong", "wrong", "wrong", "vexx"]\nfor i, p in enumerate(tries):\n    if i >= 3:\n        print("LOCKED")\n        break\n    if h(p) == HP:\n        print("OK")\n        break\n',
      checks: [{ expectedStdout: "LOCKED" }],
    }),
    lesson({
      id: "py-27",
      track: "python",
      minutes: 38,
      editorLang: "python",
      title: H("27. Сеть: IP и порты", "27. Network: IP & ports", "27. רשת"),
      theory: T(
        "IPv4 — 4 октета 0–255. **Порт** — номер службы (80 HTTP, 443 HTTPS, 22 SSH).\n\nСканирование чужих сетей без разрешения — **незаконно**. Учим **валидацию** октета.\n\n`valid_octet(s)` → True если 0–255.",
        "Validate IP octets. Port numbers identify services. Scan only with permission.",
        "אימות octet."
      ),
      exampleCode:
        'def valid_octet(s):\n    if not s.isdigit():\n        return False\n    n = int(s)\n    return 0 <= n <= 255\nprint(1 if valid_octet("255") else 0)\nprint(1 if valid_octet("999") else 0)',
      task: H("255 → 1, 999 → 0 на двух строках.", "255→1, 999→0.", "1\n0"),
      starterCode:
        'def valid_octet(s):\n    if not s.isdigit():\n        return False\n    n = int(s)\n    return 0 <= n <= 255\nprint(1 if valid_octet("255") else 0)\nprint(1 if valid_octet("999") else 0)\n',
      checks: [{ expectedStdout: "1\n0" }],
    }),
    lesson({
      id: "py-28",
      track: "python",
      minutes: 42,
      editorLang: "python",
      title: H("28. CAPTCHA и боты", "28. Bots & CAPTCHA", "28. בוטים"),
      theory: T(
        "Боты автоматизируют flood логина и парсинг. **CAPTCHA**, device fingerprint, поведенческий анализ.\n\nКод: если `user_agent` содержит `bot` (нижний регистр) → отклонить.",
        "Detect naive bots via user-agent substring. Real systems use layered signals.",
        "זיהוי bot ב-user-agent."
      ),
      exampleCode:
        'def allow_request(ua):\n    return "bot" not in ua.lower()\nprint(1 if allow_request("Mozilla/5.0") else 0)\nprint(1 if allow_request("Googlebot/2.1") else 0)',
      task: H("Mozilla → 1, Googlebot → 0.", "Browser OK, bot blocked.", "1\n0"),
      starterCode:
        'def allow_request(ua):\n    return "bot" not in ua.lower()\nprint(1 if allow_request("Mozilla/5.0") else 0)\nprint(1 if allow_request("Googlebot/2.1") else 0)\n',
      checks: [{ expectedStdout: "1\n0" }],
    }),
    project({
      id: "py-proj-blue",
      track: "python",
      minutes: 50,
      editorLang: "python",
      title: H("Проект: разбор атаки", "Project: attack triage", "פרויקט: תחקיר"),
      theoryRu:
        "Дан лог запросов. Посчитай: всего запросов, сколько с IP `6.6.6.6`, сколько отклонено (`DENY`). Выведи три числа на трёх строках: 5, 3, 2.",
      theoryEn: "Count total, count from 6.6.6.6, count DENY — three lines.",
      theoryHe: "5, 3, 2 בשורות.",
      exampleCode:
        'rows = ["OK|1.1.1.1", "DENY|6.6.6.6", "OK|6.6.6.6", "DENY|6.6.6.6", "OK|6.6.6.6"]\nprint(len(rows))\nprint(sum(1 for r in rows if r.endswith("6.6.6.6")))\nprint(sum(1 for r in rows if r.startswith("DENY")))',
      task: H("Выведи 5, 3, 2 на трёх строках.", "Print 5, 3, 2.", "5\n3\n2"),
      starterCode:
        'rows = ["OK|1.1.1.1", "DENY|6.6.6.6", "OK|6.6.6.6", "DENY|6.6.6.6", "OK|6.6.6.6"]\nprint(len(rows))\nprint(sum(1 for r in rows if r.endswith("6.6.6.6")))\nprint(sum(1 for r in rows if r.startswith("DENY")))\n',
      checks: [{ expectedStdout: "5\n3\n2" }],
    }),
  ];
}

export function buildJavaSecurity(javaLesson, project, javaMain, H) {
  return [
    javaLesson(
      "java-sec-01",
      "S1",
      "Валидация",
      "Validation",
      "אימות",
      "Проверяй `Integer.parseInt` в try/catch. Пустая строка → -1.",
      "Parse with try/catch; empty → -1.",
      "try/catch.",
      javaMain('try {\n      System.out.println(Integer.parseInt("42"));\n    } catch (Exception e) {\n      System.out.println(-1);\n    }'),
      "parse 42",
      "42",
      javaMain('try {\n      System.out.println(Integer.parseInt("42"));\n    } catch (Exception e) {\n      System.out.println(-1);\n    }'),
      "42\n"
    ),
    javaLesson(
      "java-sec-02",
      "S2",
      "Rate limit",
      "Rate limit",
      "Rate limit",
      "HashMap счётчик IP. Лимит 2 → третий запрос 0.",
      "HashMap rate counter.",
      "מונה.",
      `public class Main {\n  public static void main(String[] args) {\n    java.util.HashMap<String, Integer> c = new java.util.HashMap<>();\n    String ip = "10.0.0.1";\n    for (int i = 0; i < 3; i++) {\n      int n = c.getOrDefault(ip, 0) + 1;\n      c.put(ip, n);\n      System.out.println(n <= 2 ? 1 : 0);\n    }\n  }\n}`,
      "1,1,0",
      "1,1,0",
      `public class Main {\n  public static void main(String[] args) {\n    java.util.HashMap<String, Integer> c = new java.util.HashMap<>();\n    String ip = "10.0.0.1";\n    for (int i = 0; i < 3; i++) {\n      int n = c.getOrDefault(ip, 0) + 1;\n      c.put(ip, n);\n      System.out.println(n <= 2 ? 1 : 0);\n    }\n  }\n}`,
      "1\n1\n0\n"
    ),
    javaLesson(
      "java-sec-03",
      "S3",
      "DDoS защита",
      "DDoS mitigation",
      "DDoS",
      "Volumetric/protocol/app floods. CDN + rate limit. Симуляция: allow 3 of 7.",
      "Allow 3 of 7 requests.",
      "3 מ-7.",
      javaMain("int allow = 0;\n    for (int i = 0; i < 7; i++) {\n      if (i < 3) allow++;\n    }\n    System.out.println(allow);"),
      "3",
      "3",
      javaMain("int allow = 0;\n    for (int i = 0; i < 7; i++) {\n      if (i < 3) allow++;\n    }\n    System.out.println(allow);"),
      "3\n"
    ),
    javaLesson(
      "java-sec-04",
      "S4",
      "Логи FAIL",
      "FAIL logs",
      "לוגים",
      "Подсчёт FAIL в массиве строк.",
      "Count FAIL prefix.",
      "ספור FAIL.",
      javaMain('String[] L = {"FAIL|a", "OK|b", "FAIL|c"};\n    int n = 0;\n    for (String s : L) if (s.startsWith("FAIL")) n++;\n    System.out.println(n);'),
      "2",
      "2",
      javaMain('String[] L = {"FAIL|a", "OK|b", "FAIL|c"};\n    int n = 0;\n    for (String s : L) if (s.startsWith("FAIL")) n++;\n    System.out.println(n);'),
      "2\n"
    ),
    project({
      id: "java-proj-sec",
      track: "java",
      editorLang: "java",
      minutes: 45,
      title: H("Проект: max3 + валидация", "Project: validated max3", "פרויקט"),
      theoryRu: "max3 только для чисел 0..100. Иначе -1. max3(50,90,30)→90.",
      theoryEn: "Clamp input range then max3.",
      theoryHe: "90.",
      exampleCode: `public class Main {\n  static int max3(int a, int b, int c) {\n    if (a < 0 || a > 100 || b < 0 || b > 100 || c < 0 || c > 100) return -1;\n    int m = a;\n    if (b > m) m = b;\n    if (c > m) m = c;\n    return m;\n  }\n  public static void main(String[] args) {\n    System.out.println(max3(50, 90, 30));\n  }\n}`,
      task: H("max3(50,90,30) → 90.", "→ 90.", "90."),
      starterCode: `public class Main {\n  static int max3(int a, int b, int c) {\n    if (a < 0 || a > 100 || b < 0 || b > 100 || c < 0 || c > 100) return -1;\n    int m = a;\n    if (b > m) m = b;\n    if (c > m) m = c;\n    return m;\n  }\n  public static void main(String[] args) {\n    System.out.println(max3(50, 90, 30));\n  }\n}\n`,
      checks: [{ expectedStdout: "90\n" }],
    }),
  ];
}

export function buildCppSecurity(cppLesson, project, cppWrap, H) {
  return [
    cppLesson(
      "cpp-sec-01",
      "S1",
      "Валидация cin",
      "cin validation",
      "cin",
      "Проверяй диапазон после чтения. n=150 → reject 0.",
      "Range check after read.",
      "טווח.",
      cppWrap("int n = 150;\n  if (n < 0 || n > 100) cout << 0;\n  else cout << n;"),
      "0\n",
      "150 → 0",
      "150 → 0",
      "150 → 0"
    ),
    cppLesson(
      "cpp-sec-02",
      "S2",
      "Rate limit",
      "Rate limit",
      "Rate",
      "Счётчик запросов, лимит 2.",
      "Counter limit 2.",
      "2.",
      cppWrap("int c = 0;\n  for (int i = 0; i < 3; i++) {\n    c++;\n    cout << (c <= 2 ? 1 : 0) << endl;\n  }"),
      "1\n1\n0\n",
      "1,1,0",
      "1,1,0",
      "1,1,0"
    ),
    cppLesson(
      "cpp-sec-03",
      "S3",
      "DDoS симуляция",
      "DDoS sim",
      "DDoS",
      "Пропусти 4 из 10 запросов.",
      "Allow 4/10.",
      "4.",
      cppWrap("int a = 0;\n  for (int i = 0; i < 10; i++) if (i < 4) a++;\n  cout << a;"),
      "4\n",
      "4",
      "4",
      "4"
    ),
    project({
      id: "cpp-proj-sec",
      track: "cpp",
      editorLang: "cpp",
      minutes: 40,
      title: H("Проект: сумма + лимит", "Project: bounded sum", "פרויקט"),
      theoryRu: "Сумма массива, если сумма > 100 выведи 100 (cap).",
      theoryEn: "Cap sum at 100.",
      theoryHe: "100.",
      exampleCode: cppWrap("int a[] = {40, 40, 40};\n  int s = 0;\n  for (int x : a) s += x;\n  if (s > 100) s = 100;\n  cout << s;"),
      task: H("40+40+40 cap → 100.", "→ 100.", "100."),
      starterCode: cppWrap("int a[] = {40, 40, 40};\n  int s = 0;\n  for (int x : a) s += x;\n  if (s > 100) s = 100;\n  cout << s;\n"),
      checks: [{ expectedStdout: "100\n" }],
    }),
  ];
}

export function buildCsharpSecurity(csLesson, project, csWrap, H) {
  return [
    csLesson(
      "cs-sec-01",
      "S1",
      "Валидация Parse",
      "Parse validation",
      "Parse",
      "TryParse вместо Parse для безопасного ввода.",
      "TryParse safe input.",
      "TryParse.",
      csWrap('if (int.TryParse("12", out int n)) Console.WriteLine(n);\n    else Console.WriteLine(-1);'),
      "12\n"
    ),
    csLesson(
      "cs-sec-02",
      "S2",
      "Rate limit",
      "Rate limit",
      "Rate",
      "Dictionary IP→count, лимит 3.",
      "Dict rate limit.",
      "מונה.",
      `using System;\nusing System.Collections.Generic;\nclass Program {\n  static void Main() {\n    var c = new Dictionary<string, int>();\n    string ip = "10.0.0.1";\n    for (int i = 0; i < 4; i++) {\n      int n = c.ContainsKey(ip) ? c[ip] + 1 : 1;\n      c[ip] = n;\n      Console.WriteLine(n <= 3 ? 1 : 0);\n    }\n  }\n}`,
      "1\n1\n1\n0\n"
    ),
    csLesson(
      "cs-sec-03",
      "S3",
      "DDoS и CDN",
      "DDoS & CDN",
      "DDoS",
      "Теория: CDN поглощает volumetric. Код: allowed=5 из 12.",
      "5 of 12 allowed.",
      "5.",
      csWrap("int allow = 0;\n    for (int i = 0; i < 12; i++) if (i < 5) allow++;\n    Console.WriteLine(allow);"),
      "5\n"
    ),
    csLesson(
      "cs-sec-04",
      "S4",
      "Хеш SHA256",
      "SHA256 hash",
      "SHA256",
      "System.Security.Cryptography.SHA256 для отпечатка (учебный).",
      "SHA256 hash demo.",
      "גיבוב.",
      `using System;\nusing System.Security.Cryptography;\nusing System.Text;\nclass Program {\n  static void Main() {\n    using var sha = SHA256.Create();\n    var bytes = sha.ComputeHash(Encoding.UTF8.GetBytes("vexx"));\n    Console.WriteLine(BitConverter.ToString(bytes).Replace("-", "").Substring(0, 8).ToLower());\n  }\n}`,
      "bfabb5f9\n"
    ),
    project({
      id: "cs-proj-sec",
      track: "csharp",
      editorLang: "csharp",
      minutes: 45,
      title: H("Проект: фильтр логов", "Project: log filter", "פרויקט"),
      theoryRu: "Массив строк, выведи количество содержащих DENY.",
      theoryEn: "Count lines with DENY.",
      theoryHe: "DENY.",
      exampleCode: csWrap('string[] r = {"OK", "DENY", "DENY"};\n    int n = 0;\n    foreach (var s in r) if (s == "DENY") n++;\n    Console.WriteLine(n);'),
      task: H("2 DENY → 2.", "→ 2.", "2."),
      starterCode: csWrap('string[] r = {"OK", "DENY", "DENY"};\n    int n = 0;\n    foreach (var s in r) if (s == "DENY") n++;\n    Console.WriteLine(n);\n'),
      checks: [{ expectedStdout: "2\n" }],
    }),
  ];
}

export function harderPythonExam(H, exam) {
  return exam(
    "py-exam",
    "python",
    "python",
    H("Экзамен Python: безопасность", "Python exam: security", "מבחן Python"),
    H(
      "Реализуй `def shield(n):` — если n<0 или n>1000 верни 0, иначе n. Выведи shield(50) и shield(9999) на двух строках: 50 и 0.",
      "shield(n) clamps invalid to 0. Print 50 then 0.",
      "50 ואז 0."
    ),
    "def shield(n):\n    if n < 0 or n > 1000:\n        return 0\n    return n\nprint(shield(50))\nprint(shield(9999))\n",
    "50\n0",
    55
  );
}
