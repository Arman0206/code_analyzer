// Shared scoring logic, used by the API (index.js) and the CLI.
// Penalties per category are 0-100; maths.js turns them into a weighted score.
const { calculateFinalScore } = require("../maths");

const DEFAULT_COMPLEXITY_THRESHOLD = 8;
const cap = (count, perItem) => Math.min(100, count * perItem);

function computePenalties({ bugs = 0, lint = 0, security = 0, redundancy = 0, cyclomatic = 1 }, opts = {}) {
  const threshold = opts.complexityThreshold ?? DEFAULT_COMPLEXITY_THRESHOLD;
  return {
    bug: cap(bugs, 35),
    sec: cap(security, 40),
    cplx: cyclomatic > threshold ? Math.min(100, (cyclomatic - threshold) * 10) : 0,
    red: cap(redundancy, 20),
    lint: cap(lint, 10),
  };
}

function gradeFor(score) {
  return score > 85 ? "A" : score > 70 ? "B" : "C";
}

function scoreFindings(counts, opts = {}) {
  const penalties = computePenalties(counts, opts);
  const score = parseFloat(calculateFinalScore(penalties, opts.weights).toFixed(2));
  return { score, grade: gradeFor(score), penalties };
}

module.exports = { computePenalties, gradeFor, scoreFindings, DEFAULT_COMPLEXITY_THRESHOLD };