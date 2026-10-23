/**
 * Standalone "security" track — cyber defense, DDoS, privacy, doxxing defense, etc.
 * All runnable lessons use Python in the editor.
 */

function securityTheory(ru, en, he) {
  const tailRu =
    "\n\n### Как работать в Vexx Learn\n1. **Вставить пример** — если редактор пустой.\n2. **Запустить** — смотри консоль; если программа ждёт ввод (`input`), пиши в поле внизу и Enter.\n3. **Проверить** — автотесты сравнивают вывод **символ в символ** (пробелы и переносы строк важны).\n4. Ошибка? Блок **«Почему ошибка»** под консолью.\n\n### Уроки-проекты (собери сам)\nУроки с пометкой **Проект** — мини-сервисы как в SOC: lockout, логи, rate limit, анти-фишинг, отчёт инцидента.\n- Прочитай шаги в теории **до** кода.\n- Стартовый код можно стереть и написать с нуля — главное, чтобы **Проверить** прошло.\n- Сначала `print` отладочных значений, потом убирай лишнее.\n\n### Закон и этика\nИзучаем атаки, чтобы **защищать**. DDoS, доксинг, взлом чужих систем, малварь против людей без **письменного разрешения** — уголовная ответственность.\n\n### Сдача\nТочный вывод → **Проверить**. Несколько тестов — все должны пройти.";
  const tailEn =
    "\n\n### Vexx Learn workflow\nRun → console (use input field if needed) → **Check** (exact stdout). Unauthorized attacks are **illegal**.\n\n### Pass\nEvery test must pass.";
  const tailHe =
    "\n\n### תרגול\nאימות, הגבלת קצב, לוגים. התקפות בלי אישור — בלתי חוקי.\n\n### מעבר\nפלט מדויק.";
  return {
    ru: `## Подробно\n\n${ru}${tailRu}\n\n## Задание\n\nКод → **Запустить** → **Проверить**.`,
    en: `## In depth\n\n${en}${tailEn}\n\n## Task\n\nCode → **Run** → **Check**.`,
    he: `## לעומק\n\n${he}${tailHe}\n\n## משימה\n\nקוד → הרץ → בדוק.`,
  };
}

function sec(lesson, base) {
  const { theoryBlock, ...rest } = base;
  return lesson({
    track: "security",
    editorLang: "python",
    ...rest,
    theory: theoryBlock
      ? securityTheory(theoryBlock.ru, theoryBlock.en, theoryBlock.he)
      : rest.theory,
  });
}

export function buildSecurityTrack(lesson, project, ethics, exam, H) {
  const T = (ru, en, he) => ({ theoryBlock: { ru, en, he } });

  const lessons = [
    sec(lesson, {
      id: "sec-01",
      minutes: 25,
      title: H("1. Карта угроз", "1. Threat landscape", "1. מפת איומים"),
      ...T(
        "Кибербезопасность — это не «взлом ради прикола», а дисциплина защиты систем и данных.\n\n**CIA (триада):**\n- **Confidentiality** — секретность (шифрование, доступы).\n- **Integrity** — данные не подменены (хеши, подписи).\n- **Availability** — сервис доступен (бэкапы, защита от **DDoS**).\n\n**Кто атакует:** криминал, конкуренты, хактивисты, инсайдеры, ошибки сотрудников.\n\n**Кто защищает:** SOC, blue team, DevSecOps, GRC, архитекторы. Твой путь начинается с понимания угроз и написания **безопасного кода**.",
        "CIA triad and defender roles. Security is a discipline, not chaos.",
        "CIA ותפקידי מגן."
      ),
      exampleCode: 'print("CIA")\nprint("learn")\nprint("protect")',
      task: H("Выведи CIA, learn, protect — три строки.", "Print CIA, learn, protect.", "שלוש שורות."),
      starterCode: 'print("CIA")\nprint("learn")\nprint("protect")\n',
      checks: [{ expectedStdout: "CIA\nlearn\nprotect" }],
    }),
    sec(lesson, {
      id: "sec-02",
      minutes: 30,
      title: H("2. Доксинг и приватность", "2. Doxxing & privacy", "2. דוקסינג ופרטיות"),
      ...T(
        "**Доксинг** — публикация личных данных человека (адрес, телефон, семья) без согласия. Это травля и часто **преступление**.\n\n**Защита:** минимум данных в профилях, отдельная почта, VPN не спасает от утечки пароля. **Редактирование логов:** не пиши в лог полный email — маска `u***@mail.com`.\n\nКод: `redact_email(\"user@mail.com\")` → `u***@mail.com`.",
        "**Doxxing** publishes private data without consent — illegal harassment. **Defense:** data minimization, log redaction.",
        "דוקסינג — פרסום מידע פרטי. הגנה: מינימום חשיפה, מיסוך בלוגים."
      ),
      exampleCode:
        'def redact_email(e):\n    if "@" not in e:\n        return "***"\n    u, d = e.split("@", 1)\n    return (u[0] + "***@" + d) if u else "***@" + d\nprint(redact_email("user@mail.com"))',
      task: H("redact_email для user@mail.com → u***@mail.com", "Redact email.", "u***@mail.com"),
      starterCode:
        'def redact_email(e):\n    if "@" not in e:\n        return "***"\n    u, d = e.split("@", 1)\n    return (u[0] + "***@" + d) if u else "***@" + d\nprint(redact_email("user@mail.com"))\n',
      checks: [{ expectedStdout: "u***@mail.com" }],
    }),
    sec(lesson, {
      id: "sec-03",
      minutes: 32,
      title: H("3. Фишинг и социнженерия", "3. Phishing", "3. פישינג"),
      ...T(
        "Фишинг — поддельные письма/сайты для кражи паролей. Признаки: срочность, опечатки, чужой домен `paypa1.com`.\n\nЗащита: проверка URL, 2FA, не вводить пароль по ссылке из чата.\n\n`is_suspicious(url)` — True если в строке есть `login` и нет `https://`.",
        "Phishing steals credentials. Check URL and use 2FA.",
        "פישינג לגניבת סיסמאות."
      ),
      exampleCode:
        'def is_suspicious(url):\n    return "login" in url and not url.startswith("https://")\nprint(1 if is_suspicious("http://evil/login") else 0)',
      task: H("http://evil/login → 1, https://bank/login → 0.", "Suspicious flag.", "1 ואז 0"),
      starterCode:
        'def is_suspicious(url):\n    return "login" in url and not url.startswith("https://")\nprint(1 if is_suspicious("http://evil/login") else 0)\nprint(1 if is_suspicious("https://bank/login") else 0)\n',
      checks: [{ expectedStdout: "1\n0" }],
    }),
    sec(lesson, {
      id: "sec-04",
      minutes: 35,
      title: H("4. SQL-инъекции", "4. SQL injection", "4. SQLi"),
      ...T(
        "Склейка SQL с вводом пользователя → `OR 1=1`. Лечение: **параметризованные запросы**, ORM, минимальные права БД.\n\nУчебная функция `safe_id(s)` — только цифры, иначе отказ.",
        "Parameterized queries stop SQLi. safe_id accepts digits only.",
        "שאילתות עם placeholders."
      ),
      exampleCode:
        'def safe_id(s):\n    return s.isdigit()\nprint(1 if safe_id("42") else 0)\nprint(1 if safe_id("1 OR 1") else 0)',
      task: H("42→1, `1 OR 1`→0.", "Digit check.", "1\n0"),
      starterCode:
        'def safe_id(s):\n    return s.isdigit()\nprint(1 if safe_id("42") else 0)\nprint(1 if safe_id("1 OR 1") else 0)\n',
      checks: [{ expectedStdout: "1\n0" }],
    }),
    sec(lesson, {
      id: "sec-05",
      minutes: 30,
      title: H("5. XSS", "5. XSS", "5. XSS"),
      ...T(
        "**XSS** — внедрение скрипта в HTML. Экранируй `<`, `>`, `&`. CSP заголовки на сервере.\n\n`escape_html` для вывода пользовательского ника.",
        "Escape HTML metacharacters on output.",
        "בריחת HTML."
      ),
      exampleCode:
        'def escape_html(s):\n    return s.replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;")\nprint(escape_html("<script>"))',
      task: H("escape <script> → &lt;script&gt;", "Escape script tag.", "&lt;script&gt;"),
      starterCode:
        'def escape_html(s):\n    return s.replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;")\nprint(escape_html("<script>"))\n',
      checks: [{ expectedStdout: "&lt;script&gt;" }],
    }),
    sec(lesson, {
      id: "sec-06",
      minutes: 28,
      title: H("6. Пароли и хеши", "6. Passwords & hashes", "6. סיסמאות"),
      ...T(
        "Храни **хеш**, не пароль. `hashlib.sha256` — демо; в проде **argon2/bcrypt** + соль.\n\nОдинаковый пароль → одинаковый хеш (без соли — только учебник).",
        "Store hashes. sha256 demo; production uses salted slow hashes.",
        "גיבוב סיסמאות."
      ),
      exampleCode: 'import hashlib\nprint(hashlib.sha256(b"vexx").hexdigest()[:8])',
      task: H("Первые 8 hex sha256('vexx') → bfabb5f9", "Hash vexx.", "bfabb5f9"),
      starterCode: 'import hashlib\nprint(hashlib.sha256(b"vexx").hexdigest()[:8])\n',
      checks: [{ expectedStdout: "bfabb5f9" }],
    }),
    sec(lesson, {
      id: "sec-07",
      minutes: 30,
      title: H("7. Секреты в коде", "7. Secrets in code", "7. סודות בקוד"),
      ...T(
        "API-ключи в GitHub = утечка за минуты. Используй `.env`, vault, CI secrets.\n\n`has_secret(code)` — True если строка содержит `API_KEY=`.",
        "Never commit API keys. Scan for API_KEY= patterns.",
        "לא לשמור מפתחות בקוד."
      ),
      exampleCode:
        'def has_secret(line):\n    return "API_KEY=" in line\nprint(1 if has_secret("API_KEY=abc") else 0)',
      task: H("API_KEY=abc → 1, hello → 0.", "Detect leak pattern.", "1\n0"),
      starterCode:
        'def has_secret(line):\n    return "API_KEY=" in line\nprint(1 if has_secret("API_KEY=abc") else 0)\nprint(1 if has_secret("hello") else 0)\n',
      checks: [{ expectedStdout: "1\n0" }],
    }),
    sec(lesson, {
      id: "sec-08",
      minutes: 35,
      title: H("8. Rate limit", "8. Rate limiting", "8. הגבלת קצב"),
      ...T(
        "Лимит запросов с IP — защита от брутфорса и **application flood** (часть DDoS).\n\nСчётчик в dict, лимит 3 → четвёртый отказ.",
        "Per-IP counters mitigate brute force and abuse.",
        "מונה לכל IP."
      ),
      exampleCode:
        'def hit(c, ip, lim=3):\n    c[ip] = c.get(ip, 0) + 1\n    return c[ip] <= lim\nc = {}\nfor _ in range(4):\n    print(1 if hit(c, "1.2.3.4") else 0)',
      task: H("4 запроса лимит 3 → 1,1,1,0.", "Rate limit.", "1\n1\n1\n0"),
      starterCode:
        'def hit(c, ip, lim=3):\n    c[ip] = c.get(ip, 0) + 1\n    return c[ip] <= lim\nc = {}\nfor _ in range(4):\n    print(1 if hit(c, "1.2.3.4") else 0)\n',
      checks: [{ expectedStdout: "1\n1\n1\n0" }],
    }),
    sec(lesson, {
      id: "sec-09",
      minutes: 45,
      title: H("9. DDoS: типы", "9. DDoS types", "9. סוגי DDoS"),
      ...T(
        "**DDoS (Distributed Denial of Service)** — цель: положить сайт/игру/API, а не «взломать пароль».\n\n**Типы:**\n1. **Volumetric** — гигабиты мусорного UDP/ICMP, канал забит.\n2. **Protocol** — SYN flood, полуоткрытые сессии, истощение firewall.\n3. **Application (L7)** — тысячи «нормальных» HTTP-запросов на тяжёлый endpoint `/search`.\n\n**Симптомы:** latency ×10, 502/503, CPU 100%, счета за трафик.\n\n**Защита (слоями):** Anycast **CDN** (Cloudflare, Akamai), **rate limit** + WAF, кэш, autoscale, геоблок при атаке, **blackhole** у ISP, капча на логин. План реагирования: кто звонит провайдеру, кто включает «Under Attack mode».\n\n**Закон:** «проверить, выдержит ли чужой сайт» без договора = DDoS-атака.\n\nКод: симулятор пропускает только первые 4 запроса из 10.",
        "Full DDoS taxonomy and layered mitigation. Legal stress tests need contract.",
        "DDoS והגנה בשכבות."
      ),
      exampleCode: "allowed = sum(1 for i in range(10) if i < 4)\nprint(allowed)",
      task: H("10 запросов, лимит 4 → выведи 4.", "Allow 4 of 10.", "4"),
      starterCode: "allowed = sum(1 for i in range(10) if i < 4)\nprint(allowed)\n",
      checks: [{ expectedStdout: "4" }],
    }),
    sec(lesson, {
      id: "sec-10",
      minutes: 40,
      title: H("10. Ботнеты и CDN", "10. Botnets & CDN", "10. בוטנט"),
      ...T(
        "Ботнет — заражённые машины, управляемые централизованно. Используются для DDoS, спама — **владельцы ботнетов преследуются**.\n\nCDN распределяет трафик и фильтрует часть атаки на периметре.\n\nЕсли `requests > 1000` в логе за минуту — флаг `ALERT`.",
        "Botnets amplify DDoS. CDN absorbs and filters traffic.",
        "בוטנט ו-CDN."
      ),
      exampleCode: "r = 1200\nprint('ALERT' if r > 1000 else 'OK')",
      task: H("1200 запросов → ALERT.", "Print ALERT.", "ALERT"),
      starterCode: "r = 1200\nprint('ALERT' if r > 1000 else 'OK')\n",
      checks: [{ expectedStdout: "ALERT" }],
    }),
    sec(lesson, {
      id: "sec-11",
      minutes: 32,
      title: H("11. Логи и SOC", "11. Logs & SOC", "11. SOC"),
      ...T(
        "SOC анализирует логи: `FAIL_LOGIN`, скан портов, всплеск 404.\n\nФормат `LEVEL|ip|event`. Подсчёт FAIL.",
        "Structured logs enable detection.",
        "לוגים מובנים."
      ),
      exampleCode:
        'L = ["OK|1.1.1.1|x", "FAIL|2.2.2.2|login", "FAIL|2.2.2.2|login"]\nprint(sum(1 for x in L if x.startswith("FAIL")))',
      task: H("2 FAIL → 2.", "Count FAIL.", "2"),
      starterCode:
        'L = ["OK|1.1.1.1|x", "FAIL|2.2.2.2|login", "FAIL|2.2.2.2|login"]\nprint(sum(1 for x in L if x.startswith("FAIL")))\n',
      checks: [{ expectedStdout: "2" }],
    }),
    sec(lesson, {
      id: "sec-12",
      minutes: 30,
      title: H("12. Ransomware", "12. Ransomware", "12. כופר"),
      ...T(
        "Шифровальщик блокирует файлы, требует выкуп. Защита: **бэкапы 3-2-1**, сегментация сети, не запускать макросы, EDR.\n\n`backup_ok` True если `days_since_backup <= 1`.",
        "Ransomware defense: offline backups, segmentation, EDR.",
        "גיבויים נגד כופר."
      ),
      exampleCode: "days = 1\nprint(1 if days <= 1 else 0)",
      task: H("backup 1 день назад → 1.", "Fresh backup OK.", "1"),
      starterCode: "days = 1\nprint(1 if days <= 1 else 0)\n",
      checks: [{ expectedStdout: "1" }],
    }),
    sec(lesson, {
      id: "sec-13",
      minutes: 28,
      title: H("13. MITM (концепт)", "13. MITM concept", "13. MITM"),
      ...T(
        "**Man-in-the-middle** — перехват между клиентом и сервером. Защита: **HTTPS/TLS**, HSTS, certificate pinning в мобильных приложениях.\n\n`secure = url.startswith('https://')`",
        "TLS prevents MITM on the wire. Always HTTPS.",
        "HTTPS נגד MITM."
      ),
      exampleCode:
        'def secure_url(u):\n    return u.startswith("https://")\nprint(1 if secure_url("https://x") else 0)',
      task: H("https → 1, http → 0.", "HTTPS check.", "1\n0"),
      starterCode:
        'def secure_url(u):\n    return u.startswith("https://")\nprint(1 if secure_url("https://x") else 0)\nprint(1 if secure_url("http://x") else 0)\n',
      checks: [{ expectedStdout: "1\n0" }],
    }),
    sec(lesson, {
      id: "sec-14",
      minutes: 35,
      title: H("14. OWASP Top", "14. OWASP Top", "14. OWASP"),
      ...T(
        "OWASP Top 10: broken access control, crypto failures, injection, insecure design, misconfiguration, vulnerable components, auth failures, integrity, logging, SSRF.\n\nВыведи количество категорий в учебном списке из 10 строк.",
        "OWASP Top 10 categories — know the list as a defender.",
        "OWASP Top 10."
      ),
      exampleCode: "cats = list(range(10))\nprint(len(cats))",
      task: H("10 категорий → 10.", "Print 10.", "10"),
      starterCode: "cats = list(range(10))\nprint(len(cats))\n",
      checks: [{ expectedStdout: "10" }],
    }),
    sec(lesson, {
      id: "sec-15",
      minutes: 30,
      title: H("15. Пентест легально", "15. Legal pentest", "15. פנטסט חוקי"),
      ...T(
        "Пентест без **письменного scope** (договор, IP, даты) = взлом. Bug bounty только по правилам программы.\n\n`scope_ok = signed and target in scope_list`",
        "Written scope before any security testing.",
        "scope בכתב."
      ),
      exampleCode:
        'signed = True\nscope = ["10.0.0.5"]\ntarget = "10.0.0.5"\nprint(1 if signed and target in scope else 0)',
      task: H("signed + target in scope → 1.", "Scope check.", "1"),
      starterCode:
        'signed = True\nscope = ["10.0.0.5"]\ntarget = "10.0.0.5"\nprint(1 if signed and target in scope else 0)\n',
      checks: [{ expectedStdout: "1" }],
    }),
    project({
      id: "sec-proj-auth",
      track: "security",
      editorLang: "python",
      minutes: 50,
      title: H("Проект: вход с lockout", "Project: login lockout", "פרויקט: lockout"),
      theoryRu:
        "**Цель:** симулятор входа с блокировкой после 3 неверных попыток (как в уроках про хеш и rate limit).\n\n**Шаги (собери в редакторе):**\n1. `import hashlib`, функция `h(p)` → первые 8 hex символов SHA-256 от пароля.\n2. `CORRECT = h(\"vexx\")`.\n3. Список попыток: `[\"w\", \"w\", \"w\", \"vexx\"]`.\n4. Счётчик `fails = 0`, цикл `for password in attempts`.\n5. **До** проверки пароля: если `fails >= 3` → `print(\"LOCKED\")` и `break`.\n6. Если `h(password) == CORRECT` → можно `print(\"OK\")` и выйти (в финальной проверке нужен только LOCKED на 4-й попытке).\n7. Иначе `fails += 1`.\n\n**Ожидание автотеста:** на четвёртой итерации цикла (когда уже три промаха) программа печатает одну строку `LOCKED`.",
      theoryEn: "Build login lockout: hash check, 3 fails → LOCKED on next attempt.",
      theoryHe: "lockout אחרי 3 כשלונות.",
      exampleCode:
        'import hashlib\ndef h(p):\n    return hashlib.sha256(p.encode()).hexdigest()[:8]\nHP = h("vexx")\nfor i, p in enumerate(["w", "w", "w", "vexx"]):\n    if i >= 3:\n        print("LOCKED")\n        break\n',
      task: H("На 4-й попытке только LOCKED.", "Print LOCKED.", "LOCKED"),
      starterCode:
        'import hashlib\ndef h(p):\n    return hashlib.sha256(p.encode()).hexdigest()[:8]\nHP = h("vexx")\nfor i, p in enumerate(["w", "w", "w", "vexx"]):\n    if i >= 3:\n        print("LOCKED")\n        break\n',
      checks: [{ expectedStdout: "LOCKED" }],
    }),
    project({
      id: "sec-proj-logs",
      track: "security",
      editorLang: "python",
      minutes: 55,
      title: H("Проект: разбор инцидента", "Project: incident triage", "פרויקט: תחקיר"),
      theoryRu:
        "**Цель:** мини-SOC: разобрать firewall-лог и выдать три метрики.\n\n**Формат строки:** `OK|1.1.1.1` или `DENY|6.6.6.6` — действие до `|`, IP после.\n\n**Шаги:**\n1. `def ip(row): return row.split(\"|\", 1)[1]`\n2. Список `rows` из задания (5 строк).\n3. `print(len(rows))` — всего событий.\n4. `print(sum(1 for r in rows if ip(r) == \"6.6.6.6\"))` — сколько раз IP атакующего.\n5. `print(sum(1 for r in rows if r.startswith(\"DENY\")))` — сколько блокировок.\n\n**Вывод:** три числа на трёх строках: `5`, `4`, `2`.",
      theoryEn: "SOC triage: total lines, count IP 6.6.6.6 in column 2, count DENY.",
      theoryHe: "ספירת IP ו-DENY.",
      exampleCode:
        'def ip(row):\n    return row.split("|", 1)[1]\nrows = ["OK|1.1.1.1", "DENY|6.6.6.6", "OK|6.6.6.6", "DENY|6.6.6.6", "OK|6.6.6.6"]\nprint(len(rows))\nprint(sum(1 for r in rows if ip(r) == "6.6.6.6"))\nprint(sum(1 for r in rows if r.startswith("DENY")))',
      task: H("Три строки: 5, 4, 2.", "Print 5, 4, 2.", "5\n4\n2"),
      starterCode:
        'def ip(row):\n    return row.split("|", 1)[1]\nrows = ["OK|1.1.1.1", "DENY|6.6.6.6", "OK|6.6.6.6", "DENY|6.6.6.6", "OK|6.6.6.6"]\nprint(len(rows))\nprint(sum(1 for r in rows if ip(r) == "6.6.6.6"))\nprint(sum(1 for r in rows if r.startswith("DENY")))\n',
      checks: [{ expectedStdout: "5\n4\n2" }],
    }),
    project({
      id: "sec-proj-rate",
      track: "security",
      editorLang: "python",
      minutes: 45,
      title: H("Проект: rate limit API", "Project: API rate limit", "פרויקט: rate limit"),
      theoryRu:
        "**Цель:** защита от флуда — не больше `LIMIT` запросов за окно.\n\nДан список меток времени (секунды): `ts = [1, 2, 2, 3, 3, 3, 10]` и `LIMIT = 3`, окно `WINDOW = 5` сек.\n\n**Правило:** запрос в момент `t` разрешён, если в интервале `(t - WINDOW, t]` уже было **меньше** `LIMIT` запросов (не считая текущий).\n\n**Шаги:**\n1. Для каждого `t` из `ts` посчитай, сколько значений в `ts` попадают в окно **до** этого `t` (строго `<= t` и `> t - WINDOW`).\n2. Если счётчик `< LIMIT` → `ALLOW`, иначе `DENY`.\n3. Выведи по одной строке на каждый запрос.\n\nОжидание: `ALLOW\\nALLOW\\nALLOW\\nDENY\\nDENY\\nDENY\\nALLOW`.",
      theoryEn: "Sliding window rate limiter — print ALLOW/DENY per timestamp.",
      theoryHe: "מגביל קצב.",
      exampleCode:
        'ts = [1, 2, 2, 3, 3, 3, 10]\nLIMIT = 3\nWINDOW = 5\nfor i, t in enumerate(ts):\n    prev = ts[:i]\n    in_win = sum(1 for x in prev if x > t - WINDOW and x <= t)\n    print("ALLOW" if in_win < LIMIT else "DENY")\n',
      task: H("7 строк ALLOW/DENY по правилу окна.", "Rate limit output.", "ALLOW/DENY"),
      starterCode:
        'ts = [1, 2, 2, 3, 3, 3, 10]\nLIMIT = 3\nWINDOW = 5\nfor i, t in enumerate(ts):\n    prev = ts[:i]\n    in_win = sum(1 for x in prev if x > t - WINDOW and x <= t)\n    print("ALLOW" if in_win < LIMIT else "DENY")\n',
      checks: [{ expectedStdout: "ALLOW\nALLOW\nALLOW\nDENY\nDENY\nDENY\nALLOW" }],
    }),
    project({
      id: "sec-proj-phish",
      track: "security",
      editorLang: "python",
      minutes: 42,
      title: H("Проект: фильтр ссылок", "Project: link filter", "פרויקט: קישורים"),
      theoryRu:
        "**Цель:** простой корпоративный фильтр фишинга.\n\nБелый список доменов: `allowed = {\"bank.com\", \"patched.dev\"}`.\n\nФункция `classify(url)`:\n- если URL начинается с `https://` **и** домен (часть между `https://` и следующим `/`) в `allowed` → `SAFE`\n- иначе → `BLOCK`\n\n**Шаги:**\n1. Вырежи домен: `host = url.split(\"/\")[2]` для `https://...`.\n2. Протестируй три URL из задания.\n\nВывод три строки: `SAFE`, `BLOCK`, `BLOCK`.",
      theoryEn: "HTTPS + allowlist domain check.",
      theoryHe: "רשימת מותרים.",
      exampleCode:
        'allowed = {"bank.com", "patched.dev"}\ndef classify(url):\n    if not url.startswith("https://"):\n        return "BLOCK"\n    host = url.split("/")[2]\n    return "SAFE" if host in allowed else "BLOCK"\nurls = ["https://bank.com/login", "http://bank.com/login", "https://evil.com/x"]\nfor u in urls:\n    print(classify(u))\n',
      task: H("Три классификации подряд.", "Three lines.", "SAFE\\nBLOCK\\nBLOCK"),
      starterCode:
        'allowed = {"bank.com", "patched.dev"}\ndef classify(url):\n    if not url.startswith("https://"):\n        return "BLOCK"\n    host = url.split("/")[2]\n    return "SAFE" if host in allowed else "BLOCK"\nurls = ["https://bank.com/login", "http://bank.com/login", "https://evil.com/x"]\nfor u in urls:\n    print(classify(u))\n',
      checks: [{ expectedStdout: "SAFE\nBLOCK\nBLOCK" }],
    }),
    project({
      id: "sec-proj-report",
      track: "security",
      editorLang: "python",
      minutes: 55,
      title: H("Проект: отчёт инцидента", "Project: incident report", "פרויקט: דוח"),
      theoryRu:
        "**Цель:** собрать мини-отчёт для тикета (как bug bounty / SOC).\n\nВвод (stdin), три строки:\n1. `severity` — число 1–5\n2. `in_scope` — `yes` или `no`\n3. `has_poc` — `yes` или `no`\n\n**Правила:**\n- `ACCEPT` только если `in_scope == yes`, `has_poc == yes`, `severity >= 3`\n- иначе `REJECT`\n- всегда печатай `SEV:<severity>` на первой строке, решение на второй.\n\nПример ввода в проверке: severity `4`, scope `yes`, poc `yes` → `SEV:4` и `ACCEPT`.",
      theoryEn: "Read three stdin lines; print SEV and ACCEPT/REJECT.",
      theoryHe: "דוח stdin.",
      exampleCode:
        'sev = int(input())\nscope = input().strip().lower()\npoc = input().strip().lower()\nprint(f"SEV:{sev}")\nok = scope == "yes" and poc == "yes" and sev >= 3\nprint("ACCEPT" if ok else "REJECT")\n',
      task: H("stdin 4, yes, yes → SEV:4 и ACCEPT.", "Incident triage.", "ACCEPT"),
      starterCode:
        'sev = int(input())\nscope = input().strip().lower()\npoc = input().strip().lower()\nprint(f"SEV:{sev}")\nok = scope == "yes" and poc == "yes" and sev >= 3\nprint("ACCEPT" if ok else "REJECT")\n',
      checks: [
        { stdin: "4\nyes\nyes\n", expectedStdout: "SEV:4\nACCEPT" },
        { stdin: "2\nyes\nyes\n", expectedStdout: "SEV:2\nREJECT" },
      ],
    }),
    sec(lesson, {
      id: "sec-16",
      minutes: 38,
      title: H("16. Malware семейства", "16. Malware families", "16. malware"),
      ...T(
        "Вирус, троян, стилер, RAT, криптомайнер, шифровальщик — разные цели. Создание и распространение **против чужих** — уголовка.\n\nИзучай в песочнице и курсах, как **детектировать** (IOC, поведение).",
        "Know malware families to defend; creating malware for others is criminal.",
        "משפחות malware להגנה."
      ),
      exampleCode: 'families = ["virus", "trojan", "stealer", "rat"]\nprint(len(families))',
      task: H("4 семейства → 4.", "Print 4.", "4"),
      starterCode: 'families = ["virus", "trojan", "stealer", "rat"]\nprint(len(families))\n',
      checks: [{ expectedStdout: "4" }],
    }),
    sec(lesson, {
      id: "sec-17",
      minutes: 35,
      title: H("17. 2FA и сессии", "17. 2FA & sessions", "17. 2FA"),
      ...T(
        "Пароль + второй фактор (TOTP, ключ). Сессионный токен должен быть случайным и с TTL.\n\n`auth_ok = password_ok and totp_ok`",
        "2FA layers defense. Both factors required.",
        "2FA."
      ),
      exampleCode: "pw = True\ntotp = True\nprint(1 if pw and totp else 0)",
      task: H("оба True → 1.", "Both factors.", "1"),
      starterCode: "pw = True\ntotp = True\nprint(1 if pw and totp else 0)\n",
      checks: [{ expectedStdout: "1" }],
    }),
    sec(lesson, {
      id: "sec-18",
      minutes: 40,
      title: H("18. Zero Trust", "18. Zero Trust", "18. Zero Trust"),
      ...T(
        "Не доверяй сети по умолчанию. Каждый запрос: кто, что, откуда, зачем. MFA, micro-segmentation.\n\n`allow = user in group and mfa`",
        "Zero trust: verify every access.",
        "Zero Trust."
      ),
      exampleCode:
        'user = "alice"\ngroup = ["alice", "bob"]\nmfa = True\nprint(1 if user in group and mfa else 0)',
      task: H("alice + mfa → 1.", "Allow alice.", "1"),
      starterCode:
        'user = "alice"\ngroup = ["alice", "bob"]\nmfa = True\nprint(1 if user in group and mfa else 0)\n',
      checks: [{ expectedStdout: "1" }],
    }),
    sec(lesson, {
      id: "sec-19",
      minutes: 36,
      title: H("19. CSRF", "19. CSRF", "19. CSRF"),
      ...T(
        "**CSRF** — браузер жертвы отправляет запрос на сайт, где она уже залогинена (смена пароля, перевод). Защита: **CSRF-токен** в форме, SameSite cookies, проверка Referer.\n\n`csrf_ok(method, token)` — для POST токен обязан быть непустым.",
        "CSRF tricks the browser into unwanted actions. Use anti-CSRF tokens.",
        "CSRF וטוקן."
      ),
      exampleCode:
        'def csrf_ok(method, token):\n    if method == "GET":\n        return True\n    return bool(token)\nprint(1 if csrf_ok("POST", "abc") else 0)\nprint(1 if csrf_ok("POST", "") else 0)',
      task: H("POST+token → 1, POST пустой → 0.", "CSRF token check.", "1\n0"),
      starterCode:
        'def csrf_ok(method, token):\n    if method == "GET":\n        return True\n    return bool(token)\nprint(1 if csrf_ok("POST", "abc") else 0)\nprint(1 if csrf_ok("POST", "") else 0)\n',
      checks: [{ expectedStdout: "1\n0" }],
    }),
    sec(lesson, {
      id: "sec-20",
      minutes: 38,
      title: H("20. SSRF", "20. SSRF", "20. SSRF"),
      ...T(
        "**SSRF** — сервер по твоему URL ходит во внутреннюю сеть (`http://127.0.0.1`, `http://169.254.169.254` метаданные облака). Защита: whitelist хостов, блок private IP, без raw URL от пользователя.\n\n`blocked(host)` True для localhost.",
        "SSRF abuses server-side fetches. Block internal hosts.",
        "SSRF."
      ),
      exampleCode:
        'def blocked(host):\n    return host in ("127.0.0.1", "localhost")\nprint(1 if blocked("127.0.0.1") else 0)\nprint(1 if blocked("example.com") else 0)',
      task: H("127.0.0.1→1, example.com→0.", "Block internal.", "1\n0"),
      starterCode:
        'def blocked(host):\n    return host in ("127.0.0.1", "localhost")\nprint(1 if blocked("127.0.0.1") else 0)\nprint(1 if blocked("example.com") else 0)\n',
      checks: [{ expectedStdout: "1\n0" }],
    }),
    sec(lesson, {
      id: "sec-21",
      minutes: 40,
      title: H("21. Ввод пользователя", "21. User input (stdin)", "21. קלט"),
      ...T(
        "Реальные сервисы читают ввод: `input()` в Python. **Запустить** → внизу консоли введи строку → Enter.\n\nПроверка: непустой логин → `OK`, пустой → `EMPTY`. Автотест подставит `alice` сам.",
        "Use Run + console input field for input(). Check uses stdin.",
        "input() והרצה אינטראקטיבית."
      ),
      exampleCode: 'name = input()\nprint("OK" if name.strip() else "EMPTY")',
      task: H(
        "Прочитай строку; если не пустая — OK. При проверке ввод `alice`.",
        "Non-empty input → OK.",
        "OK"
      ),
      starterCode: 'name = input()\nprint("OK" if name.strip() else "EMPTY")\n',
      checks: [{ stdin: "alice\n", expectedStdout: "OK" }],
    }),
    sec(lesson, {
      id: "sec-22",
      minutes: 34,
      title: H("22. Supply chain", "22. Supply chain", "22. supply chain"),
      ...T(
        "Атака через зависимости: поддельный пакет npm/PyPI, компрометированный vendor. Защита: lock-файлы, подписи, SBOM, минимум зависимостей, Dependabot.\n\n`pin_ok(v)` — версия содержит цифру (не `latest`).",
        "Supply-chain attacks via dependencies. Pin versions.",
        "שרשרת אספקה."
      ),
      exampleCode:
        'def pin_ok(v):\n    return any(c.isdigit() for c in v)\nprint(1 if pin_ok("2.1.0") else 0)\nprint(1 if pin_ok("latest") else 0)',
      task: H("2.1.0→1, latest→0.", "Pin versions.", "1\n0"),
      starterCode:
        'def pin_ok(v):\n    return any(c.isdigit() for c in v)\nprint(1 if pin_ok("2.1.0") else 0)\nprint(1 if pin_ok("latest") else 0)\n',
      checks: [{ expectedStdout: "1\n0" }],
    }),
    sec(lesson, {
      id: "sec-23",
      minutes: 42,
      title: H("23. Криптография", "23. Cryptography", "23. קריפטו"),
      ...T(
        "**Симметричное** — один ключ (AES) для шифрования файла.\n**Хеш** — односторонний отпечаток (пароли).\n**Асимметрия** — публичный/приватный ключ (TLS, подписи).\n\nНе путай: хеш нельзя «расшифровать». Длина sha256 hex = 64 символа.",
        "Symmetric vs hash vs public-key crypto.",
        "סימטרי, גיבוב, מפתחות."
      ),
      exampleCode: 'import hashlib\nprint(len(hashlib.sha256(b"x").hexdigest()))',
      task: H("Длина hex sha256 → 64.", "Print 64.", "64"),
      starterCode: 'import hashlib\nprint(len(hashlib.sha256(b"x").hexdigest()))\n',
      checks: [{ expectedStdout: "64" }],
    }),
    sec(lesson, {
      id: "sec-24",
      minutes: 38,
      title: H("24. Реагирование IR", "24. Incident response", "24. IR"),
      ...T(
        "Фазы **IR:** подготовка → обнаружение → сдерживание → устранение → восстановление → уроки.\n\nПри инциденте: не паниковать, сохранить логи, изолировать хост, эскалировать.\n\nВыведи фазы через запятую в одной строке (учебный формат).",
        "NIST-style IR phases.",
        "שלבי IR."
      ),
      exampleCode: 'print("prep,detect,contain,recover")',
      task: H("Одна строка: prep,detect,contain,recover", "IR phases line.", "prep,detect,contain,recover"),
      starterCode: 'print("prep,detect,contain,recover")\n',
      checks: [{ expectedStdout: "prep,detect,contain,recover" }],
    }),
    sec(lesson, {
      id: "sec-25",
      minutes: 36,
      title: H("25. IOC и форензика", "25. IOC & forensics", "25. IOC"),
      ...T(
        "**IOC** (indicator of compromise): IP C2, хеш файла, домен, путь реестра. Ищут в SIEM/EDR.\n\nСписок IOC: посчитай элементы.",
        "Indicators of compromise feed detection.",
        "IOC."
      ),
      exampleCode: 'ioc = ["1.2.3.4", "evil.com", "deadbeef"]\nprint(len(ioc))',
      task: H("3 IOC → 3.", "Print 3.", "3"),
      starterCode: 'ioc = ["1.2.3.4", "evil.com", "deadbeef"]\nprint(len(ioc))\n',
      checks: [{ expectedStdout: "3" }],
    }),
    sec(lesson, {
      id: "sec-26",
      minutes: 40,
      title: H("26. API и OAuth", "26. API & OAuth", "26. API"),
      ...T(
        "API-ключи в заголовке, OAuth2 выдаёт **access token** с TTL. Не логируй токены. Scope минимальный.\n\n`scope_ok(scopes, need)` — need должен быть в списке scopes.",
        "OAuth scopes least privilege.",
        "scope."
      ),
      exampleCode:
        'def scope_ok(scopes, need):\n    return need in scopes\nprint(1 if scope_ok(["read", "write"], "read") else 0)',
      task: H("read in scopes → 1.", "Scope check.", "1"),
      starterCode:
        'def scope_ok(scopes, need):\n    return need in scopes\nprint(1 if scope_ok(["read", "write"], "read") else 0)\n',
      checks: [{ expectedStdout: "1" }],
    }),
    sec(lesson, {
      id: "sec-27",
      minutes: 35,
      title: H("27. Цифровой след", "27. Digital footprint", "27. footprint"),
      ...T(
        "**OSINT** — открытые данные о тебе: соцсети, утечки паролей, метаданные фото. **Защита от доксинга:** не светить адрес, 2FA, уникальные ники, проверка haveibeenpwned.\n\n`safe_nick(n)` — длина 3..16, только буквы/цифры.",
        "Minimize public footprint. Validate public nicknames.",
        "טביעת רגל דיגיטלית."
      ),
      exampleCode:
        'def safe_nick(n):\n    return 3 <= len(n) <= 16 and n.isalnum()\nprint(1 if safe_nick("vexx42") else 0)',
      task: H("vexx42 → 1.", "Valid nick.", "1"),
      starterCode:
        'def safe_nick(n):\n    return 3 <= len(n) <= 16 and n.isalnum()\nprint(1 if safe_nick("vexx42") else 0)\n',
      checks: [{ expectedStdout: "1" }],
    }),
    sec(lesson, {
      id: "sec-28",
      minutes: 45,
      title: H("28. Bug bounty", "28. Bug bounty", "28. bounty"),
      ...T(
        "Платформы (HackerOne, Bugcrowd): ищешь баг **в рамках policy** — scope, safe harbor, не DoS.\n\nОтчёт: title, steps, impact, PoC **без** эксфильтрации чужих данных.\n\n`report_ok(has_steps, in_scope)` — оба True.",
        "Bug bounty requires scope and reproducible steps.",
        "bug bounty."
      ),
      exampleCode: "print(1 if True and True else 0)",
      task: H("report_ok(True,True) → 1.", "Print 1.", "1"),
      starterCode: "has_steps = True\nin_scope = True\nprint(1 if has_steps and in_scope else 0)\n",
      checks: [{ expectedStdout: "1" }],
    }),
  ];

  const ethicsLesson = {
    ...ethics(
      "sec-ethics",
      "security",
      "python",
      'print("learn")\nprint("build")\nprint("protect")\n',
      "learn\nbuild\nprotect"
    ),
    track: "security",
    title: H("Этика хакера", "Hacker ethics", "אתיקה"),
    theory: securityTheory(
      "Белая шляпа: защита. Серая — без разрешения нельзя. Чёрная — преступление.\n\n**DDoS, доксинг, стилеры, RAT** против людей без закона — тюрьма и бан навыков.\n\nКарьера: SOC, forensics, GRC, DevSecOps, пентест **со scope**.",
      "White hat defends. Black hat attacks illegally. DDoS/doxxing/malware against victims is criminal.",
      "כובע לבן מגן. כובע שחור פלילי."
    ),
  };

  const examLesson = {
    ...exam(
      "sec-exam",
      "security",
      "python",
      H("Экзамен: киберзащита", "Cybersecurity exam", "מבחן אבטחה"),
      H(
        "1) `shield(n)`: n<0 или n>1000 → 0, иначе n — выведи shield(50) и shield(9999) (две строки).\n2) `sanitize(s)` — убери пробелы по краям; для ввода `  hi  ` выведи `hi` (проверка с stdin).",
        "shield + sanitize with stdin test.",
        "shield + sanitize."
      ),
      "def shield(n):\n    if n < 0 or n > 1000:\n        return 0\n    return n\nprint(shield(50))\nprint(shield(9999))\n",
      "50\n0",
      60
    ),
    track: "security",
    starterCode:
      "def shield(n):\n    if n < 0 or n > 1000:\n        return 0\n    return n\n\ndef sanitize(s):\n    return s.strip()\n\nprint(shield(50))\nprint(shield(9999))\nprint(sanitize(input()))\n",
    checks: [{ stdin: "  hi  \n", expectedStdout: "50\n0\nhi" }],
  };

  return [...lessons, ethicsLesson, examLesson];
}
