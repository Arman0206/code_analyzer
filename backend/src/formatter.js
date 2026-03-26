const prettier = require("prettier");
function basicBraceFormatter(code) {
  const lines = code.split("\n");
  let indent = 0;
  const out = [];
  for (let line of lines) {
    line = line.trim();
    if (line.endsWith("}")) indent--;
    out.push("  ".repeat(Math.max(indent, 0)) + line);
    if (line.endsWith("{")) indent++;
  }
  return out.join("\n");
}
function formatCode(code, lang) {
  try {
    if (lang === "javascript") return prettier.format(code, { parser: "babel" });
    return basicBraceFormatter(code);
  } catch {
    return code;
  }
}
module.exports = formatCode;