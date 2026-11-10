// Orchestrates one CLI run: collect files -> static analysis -> optional AI review -> aggregate -> gate.
const fs = require("node:fs");
const path = require("node:path");
const { analyzeDetailed } = require("../../index");
const { collectFiles, toPosix } = require("./files");
const { aggregate, evaluateGate } = require("./gate");

const AI_MAX_CHARS = 20_000; // same limit as the API
const AI_CONCURRENCY = 2;

const asIssue = (category, item, source, fallbackRule) =>
  typeof item === "string"
    ? { category, message: item, line: 0, source }
    : { category, message: item.message || item.type || fallbackRule, line: item.line || 0, rule: item.rule || item.type, source };

// Flattens the API-shaped report into one list of uniform issues.
function normalizeIssues(report, detections, threshold) {
  const issues = [];
  report.bugs.forEach((b) => issues.push(asIssue("bug", b, typeof b === "string" ? "ai" : "static", "bug")));
  report.lint.forEach((l) => issues.push(asIssue("lint", l, typeof l === "string" ? "ai" : "static", "lint")));
  detections.forEach((d) => issues.push({ category: "security", message: d.type, line: d.line, source: "static" }));
  report.security.slice(detections.length).forEach((s) => issues.push({ category: "security", message: s, line: 0, source: "ai" }));
  report.redundancy.forEach((r) => issues.push({ category: "redundancy", message: r, line: 0, source: "ai" }));
  const cyclo = report.complexity.cyclomatic || 1;
  if (cyclo > threshold) {
    issues.push({ category: "complexity", message: `Cyclomatic complexity is ${cyclo} (limit ${threshold})`, line: 0, source: "static" });
  }
  return issues;
}

async function analyzeFile(abs, rel, config, useAi) {
  const code = fs.readFileSync(abs, "utf8");
  const { report, detections } = await analyzeDetailed(code, {
    filename: rel, ai: useAi, format: false, rewrite: false,
    weights: config.weights, complexityThreshold: config.max_complexity,
  });
  return {
    file: rel, language: report.language, lines: code.split("\n").length, chars: code.length,
    score: report.score, grade: report.grade, aiUsed: report.aiUsed,
    cyclomatic: report.complexity.cyclomatic || 1,
    issues: normalizeIssues(report, detections, config.max_complexity),
  };
}

async function pool(items, limit, worker) {
  let next = 0;
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (next < items.length) await worker(items[next++]);
  }));
}

async function analyzeProject({ targets, config, cwd = process.cwd(), ai = false, changedRef, env = process.env }) {
  const warnings = [];
  const { files, skipped, changedFallback } = collectFiles({ targets, config, cwd, changedRef });
  if (changedFallback) warnings.push(changedFallback);

  const results = [];
  for (const abs of files) {
    const rel = toPosix(path.relative(cwd, abs));
    try { results.push(await analyzeFile(abs, rel, config, false)); }
    catch (e) { skipped.push({ file: rel, reason: e.message }); }
  }

  let aiFiles = 0;
  if (ai) {
    if (!env.GROQ_API_KEY) {
      warnings.push("AI review requested but GROQ_API_KEY is not set. Ran static analysis only.");
    } else {
      // Spend the AI budget on the files that need it most: lowest static score first.
      const targetsForAi = results.filter((r) => r.chars <= AI_MAX_CHARS)
        .sort((a, b) => a.score - b.score).slice(0, config.ai_max_files);
      await pool(targetsForAi, AI_CONCURRENCY, async (r) => {
        try {
          const upgraded = await analyzeFile(path.resolve(cwd, r.file), r.file, config, true);
          if (upgraded.aiUsed) { results[results.indexOf(r)] = upgraded; aiFiles++; }
          else warnings.push(`AI review failed for ${r.file}; kept the static result.`);
        } catch (e) { warnings.push(`AI review failed for ${r.file}: ${e.message}`); }
      });
    }
  }

  const { score, lines } = aggregate(results);
  const gate = evaluateGate(results, config, score);
  return {
    summary: { score, grade: scoreGrade(score), files: results.length, lines, aiFiles },
    gate: { ...gate, thresholds: { min_score: config.min_score, min_file_score: config.min_file_score ?? null, fail_on_security: config.fail_on_security } },
    files: results, skipped, warnings,
  };
}

const scoreGrade = (s) => (s > 85 ? "A" : s > 70 ? "B" : "C");

module.exports = { analyzeProject, normalizeIssues };