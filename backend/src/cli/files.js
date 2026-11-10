// File discovery: walk directories, apply include/exclude globs, optionally restrict to git-changed files.
const fs = require("node:fs");
const path = require("node:path");
const { execFileSync } = require("node:child_process");

const SUPPORTED = /\.(js|mjs|cjs|py|java|cpp|cc|c|h|hpp)$/;

// Minimal glob -> RegExp: `**` any depth, `*` within a segment, `?` one char.
function globToRegExp(glob) {
  let re = "";
  for (let i = 0; i < glob.length; i++) {
    const ch = glob[i];
    if (ch === "*") {
      if (glob[i + 1] === "*") {
        i++;
        if (glob[i + 1] === "/") { i++; re += "(?:.*/)?"; } else re += ".*";
      } else re += "[^/]*";
    } else if (ch === "?") re += "[^/]";
    else re += ch.replace(/[.+^${}()|[\]\\]/g, "\\$&");
  }
  return new RegExp(`^${re}$`);
}

// A pattern with no "/" matches any single path segment (so "node_modules" excludes it at any depth).
// A pattern with "/" is matched against the whole relative path, and also covers everything beneath it.
function makeMatcher(globs) {
  const compiled = globs.map((g) => {
    const clean = g.replace(/^\.\//, "").replace(/\/+$/, "");
    return { hasSlash: clean.includes("/"), re: globToRegExp(clean) };
  });
  return (relPath) => {
    const segments = relPath.split("/");
    return compiled.some(({ hasSlash, re }) => {
      if (!hasSlash) return segments.some((seg) => re.test(seg));
      return segments.some((_, i) => re.test(segments.slice(0, i + 1).join("/")));
    });
  };
}

const toPosix = (p) => p.split(path.sep).join("/");

function walk(dir, out, isExcluded, cwd) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const abs = path.join(dir, entry.name);
    const rel = toPosix(path.relative(cwd, abs));
    if (isExcluded(rel)) continue;
    if (entry.isDirectory()) walk(abs, out, isExcluded, cwd);
    else if (entry.isFile()) out.push(abs);
  }
}

function changedFiles(ref, cwd) {
  if (!/^[\w./@^~-]+$/.test(ref) || ref.startsWith("-")) throw new Error(`Invalid git ref: ${ref}`);
  const run = (range) => execFileSync(
    "git", ["diff", "--name-only", "--relative", "--diff-filter=ACMR", range, "--"],
    { cwd, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] });
  let out;
  try { out = run(`${ref}...HEAD`); } catch { out = run(ref); }
  return out.split("\n").filter(Boolean).map((f) => path.resolve(cwd, f));
}

/**
 * @returns {{ files: string[], skipped: {file: string, reason: string}[], changedFallback?: string }}
 */
function collectFiles({ targets, config, cwd, changedRef }) {
  const isExcluded = makeMatcher(config.exclude);
  const isIncluded = config.include.length ? makeMatcher(config.include) : () => true;

  const found = new Set();
  for (const t of targets) {
    const abs = path.resolve(cwd, t);
    if (!fs.existsSync(abs)) throw new Error(`Path not found: ${t}`);
    if (fs.statSync(abs).isDirectory()) { const acc = []; walk(abs, acc, isExcluded, cwd); acc.forEach((f) => found.add(f)); }
    else found.add(abs);
  }

  let candidates = [...found];
  let changedFallback;
  if (changedRef) {
    try {
      const changed = new Set(changedFiles(changedRef, cwd));
      candidates = candidates.filter((f) => changed.has(f));
    } catch (e) {
      changedFallback = `Could not diff against "${changedRef}" (${String(e.message).split("\n")[0]}). Analyzing all files instead.`;
    }
  }

  const files = [], skipped = [];
  for (const abs of candidates.sort()) {
    const rel = toPosix(path.relative(cwd, abs));
    if (!SUPPORTED.test(rel)) continue;
    if (isExcluded(rel) || !isIncluded(rel)) continue;
    if (fs.statSync(abs).size > config.max_file_kb * 1024) { skipped.push({ file: rel, reason: `larger than ${config.max_file_kb} KB` }); continue; }
    files.push(abs);
  }
  return { files, skipped, changedFallback };
}

module.exports = { collectFiles, makeMatcher, globToRegExp, SUPPORTED, toPosix };