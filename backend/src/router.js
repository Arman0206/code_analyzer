const js = require("./languages/javascript");
const py = require("./languages/python");
const java = require("./languages/java");
const cpp = require("./languages/cpp");

function detect(code, filename = "") {
  if (filename) {
   if (/\.(js|mjs|cjs)$/.test(filename)) return { lang: "javascript", confidence: 0.95 };
    if (filename.endsWith(".py")) return { lang: "python", confidence: 0.95 };
    if (filename.endsWith(".java")) return { lang: "java", confidence: 0.95 };
    if (/\.(cpp|cc|c|h|hpp)$/.test(filename)) return { lang: "cpp", confidence: 0.95 };
  }
  // Most unique signals first; generic JS keywords (const/let/function) come LAST.
  if (/^\s*#include\s*[<"]/m.test(code)) return { lang: "cpp", confidence: 0.85 };
  if (
    /\b(public|private|protected)\s+(static\s+)?(final\s+)?(class|interface|enum)\b/.test(code) ||
    /public\s+static\s+void\s+main/.test(code) ||
    /System\.out\.print/.test(code)
  ) return { lang: "java", confidence: 0.85 };
  if (/^\s*def\s+\w+\s*\(.*\)\s*:/m.test(code) || /^\s*(elif\b.*:|print\()/m.test(code))
    return { lang: "python", confidence: 0.7 };
  if (/\b(const|let|var|function)\b|=>|console\.log/.test(code)) return { lang: "javascript", confidence: 0.6 };
  return { lang: "unknown", confidence: 0 };
}

async function route(code, filename = "") {
  const { lang, confidence } = detect(code, filename);
  if (lang === "unknown")
    throw Object.assign(new Error("Unsupported language or syntax."), { status: 422 });

  const report = {
    language: lang, confidence: confidence, score: 100, grade: "A+",
    bugs: [], lint: [], security: [], complexity: {}, redundancy: [],
    suggestions: [], formatted: code, diff: "",
    metadata: { fileName: filename || "raw_snippet", lines: code.split("\n").length }
  };

  switch(lang) {
    case "javascript": await js(code, report); break;
    case "python": await py(code, report); break;
    case "java": await java(code, report); break;
    case "cpp": await cpp(code, report); break;
  }
  return report;
}
module.exports = { route, detect };