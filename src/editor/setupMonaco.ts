import type { Monaco } from "@monaco-editor/react";
import type { languages, editor, Position, IRange } from "monaco-editor";

type MonacoApi = typeof import("monaco-editor");

let installed = false;

type ItemDef = {
  label: string;
  kind: number;
  detail?: string;
  doc?: string;
  insertText: string;
  snippet?: boolean;
  filterText?: string;
  /** Show when line prefix ends with this (e.g. "Console.") */
  memberOf?: string;
};

function snippetRules(monaco: MonacoApi, snippet?: boolean) {
  return snippet
    ? monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet
    : undefined;
}

function defsToSuggestions(
  monaco: MonacoApi,
  defs: ItemDef[],
  range: IRange,
  linePrefix: string
): languages.CompletionItem[] {
  const out: languages.CompletionItem[] = [];
  for (const d of defs) {
    if (d.memberOf && !linePrefix.endsWith(d.memberOf)) continue;

    out.push({
      label: d.label,
      kind: d.kind,
      detail: d.detail,
      documentation: d.doc ? { value: d.doc } : undefined,
      insertText: d.insertText,
      insertTextRules: snippetRules(monaco, d.snippet),
      filterText: d.filterText ?? d.label,
      range,
      sortText: d.label.startsWith("_") ? "z" + d.label : d.label,
    });
  }
  return out;
}

const PYTHON: ItemDef[] = [
  { label: "print", kind: 1, detail: "built-in", doc: "Вывод в консоль: `print(x, y)`", insertText: "print(${1})", snippet: true, filterText: "print" },
  { label: "input", kind: 1, detail: "built-in", doc: "Читает строку с клавиатуры (в курсе редко нужен).", insertText: "input(${1:prompt})", snippet: true },
  { label: "len", kind: 1, insertText: "len(${1})", snippet: true },
  { label: "range", kind: 1, doc: "range(stop) или range(start, stop, step)", insertText: "range(${1:10})", snippet: true },
  { label: "int", kind: 1, insertText: "int(${1})", snippet: true },
  { label: "str", kind: 1, insertText: "str(${1})", snippet: true },
  { label: "float", kind: 1, insertText: "float(${1})", snippet: true },
  { label: "sum", kind: 1, insertText: "sum(${1})", snippet: true },
  { label: "type", kind: 1, insertText: "type(${1})", snippet: true },
  { label: "def", kind: 14, doc: "Объявление функции", insertText: "def ${1:name}(${2}):\n    ${3:pass}", snippet: true },
  { label: "class", kind: 7, insertText: "class ${1:Name}:\n    def __init__(self${2}):\n        ${3:pass}", snippet: true },
  { label: "if", kind: 14, insertText: "if ${1:cond}:\n    ${2:pass}", snippet: true },
  { label: "elif", kind: 14, insertText: "elif ${1:cond}:\n    ${2:pass}", snippet: true },
  { label: "else", kind: 14, insertText: "else:\n    ${1:pass}", snippet: true },
  { label: "for", kind: 14, insertText: "for ${1:i} in ${2:range(10)}:\n    ${3:pass}", snippet: true },
  { label: "while", kind: 14, insertText: "while ${1:cond}:\n    ${2:pass}", snippet: true },
  { label: "return", kind: 14, insertText: "return ${1}", snippet: true },
  { label: "import", kind: 14, insertText: "import ${1:math}", snippet: true },
  { label: "from", kind: 14, insertText: "from ${1:math} import ${2:sqrt}", snippet: true },
  { label: "try", kind: 14, insertText: "try:\n    ${1}\nexcept ${2:Exception}:\n    ${3:pass}", snippet: true },
  { label: "True", kind: 12, insertText: "True" },
  { label: "False", kind: 12, insertText: "False" },
  { label: "None", kind: 12, insertText: "None" },
  { label: "and", kind: 17, insertText: "and " },
  { label: "or", kind: 17, insertText: "or " },
  { label: "not", kind: 17, insertText: "not " },
  { label: "in", kind: 17, insertText: "in " },
  { label: "list", kind: 7, insertText: "list(${1})", snippet: true },
  { label: "dict", kind: 7, insertText: "dict(${1})", snippet: true },
  { label: "set", kind: 7, insertText: "set(${1})", snippet: true },
  { label: "f-string", kind: 14, detail: "шаблон", insertText: 'f"${1:text} {${2:value}}"', snippet: true, filterText: "fstring f-string" },
];

const JAVA: ItemDef[] = [
  { label: "System.out.println", kind: 1, detail: "void", doc: "Печать строки + перевод строки", insertText: "System.out.println(${1});", snippet: true, filterText: "System.out.println sout println print" },
  { label: "System.out.print", kind: 1, insertText: "System.out.print(${1});", snippet: true, filterText: "System.out.print" },
  { label: "public class Main", kind: 7, insertText: "public class Main {\n  public static void main(String[] args) {\n    ${1}\n  }\n}", snippet: true, filterText: "main class" },
  { label: "public static void main", kind: 1, insertText: "public static void main(String[] args) {\n  ${1}\n}", snippet: true },
  { label: "static int", kind: 14, insertText: "static int ${1:name}(${2}) {\n  return ${3:0};\n}", snippet: true },
  { label: "int", kind: 6, insertText: "int " },
  { label: "double", kind: 6, insertText: "double " },
  { label: "boolean", kind: 6, insertText: "boolean " },
  { label: "String", kind: 6, insertText: "String " },
  { label: "if", kind: 14, insertText: "if (${1:cond}) {\n  ${2}\n}", snippet: true },
  { label: "else", kind: 14, insertText: "else {\n  ${1}\n}", snippet: true },
  { label: "for", kind: 14, insertText: "for (int ${1:i} = 0; ${1:i} < ${2:n}; ${1:i}++) {\n  ${3}\n}", snippet: true },
  { label: "while", kind: 14, insertText: "while (${1:cond}) {\n  ${2}\n}", snippet: true },
  { label: "return", kind: 14, insertText: "return ${1};", snippet: true },
  { label: "new", kind: 14, insertText: "new ${1:Type}(${2})", snippet: true },
  { label: "Integer.parseInt", kind: 1, insertText: "Integer.parseInt(${1})", snippet: true, filterText: "parseInt Integer" },
];

const CPP: ItemDef[] = [
  { label: "cout", kind: 1, detail: "ostream", doc: "`cout << x << endl;` — вывод", insertText: "cout << ${1} << endl;", snippet: true, filterText: "cout" },
  { label: "cin", kind: 1, insertText: "cin >> ${1};", snippet: true },
  { label: "endl", kind: 1, insertText: "endl", filterText: "endl" },
  { label: "int", kind: 6, insertText: "int " },
  { label: "double", kind: 6, insertText: "double " },
  { label: "string", kind: 6, insertText: "string " },
  { label: "bool", kind: 6, insertText: "bool " },
  { label: "vector", kind: 7, insertText: "vector<${1:int}>", snippet: true, filterText: "vector" },
  { label: "if", kind: 14, insertText: "if (${1:cond}) {\n  ${2}\n}", snippet: true },
  { label: "else", kind: 14, insertText: "else {\n  ${1}\n}", snippet: true },
  { label: "for", kind: 14, insertText: "for (int ${1:i} = 0; ${1:i} < ${2:n}; ${1:i}++) {\n  ${3}\n}", snippet: true },
  { label: "while", kind: 14, insertText: "while (${1:cond}) {\n  ${2}\n}", snippet: true },
  { label: "return", kind: 14, insertText: "return ${1:0};", snippet: true },
  { label: "#include <iostream>", kind: 14, insertText: "#include <iostream>", filterText: "include iostream" },
  { label: "#include <vector>", kind: 14, insertText: "#include <vector>", filterText: "include vector" },
  { label: "#include <string>", kind: 14, insertText: "#include <string>", filterText: "include string" },
  { label: "using namespace std", kind: 14, insertText: "using namespace std;", filterText: "using namespace" },
];

const CSHARP: ItemDef[] = [
  { label: "Console", kind: 7, detail: "class", doc: "Класс для ввода-вывода в консоль", insertText: "Console", filterText: "Console conso cons" },
  { label: "Console.WriteLine", kind: 1, detail: "void WriteLine(...)", doc: "Печатает строку и перевод строки", insertText: "Console.WriteLine(${1});", snippet: true, filterText: "Console.WriteLine console.writeline writeln print" },
  { label: "Console.ReadLine", kind: 1, detail: "string ReadLine()", insertText: "Console.ReadLine()", filterText: "Console.ReadLine readline" },
  { label: "WriteLine", kind: 1, memberOf: "Console.", insertText: "WriteLine(${1});", snippet: true, filterText: "WriteLine" },
  { label: "ReadLine", kind: 1, memberOf: "Console.", insertText: "ReadLine()", filterText: "ReadLine" },
  { label: "using System", kind: 14, insertText: "using System;", filterText: "using System" },
  { label: "static void Main", kind: 1, insertText: "static void Main() {\n  ${1}\n}", snippet: true },
  { label: "static int", kind: 14, insertText: "static int ${1:Name}(${2}) {\n  return ${3:0};\n}", snippet: true },
  { label: "int", kind: 6, insertText: "int " },
  { label: "string", kind: 6, insertText: "string " },
  { label: "bool", kind: 6, insertText: "bool " },
  { label: "var", kind: 6, insertText: "var " },
  { label: "if", kind: 14, insertText: "if (${1:cond}) {\n  ${2}\n}", snippet: true },
  { label: "else", kind: 14, insertText: "else {\n  ${1}\n}", snippet: true },
  { label: "for", kind: 14, insertText: "for (int ${1:i} = 0; ${1:i} < ${2:n}; ${1:i}++) {\n  ${3}\n}", snippet: true },
  { label: "while", kind: 14, insertText: "while (${1:cond}) {\n  ${2}\n}", snippet: true },
  { label: "foreach", kind: 14, insertText: "foreach (var ${1:x} in ${2:collection}) {\n  ${3}\n}", snippet: true },
  { label: "return", kind: 14, insertText: "return ${1};", snippet: true },
  { label: "List<int>", kind: 7, insertText: "List<int>", filterText: "List list" },
  { label: "new List<int>", kind: 14, insertText: "new List<int> { ${1} }", snippet: true },
  { label: "class Program", kind: 7, insertText: "class Program {\n  static void Main() {\n    ${1}\n  }\n}", snippet: true },
  { label: "int.Parse", kind: 1, insertText: "int.Parse(${1})", snippet: true, filterText: "Parse int" },
];

const BY_LANG: Record<string, ItemDef[]> = {
  python: PYTHON,
  java: JAVA,
  cpp: CPP,
  csharp: CSHARP,
};

const HOVER: Record<string, Record<string, string>> = {
  python: {
    print: "**print(*values)** — выводит аргументы через пробел, в конце перевод строки.",
    range: "**range(n)** → 0..n-1. **range(a,b)** → a..b-1.",
    def: "**def name(params):** — объявляет функцию. Тело с отступом.",
  },
  java: {
    System: "**System.out** — стандартный вывод. `println` добавляет `\\n`.",
  },
  cpp: {
    cout: "**cout <<** отправляет данные в консоль. **endl** — перевод строки.",
  },
  csharp: {
    Console: "**Console** — ввод/вывод. **WriteLine** печатает строку с переводом строки.",
    WriteLine: "См. **Console.WriteLine(object? value)**",
  },
};

function wordRange(model: editor.ITextModel, position: Position): IRange {
  const word = model.getWordUntilPosition(position);
  return {
    startLineNumber: position.lineNumber,
    endLineNumber: position.lineNumber,
    startColumn: word.startColumn,
    endColumn: word.endColumn,
  };
}

function linePrefix(model: editor.ITextModel, position: Position): string {
  return model.getLineContent(position.lineNumber).slice(0, position.column - 1);
}

export function setupMonaco(monaco: Monaco): void {
  if (installed) return;
  installed = true;

  monaco.editor.defineTheme("vexx-dark", {
    base: "vs-dark",
    inherit: true,
    rules: [
      { token: "comment", foreground: "64748b", fontStyle: "italic" },
      { token: "keyword", foreground: "c4b5fd" },
      { token: "string", foreground: "86efac" },
      { token: "number", foreground: "fcd34d" },
      { token: "type", foreground: "5eead4" },
    ],
    colors: {
      "editor.background": "#0d1118",
      "editor.lineHighlightBackground": "#151b28",
      "editorLineNumber.foreground": "#475569",
      "editorCursor.foreground": "#5eead4",
      "editor.selectionBackground": "#1e3a5f",
      "editor.inactiveSelectionBackground": "#172554",
      "editorSuggestWidget.background": "#121826",
      "editorSuggestWidget.border": "#2d3a52",
      "editorSuggestWidget.selectedBackground": "#1e293b",
      "editorSuggestWidget.highlightForeground": "#5eead4",
      "editorHoverWidget.background": "#121826",
      "editorHoverWidget.border": "#2d3a52",
    },
  });

  const bracketPairs = [
    { open: "{", close: "}" },
    { open: "[", close: "]" },
    { open: "(", close: ")" },
    { open: '"', close: '"', notIn: ["string"] },
    { open: "'", close: "'", notIn: ["string", "comment"] },
  ];

  for (const lang of ["python", "java", "cpp", "csharp"]) {
    monaco.languages.setLanguageConfiguration(lang, {
      brackets: [["{", "}"], ["[", "]"], ["(", ")"]],
      autoClosingPairs: bracketPairs,
      surroundingPairs: [
        { open: "{", close: "}" },
        { open: "[", close: "]" },
        { open: "(", close: ")" },
        { open: '"', close: '"' },
        { open: "'", close: "'" },
      ],
      indentationRules: {
        increaseIndentPattern:
          lang === "python"
            ? /^\s*(def |class |if |elif |else:|for |while |try:|except |with ).*:\s*$/
            : /^\s*(if|else|for|while|try|catch|class|struct|namespace)\b.*\{?\s*$/,
        decreaseIndentPattern: /^\s*(else|elif|except|finally|\}|\])\s*$/,
      },
    });

    const defs = BY_LANG[lang] ?? [];

    monaco.languages.registerCompletionItemProvider(lang, {
      triggerCharacters: [".", "(", "<", '"', " ", ":"],
      provideCompletionItems(model, position) {
        const range = wordRange(model, position);
        const prefix = linePrefix(model, position);
        const suggestions = defsToSuggestions(monaco, defs, range, prefix);
        return { suggestions };
      },
    });

    const hoverMap = HOVER[lang] ?? {};
    monaco.languages.registerHoverProvider(lang, {
      provideHover(model, position) {
        const word = model.getWordAtPosition(position);
        if (!word) return null;
        let key = word.word;
        const lp = linePrefix(model, position);
        if (lp.includes("Console.") && key === "WriteLine") key = "WriteLine";
        if (lp.includes("System.out.") && key === "println") key = "System";
        const md = hoverMap[key];
        if (!md) return null;
        return {
          range: {
            startLineNumber: position.lineNumber,
            endLineNumber: position.lineNumber,
            startColumn: word.startColumn,
            endColumn: word.endColumn,
          },
          contents: [{ value: md }],
        };
      },
    });
  }
}

export const VEXX_EDITOR_OPTIONS: editor.IStandaloneEditorConstructionOptions = {
  fontFamily: "JetBrains Mono, ui-monospace, monospace",
  fontSize: 14,
  fontLigatures: true,
  minimap: { enabled: false },
  scrollBeyondLastLine: false,
  padding: { top: 12, bottom: 12 },
  lineNumbers: "on",
  folding: true,
  renderLineHighlight: "all",
  cursorBlinking: "smooth",
  cursorSmoothCaretAnimation: "on",
  smoothScrolling: true,
  bracketPairColorization: { enabled: true },
  guides: { bracketPairs: true, indentation: true },
  tabSize: 4,
  insertSpaces: true,
  detectIndentation: true,
  autoClosingBrackets: "always",
  autoClosingQuotes: "always",
  autoClosingOvertype: "always",
  autoSurround: "languageDefined",
  suggestOnTriggerCharacters: true,
  acceptSuggestionOnCommitCharacter: true,
  acceptSuggestionOnEnter: "on",
  tabCompletion: "on",
  wordBasedSuggestions: "currentDocument",
  quickSuggestions: { other: true, comments: false, strings: true },
  suggest: {
    preview: true,
    showIcons: true,
    showStatusBar: true,
    filterGraceful: true,
    localityBonus: true,
    shareSuggestSelections: true,
    snippetsPreventQuickSuggestions: false,
  },
  inlineSuggest: { enabled: false },
  parameterHints: { enabled: true },
  hover: { enabled: true, delay: 250 },
  formatOnType: false,
  links: true,
  colorDecorators: true,
};
