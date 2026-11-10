// The quality gate: turns analysis results + config thresholds into pass/fail with human-readable reasons.
function aggregate(results) {
  if (!results.length) return { score: 100, grade: "A", lines: 0 };
  // Weighted by line count so a 5-line file can't mask a 2,000-line one.
  const totalLines = results.reduce((s, r) => s + Math.max(r.lines, 1), 0);
  const score = results.reduce((s, r) => s + r.score * Math.max(r.lines, 1), 0) / totalLines;
  const rounded = parseFloat(score.toFixed(2));
  return { score: rounded, lines: totalLines };
}

function evaluateGate(results, config, overallScore) {
  const failures = [];
  if (overallScore < config.min_score) {
    failures.push(`Overall score ${overallScore} is below min_score ${config.min_score}`);
  }
  if (config.min_file_score != null) {
    const bad = results.filter((r) => r.score < config.min_file_score);
    for (const r of bad) failures.push(`${r.file} scored ${r.score}, below min_file_score ${config.min_file_score}`);
  }
  if (config.fail_on_security) {
    const total = results.reduce((s, r) => s + r.issues.filter((i) => i.category === "security").length, 0);
    if (total > 0) failures.push(`${total} security finding${total === 1 ? "" : "s"} found (fail_on_security is on)`);
  }
  return { passed: failures.length === 0, failures };
}

module.exports = { aggregate, evaluateGate };