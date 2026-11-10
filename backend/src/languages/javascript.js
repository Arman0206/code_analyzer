const acorn = require("acorn");
const walk = require("acorn-walk");

// Every binding introduced by a declaration target: `a`, `{ a, b: c, ...r }`, `[x, , y = 1]`.
function collectNames(pattern, out) {
  if (!pattern) return;
  switch (pattern.type) {
    case "Identifier": out.push({ name: pattern.name, line: pattern.loc?.start.line }); break;
    case "ObjectPattern":
      pattern.properties.forEach((p) => collectNames(p.type === "RestElement" ? p.argument : p.value, out)); break;
    case "ArrayPattern": pattern.elements.forEach((e) => collectNames(e, out)); break;
    case "RestElement": collectNames(pattern.argument, out); break;
    case "AssignmentPattern": collectNames(pattern.left, out); break;
  }
}

const BRANCHES = [
  "IfStatement", "ForStatement", "ForInStatement", "ForOfStatement", "WhileStatement",
  "DoWhileStatement", "ConditionalExpression", "CatchClause",
];

// Cyclomatic complexity of ONE unit of code (a function body, or the top level of a file).
// Nested functions are not descended into: they are separate units with their own score.
function unitComplexity(root) {
  let count = 1;
  const visitors = { Function() {} }; // prune nested functions
  const hit = (node, st, c) => { count++; walk.base[node.type](node, st, c); };
  BRANCHES.forEach((t) => { visitors[t] = hit; });
  visitors.SwitchCase = (node, st, c) => { if (node.test) count++; walk.base.SwitchCase(node, st, c); };
  visitors.LogicalExpression = (node, st, c) => {
    if (node.operator === "&&" || node.operator === "||" || node.operator === "??") count++;
    walk.base.LogicalExpression(node, st, c);
  };
  walk.recursive(root, null, visitors);
  return count;
}

module.exports = function analyzeJS(code, report) {
  let ast;
  try {
    ast = acorn.parse(code, { ecmaVersion: "latest", sourceType: "module", locations: true });
  } catch (err) {
    report.bugs.push({ type: "SyntaxError", message: err.message, line: err.loc?.line || 0, severity: "error" });
    return;
  }

  const declared = new Map(), used = new Set();
  const units = [unitComplexity(ast)];
  const fn = (node) => units.push(unitComplexity(node.body));
  walk.simple(ast, {
    VariableDeclarator(node) {
      const names = []; collectNames(node.id, names);
      names.forEach(({ name, line }) => { if (!declared.has(name)) declared.set(name, line); });
    },
    Identifier(node) { used.add(node.name); },
    FunctionDeclaration: fn, FunctionExpression: fn, ArrowFunctionExpression: fn,
  });

  declared.forEach((line, v) => {
    if (!used.has(v)) report.lint.push({ rule: "no-unused-vars", message: `Variable '${v}' declared but never used`, line: line || 0, severity: "warning" });
  });
  // Report the most complex single function (or the top level), the number that actually predicts "hard to maintain".
  report.complexity.cyclomatic = Math.max(...units);
};