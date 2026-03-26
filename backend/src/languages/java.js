const { parse } = require("java-parser");
module.exports = function analyzeJava(code, report) {
  let cst;
  try { cst = parse(code); } catch (err) {
    report.bugs.push({ type: "SyntaxError", message: err.message, severity: "error" });
    return;
  }
  let complexity = 0;
  function walk(node) {
    if (!node) return;
    if (node.name === "ifStatement" || node.name === "forStatement" || node.name === "whileStatement" || node.name === "switchStatement") complexity++;
    if (node.children) {
      Object.values(node.children).forEach(childArr => { childArr.forEach(walk); });
    }
  }
  walk(cst);
  report.complexity.cyclomatic = complexity + 1;
};