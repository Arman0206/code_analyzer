module.exports = function analyzePython(code, report) {
  const lines = code.split("\n");
  let complexity = 0, declared = new Set(), used = new Set(), indentStack = [0];
  lines.forEach((line, idx) => {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) return;
    if (trimmed.startsWith("if ") || trimmed.startsWith("elif ") || trimmed.startsWith("for ") || trimmed.startsWith("while ") || trimmed.includes(" and ") || trimmed.includes(" or ")) complexity++;
    const varMatch = trimmed.match(/^([a-zA-Z_][a-zA-Z0-9_]*)\s*=/);
    if (varMatch) declared.add(varMatch[1]);
    declared.forEach((v) => { if (trimmed.includes(v)) used.add(v); });
    const indent = line.search(/\S|$/);
    if (indent > indentStack[indentStack.length - 1]) {
      indentStack.push(indent);
      if (indentStack.length - 1 > 3) report.lint.push({ rule: "deep-nesting", message: `Nesting level > 3 at line ${idx + 1}`, severity: "warning" });
    } else {
      while (indent < indentStack[indentStack.length - 1]) indentStack.pop();
    }
  });
  declared.forEach((v) => {
    if (!used.has(v)) report.lint.push({ rule: "unused-variable", message: `Variable '${v}' assigned but never used`, severity: "warning" });
  });
  report.complexity.cyclomatic = complexity + 1;
};