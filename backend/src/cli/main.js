const fs = require("node:fs");
const path = require("node:path");
const { parseArgs } = require("node:util");
const { loadConfig, ConfigError } = require("./config");
const { analyzeProject } = require("./run");
const { toText, toMarkdown, toJson } = require("./report");

const HELP = `code-analyzer: static + AI code review with a CI quality gate

Usage: code-analyzer [paths...] [options]      (default path: .)

Options:
  --config <file>         Config file (default: .analyzer.yml if present)
  --min-score <0-100>     Override min_score from the config
  --changed <git-ref>     Only analyze files changed since <git-ref> (e.g. origin/main)
  --ai                    Add an LLM review for the weakest files (needs GROQ_API_KEY)
  --format <text|json|markdown>   Stdout format (default: text)
  --markdown-file <file>  Also write the Markdown report here
  --json-file <file>      Also write the JSON report here
  -h, --help              Show this help
  -v, --version           Show version

Exit codes: 0 gate passed, 1 gate failed, 2 usage or config error`;

const OPTIONS = {
  config: { type: "string" }, "min-score": { type: "string" }, changed: { type: "string" },
  ai: { type: "boolean" }, format: { type: "string", default: "text" },
  "markdown-file": { type: "string" }, "json-file": { type: "string" },
  help: { type: "boolean", short: "h" }, version: { type: "boolean", short: "v" },
};
const FORMATS = ["text", "json", "markdown"];

function parseMinScore(raw) {
  const n = Number(raw);
  if (!Number.isFinite(n) || n < 0 || n > 100) throw new ConfigError("--min-score must be a number between 0 and 100");
  return n;
}

function render(result, format, { color, aiRequested }) {
  if (format === "json") return toJson(result);
  if (format === "markdown") return toMarkdown(result);
  return toText(result, { color, aiRequested });
}

function writeReports(result, values, cwd) {
  if (values["markdown-file"]) fs.writeFileSync(path.resolve(cwd, values["markdown-file"]), toMarkdown(result));
  if (values["json-file"]) fs.writeFileSync(path.resolve(cwd, values["json-file"]), toJson(result));
}

async function execute({ values, positionals }, { cwd, env, stdout }) {
  const { config } = loadConfig(cwd, values.config);
  if (values["min-score"] !== undefined) config.min_score = parseMinScore(values["min-score"]);
  const aiRequested = Boolean(values.ai ?? config.ai);
  const result = await analyzeProject({
    targets: positionals.length ? positionals : ["."], config, cwd, ai: aiRequested, changedRef: values.changed, env,
  });
  const color = Boolean(stdout.isTTY) && !env.NO_COLOR;
  stdout.write(render(result, values.format, { color, aiRequested }));
  writeReports(result, values, cwd);
  return result.gate.passed ? 0 : 1;
}

async function main(argv, { cwd = process.cwd(), env = process.env, stdout = process.stdout, stderr = process.stderr } = {}) {
  let parsed;
  try { parsed = parseArgs({ args: argv, allowPositionals: true, options: OPTIONS }); }
  catch (e) { stderr.write(`${e.message}\n\n${HELP}\n`); return 2; }

  const { values } = parsed;
  if (values.help) { stdout.write(HELP + "\n"); return 0; }
  if (values.version) { stdout.write(require("../../package.json").version + "\n"); return 0; }
  if (!FORMATS.includes(values.format)) { stderr.write(`Unknown --format "${values.format}"\n`); return 2; }

  try { return await execute(parsed, { cwd, env, stdout }); }
  catch (e) {
    stderr.write(`${e instanceof ConfigError ? "Config error" : "Error"}: ${e.message}\n`);
    return 2;
  }
}

module.exports = { main, HELP };