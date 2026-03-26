const js = require("./languages/javascript");
const py = require("./languages/python");
const java = require("./languages/java");
const cpp = require("./languages/cpp");

function detect(code, filename = "") {
  if (filename) {
    if (filename.endsWith(".js")) return { lang: "javascript", confidence: 0.95 };
    if (filename.endsWith(".py")) return { lang: "python", confidence: 0.95 };
    if (filename.endsWith(".java")) return { lang: "java", confidence: 0.95 };
    if (filename.endsWith(".cpp") || filename.endsWith(".c")) return { lang: "cpp", confidence: 0.95 };
  }
  if (code.includes("def ") && code.includes(":")) return { lang: "python", confidence: 0.6 };
 // if (code.includes("const ") || code.includes("let ") || code.includes("=>")) return { lang: "javascript", confidence: 0.6 };
  if (code.includes("const ") || code.includes("let ") || code.includes("=>") || code.includes("var ") || code.includes("function ") || code.includes("console.log")) return { lang: "javascript", confidence: 0.6 };
 if (code.includes("public static void main")) return { lang: "java", confidence: 0.8 };
  if (code.includes("#include ")) return { lang: "cpp", confidence: 0.8 };
  return { lang: "unknown", confidence: 0 };
}

async function route(code, filename = "") {
  const { lang, confidence } = detect(code, filename);
  if (lang === "unknown") throw new Error("Unsupported language or syntax.");

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
module.exports = { route };