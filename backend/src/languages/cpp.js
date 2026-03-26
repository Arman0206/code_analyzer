module.exports = function analyzeCPP(code, report) {
  const lines = code.split("\n");
  let complexity = 0;
  lines.forEach((line, index) => {
    if (line.includes("if(") || line.includes("if (") || line.includes("for(") || line.includes("for (") || line.includes("while(") || line.includes("while (") || line.includes("case ")) {
      complexity++;
    }
    if (line.includes("goto ")) {
      report.lint.push({ rule: "no-goto", message: "Avoid using 'goto'", line: index + 1, severity: "warning" });
    }
  });
  report.complexity.cyclomatic = complexity + 1;
};