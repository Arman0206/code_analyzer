// Output formats: terminal text, GitHub-flavoured Markdown (PR comment), JSON.
const MARKER = "<!-- code-analyzer-report -->"; // lets the Action find and update its own comment
const CATEGORY_ORDER = ["security", "bug", "complexity", "redundancy", "lint"];

const plural = (n, word) => `${n} ${word}${n === 1 ? "" : "s"}`;
const rank = (c) => CATEGORY_ORDER.indexOf(c);
function allIssues(result) {
  return result.files.flatMap((f) => f.issues.map((i) => ({ ...i, file: f.file })))
    .sort((a, b) => rank(a.category) - rank(b.category) || a.file.localeCompare(b.file) || a.line - b.line);
}
function counts(file) {
  const c = Object.fromEntries(CATEGORY_ORDER.map((k) => [k, 0]));
  file.issues.forEach((i) => c[i.category]++);
  return c;
}
const worstFirst = (files) => [...files].sort((a, b) => a.score - b.score || a.file.localeCompare(b.file));

// ---- terminal ----
function toText(result, { color = false, aiRequested = false } = {}) {
  const paint = (code, s) => (color ? `\x1b[${code}m${s}\x1b[0m` : s);
  const dim = (s) => paint(2, s), bold = (s) => paint(1, s);
  const gradeColor = (g, s) => paint(g === "A" ? 32 : g === "B" ? 33 : 31, s);
  const { summary, gate } = result;
  const out = [];

  out.push(bold("Code Analyzer") + dim(`  ${plural(summary.files, "file")} · ${plural(summary.lines, "line")} · AI review: ${summary.aiFiles ? `${summary.aiFiles} files` : aiRequested ? "unavailable" : "off"}`));
  out.push("");
  const shown = worstFirst(result.files).slice(0, 20);
  const width = Math.min(60, Math.max(10, ...shown.map((f) => f.file.length)));
  for (const f of shown) {
    const c = counts(f);
    const parts = CATEGORY_ORDER.filter((k) => c[k]).map((k) => `${c[k]} ${k}`);
    out.push(`  ${gradeColor(f.grade, String(f.score.toFixed(1)).padStart(5))} ${gradeColor(f.grade, f.grade)}  ${f.file.padEnd(width)}  ${dim(parts.join(" · ") || "clean")}`);
  }
  if (result.files.length > shown.length) out.push(dim(`  … and ${result.files.length - shown.length} more files`));

  const issues = allIssues(result);
  if (issues.length) {
    out.push("", bold("Top issues"));
    for (const i of issues.slice(0, 15)) {
      const loc = i.line ? `${i.file}:${i.line}` : i.file;
      out.push(`  ${paint(i.category === "security" || i.category === "bug" ? 31 : 33, i.category.padEnd(10))} ${loc}  ${dim(i.message)}`);
    }
    if (issues.length > 15) out.push(dim(`  … and ${issues.length - 15} more`));
  }
  for (const s of result.skipped) out.push(dim(`  skipped ${s.file}: ${s.reason}`));
  for (const w of result.warnings) out.push(paint(33, `  warning: ${w}`));

  out.push("", `${bold("Overall")} ${gradeColor(summary.grade, `${summary.score} (${summary.grade})`)}  ·  gate: ${gate.passed ? paint(32, "PASSED") : paint(31, "FAILED")}`);
  gate.failures.forEach((f) => out.push(paint(31, `  ✗ ${f}`)));
  return out.join("\n") + "\n";
}

// ---- markdown ----
// Issue text can come from an LLM or from file names, so neutralise HTML, backticks and @mentions.
const clean = (s) => String(s).replace(/[<>]/g, "").replace(/`/g, "'").replace(/@/g, "@\u200b").replace(/\s+/g, " ").trim();

function toMarkdown(result) {
  const { summary, gate } = result;
  const t = gate.thresholds;
  const out = [MARKER];
  out.push(`## ${gate.passed ? "✅" : "❌"} Code Analyzer: ${gate.passed ? "passed" : "failed"} (${summary.score}/100, grade ${summary.grade})`, "");
  out.push(`${plural(summary.files, "file")} · ${plural(summary.lines, "line")} · AI review: ${summary.aiFiles ? `${summary.aiFiles} files` : "off"} · required: **${t.min_score}**${t.min_file_score != null ? ` overall, **${t.min_file_score}** per file` : ""}${t.fail_on_security ? " · security findings fail the build" : ""}`, "");
  if (gate.failures.length) out.push(...gate.failures.map((f) => `- ❌ ${clean(f)}`), "");

  const files = worstFirst(result.files);
  if (files.length) {
    out.push("| File | Score | Security | Bugs | Complexity | Redundancy | Lint |", "|---|---:|---:|---:|---:|---:|---:|");
    for (const f of files.slice(0, 25)) {
      const c = counts(f);
      out.push(`| \`${clean(f.file)}\` | ${f.score.toFixed(1)} (${f.grade}) | ${c.security} | ${c.bug} | ${c.complexity} | ${c.redundancy} | ${c.lint} |`);
    }
    if (files.length > 25) out.push(`| _…and ${files.length - 25} more files_ | | | | | | |`);
    out.push("");
  } else out.push("_No supported files to analyze._", "");

  const issues = allIssues(result);
  if (issues.length) {
    out.push(`<details><summary>Top issues (${issues.length})</summary>`, "");
    for (const i of issues.slice(0, 30)) out.push(`- **${i.category}** \`${clean(i.file)}${i.line ? `:${i.line}` : ""}\` ${clean(i.message)}`);
    if (issues.length > 30) out.push(`- _…and ${issues.length - 30} more_`);
    out.push("", "</details>", "");
  }
  result.warnings.forEach((w) => out.push(`> ⚠️ ${clean(w)}`));
  return out.join("\n") + "\n";
}

function toJson(result) { return JSON.stringify(result, null, 2) + "\n"; }

module.exports = { toText, toMarkdown, toJson, MARKER };