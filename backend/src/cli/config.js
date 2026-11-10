// Loads and validates .analyzer.yml. Invalid config fails loudly (exit code 2), never silently.
const fs = require("node:fs");
const path = require("node:path");
const YAML = require("yaml");
const { z } = require("zod");
const { DEFAULT_COMPLEXITY_THRESHOLD } = require("../scoring");

const DEFAULT_WEIGHTS = { bug: 0.3, sec: 0.3, cplx: 0.2, red: 0.1, lint: 0.1 };
const DEFAULT_EXCLUDE = [
  "node_modules", ".git", "dist", "build", "coverage", "vendor",
  "__pycache__", "venv", ".venv", "*.min.js",
];

const score = z.number().min(0).max(100);
const ConfigSchema = z.object({
  min_score: score.default(70),            // gate: overall (line-weighted) score must be >= this
  min_file_score: score.optional(),        // gate: every single file must be >= this
  fail_on_security: z.boolean().default(false), // gate: any security finding fails the run
  max_complexity: z.number().int().min(1).default(DEFAULT_COMPLEXITY_THRESHOLD), // cyclomatic points above this are penalised
  include: z.array(z.string()).default([]),      // optional globs; empty = every supported file
  exclude: z.array(z.string()).default([]),      // globs, added to the defaults
  max_file_kb: z.number().positive().default(500),
  ai: z.boolean().default(false),          // LLM review (needs GROQ_API_KEY), opt-in
  ai_max_files: z.number().int().min(0).default(10), // only the lowest-scoring files get AI review
  weights: z.object({
    bug: z.number().min(0), sec: z.number().min(0), cplx: z.number().min(0),
    red: z.number().min(0), lint: z.number().min(0),
  }).partial().default({}),
}).strict(); // typos like "min_scor" are errors, not silently ignored

class ConfigError extends Error {}

function parseConfig(text, source = ".analyzer.yml") {
  let raw;
  try { raw = YAML.parse(text) ?? {}; }
  catch (e) { throw new ConfigError(`${source}: invalid YAML: ${e.message}`); }
  if (typeof raw !== "object" || Array.isArray(raw)) throw new ConfigError(`${source}: expected a mapping at the top level`);

  const parsed = ConfigSchema.safeParse(raw);
  if (!parsed.success) {
    const problems = parsed.error.issues.map((i) => `  - ${i.path.join(".") || "(root)"}: ${i.message}`).join("\n");
    throw new ConfigError(`${source} is invalid:\n${problems}`);
  }
  const cfg = parsed.data;
  const weights = { ...DEFAULT_WEIGHTS, ...cfg.weights };
  const sum = Object.values(weights).reduce((a, b) => a + b, 0);
  if (Math.abs(sum - 1) > 0.001) {
    throw new ConfigError(`${source}: weights must sum to 1.0 (got ${sum.toFixed(2)} after merging with defaults ${JSON.stringify(DEFAULT_WEIGHTS)})`);
  }
  return { ...cfg, weights, exclude: [...DEFAULT_EXCLUDE, ...cfg.exclude] };
}

// Returns { config, file } where file is null when no config exists (defaults are used).
function loadConfig(cwd, explicitPath) {
  const candidates = explicitPath
    ? [path.resolve(cwd, explicitPath)]
    : [".analyzer.yml", ".analyzer.yaml"].map((f) => path.join(cwd, f));
  for (const file of candidates) {
    if (fs.existsSync(file)) {
      return { config: parseConfig(fs.readFileSync(file, "utf8"), path.relative(cwd, file) || file), file };
    }
  }
  if (explicitPath) throw new ConfigError(`Config file not found: ${explicitPath}`);
  return { config: parseConfig("", "defaults"), file: null };
}

module.exports = { loadConfig, parseConfig, ConfigError, DEFAULT_WEIGHTS, DEFAULT_EXCLUDE };