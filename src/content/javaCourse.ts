import type { LessonDef } from "./types";

const H = (ru: string, en: string, he: string) => ({ ru, en, he });

export const JAVA_COURSE: LessonDef[] = [
  {
    id: "java-01",
    track: "java",
    minutes: 8,
    title: H("1. Hello Java", "1. Hello Java", "1. Hello Java"),
    theory: H(
      "Класс + `main` — точка входа.\n\n`System.out.println(\"text\");`",
      "Class + `main` entry point.\n\n`System.out.println(\"text\");`",
      "מחלקה + main. System.out.println."
    ),
    exampleCode:
      'public class Main {\n  public static void main(String[] args) {\n    System.out.println("Hi");\n  }\n}',
    exampleExplain: H("Каждая строка заканчивается `;`.", "Statements end with `;`.", "כל פקודה מסתיימת ב-;"),
    task: H("Выведи `Java` (класс Main).", "Print `Java` (class Main).", "הדפס Java."),
    starterCode:
      'public class Main {\n  public static void main(String[] args) {\n    System.out.println("Java");\n  }\n}',
    checks: [{ expectedStdout: "Java\n" }],
    editorLang: "java",
  },
  {
    id: "java-02",
    track: "java",
    minutes: 10,
    title: H("2. Переменные", "2. Variables", "2. משתנים"),
    theory: H(
      "`int x = 5;` `String s = \"hi\";` — тип + имя + значение.",
      "Types: `int`, `String`, `double`.",
      "טיפוסים: int, String."
    ),
    exampleCode:
      'public class Main {\n  public static void main(String[] args) {\n    int a = 4, b = 6;\n    System.out.println(a + b);\n  }\n}',
    exampleExplain: H("Сумма в println.", "Sum in println.", "סכום."),
    task: H("Выведи 15 (например 7+8).", "Print 15 (e.g. 7+8).", "הדפס 15."),
    starterCode:
      'public class Main {\n  public static void main(String[] args) {\n    System.out.println(7 + 8);\n  }\n}',
    checks: [{ expectedStdout: "15\n" }],
    editorLang: "java",
  },
  {
    id: "java-03",
    track: "java",
    minutes: 12,
    title: H("3. if", "3. if", "3. if"),
    theory: H(
      "```java\nif (x > 0) {\n  System.out.println(\"ok\");\n}\n```",
      "Curly braces `{ }` for blocks.",
      "סוגריים מסולסלים לבלוק."
    ),
    exampleCode:
      'public class Main {\n  public static void main(String[] args) {\n    int n = 10;\n    if (n > 5) System.out.println("yes");\n  }\n}',
    exampleExplain: H("Условие в скобках.", "Condition in parentheses.", "תנאי בסוגריים."),
    task: H("n=3 → выведи `small` если n<5.", "If n=3 and n<5 print `small`.", "הדפס small."),
    starterCode:
      'public class Main {\n  public static void main(String[] args) {\n    int n = 3;\n    if (n < 5) System.out.println("small");\n  }\n}',
    checks: [{ expectedStdout: "small\n" }],
    editorLang: "java",
  },
  {
    id: "java-04",
    track: "java",
    minutes: 12,
    title: H("4. for", "4. for loop", "4. for"),
    theory: H(
      "`for (int i = 0; i < 3; i++)` — классический цикл.",
      "Classic `for` loop.",
      "לולאת for קלאסית."
    ),
    exampleCode:
      'public class Main {\n  public static void main(String[] args) {\n    for (int i = 1; i <= 3; i++) System.out.println(i);\n  }\n}',
    exampleExplain: H("1,2,3.", "1,2,3.", "1,2,3."),
    task: H("Выведи 2 и 4 (два println).", "Print 2 and 4.", "הדפס 2 ו-4."),
    starterCode:
      'public class Main {\n  public static void main(String[] args) {\n    System.out.println(2);\n    System.out.println(4);\n  }\n}',
    checks: [{ expectedStdout: "2\n4\n" }],
    editorLang: "java",
  },
  {
    id: "java-05",
    track: "java",
    minutes: 14,
    title: H("5. Методы", "5. Methods", "5. מתודות"),
    theory: H(
      "`static int add(int a, int b) { return a + b; }`",
      "Methods return values with `return`.",
      "מתודות עם return."
    ),
    exampleCode:
      'public class Main {\n  static int dbl(int x) { return x * 2; }\n  public static void main(String[] args) {\n    System.out.println(dbl(11));\n  }\n}',
    exampleExplain: H("dbl(11)→22.", "dbl(11)→22.", "dbl(11)→22."),
    task: H("Метод `triple(4)` → 12.", "Method triple(4) → 12.", "triple(4) → 12."),
    starterCode:
      'public class Main {\n  static int triple(int x) { return x * 3; }\n  public static void main(String[] args) {\n    System.out.println(triple(4));\n  }\n}',
    checks: [{ expectedStdout: "12\n" }],
    editorLang: "java",
  },
  {
    id: "java-06",
    track: "java",
    minutes: 14,
    title: H("6. Массивы", "6. Arrays", "6. מערכים"),
    theory: H(
      "`int[] a = {1,2,3};` — `a.length`, `a[0]`.",
      "Arrays: length and indexes.",
      "מערכים ואורך."
    ),
    exampleCode:
      'public class Main {\n  public static void main(String[] args) {\n    int[] v = {5, 10};\n    System.out.println(v[0] + v[1]);\n  }\n}',
    exampleExplain: H("15.", "15.", "15."),
    task: H("Массив {2,3,4} — выведи сумму 9.", "Array {2,3,4} sum → 9.", "סכום 9."),
    starterCode:
      'public class Main {\n  public static void main(String[] args) {\n    int[] v = {2, 3, 4};\n    System.out.println(v[0] + v[1] + v[2]);\n  }\n}',
    checks: [{ expectedStdout: "9\n" }],
    editorLang: "java",
  },
  {
    id: "java-07",
    track: "java",
    kind: "ethics",
    minutes: 18,
    title: H("7. Безопасность", "7. Security", "7. אבטחה"),
    theory: H(
      "Вредоносный Java-код (RAT, кейлоггеры) — **незаконно**. Изучай **безопасную разработку**: не храни пароли в коде, проверяй ввод, используй HTTPS.",
      "Malware in Java is **illegal**. Learn secure coding: no passwords in source, validate input.",
      "קוד זדוני — בלתי חוקי. פיתוח מאובטח."
    ),
    exampleCode:
      'public class Main {\n  public static void main(String[] args) {\n    System.out.println("secure");\n  }\n}',
    exampleExplain: H("Пиши легальный код.", "Write legal code.", "קוד חוקי."),
    task: H("Выведи `legal`.", "Print `legal`.", "הדפס legal."),
    starterCode:
      'public class Main {\n  public static void main(String[] args) {\n    System.out.println("legal");\n  }\n}',
    checks: [{ expectedStdout: "legal\n" }],
    editorLang: "java",
  },
  {
    id: "java-exam",
    track: "java",
    kind: "exam",
    minutes: 40,
    title: H("Экзамен Java", "Java final exam", "מבחן Java"),
    theory: H(
      "Напиши `sum3(a,b,c)` и выведи сумму для 1,2,3 → 6.",
      "Write sum3 and print sum for 1,2,3 → 6.",
      "sum3 והדפס 6."
    ),
    exampleCode:
      'public class Main {\n  static int sum3(int a, int b, int c) { return a + b + c; }\n  public static void main(String[] args) {\n    System.out.println(sum3(1, 2, 3));\n  }\n}',
    exampleExplain: H("Готовый шаблон.", "Template.", "תבנית."),
    task: H("То же: вывод `6`.", "Output must be `6`.", "פלט 6."),
    starterCode:
      'public class Main {\n  static int sum3(int a, int b, int c) {\n    return 0;\n  }\n  public static void main(String[] args) {\n    System.out.println(sum3(1, 2, 3));\n  }\n}',
    checks: [{ expectedStdout: "6\n", hint: H("return a+b+c", "return a+b+c", "return a+b+c") }],
    editorLang: "java",
  },
];
