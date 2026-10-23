/** Empty editor when opening a lesson — example stays in the theory panel only. */
export function blankCodeForEditor(editorLang: string): string {
  switch (editorLang) {
    case "java":
      return `public class Main {\n  public static void main(String[] args) {\n\n  }\n}\n`;
    case "cpp":
      return `#include <iostream>\nusing namespace std;\n\nint main() {\n\n  return 0;\n}\n`;
    case "csharp":
      return `using System;\n\nclass Program {\n  static void Main() {\n\n  }\n}\n`;
    default:
      return "";
  }
}
