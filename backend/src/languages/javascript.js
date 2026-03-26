const acorn = require("acorn");
const walk = require("acorn-walk");
module.exports = function analyzeJS(code, report) {
  let ast;
  try {
    ast = acorn.parse(code, { ecmaVersion: "latest", sourceType: "module", locations: true });
  } catch (err) {
    report.bugs.push({ type: "SyntaxError", message: err.message, line: err.loc?.line || 0, severity: "error" });
    return;
  }
  let complexity = 0;
  const declared = new Set(), used = new Set();
  walk.simple(ast, {
    VariableDeclarator(node) { declared.add(node.id.name); },
    Identifier(node) { used.add(node.name); },
    IfStatement() { complexity++; }, ForStatement() { complexity++; },
    WhileStatement() { complexity++; }, SwitchCase() { complexity++; },
    LogicalExpression(node) { if (node.operator === "&&" || node.operator === "||") complexity++; }
  });
  declared.forEach((v) => {
    if (!used.has(v)) report.lint.push({ rule: "no-unused-vars", message: `Variable '${v}' declared but never used`, severity: "warning" });
  });
  report.complexity.cyclomatic = complexity + 1;
};