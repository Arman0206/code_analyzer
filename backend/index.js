require("dotenv").config({ quiet: true }); // quiet: dotenv v17 logs to stdout, which would corrupt CLI --format json
const Groq = require('groq-sdk');
const { redactAndDetect } = require('./security');
const { scoreFindings } = require('./src/scoring');
const router = require("./src/router");
const diffEngine = require("./src/diff");
const formatCode = require("./src/formatter");
const { z } = require("zod");

// A hung AI call should not hang your API: fail after 20s, retry twice on 429/5xx.
// Created lazily so the CLI can run offline (static analysis only) without a GROQ_API_KEY.
let groqClient;
function getGroq() {
    if (!groqClient) groqClient = new Groq({ apiKey: process.env.GROQ_API_KEY, timeout: 20_000, maxRetries: 2 });
    return groqClient;
}

// Never trust LLM output: validate its shape. Anything malformed becomes a safe default.
const strList = z.array(z.string()).catch([]);
const AiSchema = z.object({
  bugs: strList, lint: strList, redundancy: strList, aiSecurity: strList,
  suggestions: z.array(z.object({ line: z.coerce.number().catch(0), fix: z.string() })).catch([]),
  formatted: z.string().catch(""),
});

async function getDeepAnalysis(cleanCode, detections, baseReport, { rewrite = true } = {}) {
    // The CLI skips the full-file rewrite (tasks 4-5): it is slow, token-heavy, and unused there.
    const tasks = rewrite ? "1. BUGS 2. LINT 3. REDUNDANCY 4. FORMATTED (Refactor code, output exactly as it would appear in editor, NO markdown) 5. DIFF" : "1. BUGS 2. LINT 3. REDUNDANCY";
    const format = rewrite
        ? `{"bugs": ["string"], "lint": ["string"], "redundancy": ["string"], "aiSecurity": ["string"], "suggestions": [{ "line": 0, "fix": "string" }], "formatted": "Full source code here", "diff": "string"}`
        : `{"bugs": ["string"], "lint": ["string"], "redundancy": ["string"], "aiSecurity": ["string"], "suggestions": [{ "line": 0, "fix": "string" }]}`;
    const prompt = `Act as a Senior Software Auditor. Analyze this ${baseReport.language} code.
    TASKS: ${tasks}
    OUTPUT FORMAT (STRICT JSON): ${format}
    INPUT DATA: Code: ${cleanCode} Scanner Detections: ${JSON.stringify(detections)}`;
    try {
        const completion = await getGroq().chat.completions.create({
            messages: [{ role: 'user', content: prompt }], model: 'llama-3.3-70b-versatile',
            response_format: { type: "json_object" }, temperature: 0.1,
        });
        const parsed = AiSchema.parse(JSON.parse(completion.choices[0].message.content));
        return { ...parsed, ok: true };
    } catch (e) {
        console.error("🔥 GROQ AI ERROR:", e.message || e);
        return { bugs: [], lint: [], redundancy: [], aiSecurity: [], suggestions: [], formatted: cleanCode, ok: false };
    }
}

const NO_AI = { bugs: [], lint: [], redundancy: [], aiSecurity: [], suggestions: [], formatted: "", ok: false };

// opts: { ai = true, format = true, rewrite = true, weights, complexityThreshold }
async function fanalyze(baseReport, opts = {}) {
    const { ai: useAi = true, format = true, rewrite = true } = opts;
    const { cleanCode, detections } = redactAndDetect(baseReport.formatted);
    const ai = useAi ? await getDeepAnalysis(cleanCode, detections, baseReport, { rewrite }) : NO_AI;

    const allBugs = [...baseReport.bugs, ...ai.bugs];
    const allLint = [...baseReport.lint, ...ai.lint];
    const secCount = detections.length + ai.aiSecurity.length;
    const { score: scoreVal, grade } = scoreFindings({
        bugs: allBugs.length, lint: allLint.length, security: secCount,
        redundancy: ai.redundancy.length, cyclomatic: baseReport.complexity.cyclomatic || 1,
    }, { weights: opts.weights, complexityThreshold: opts.complexityThreshold });

    // Deterministic formatting instead of trusting the LLM to reproduce the whole file.
    const originalCode = baseReport.formatted; // router.js sets this to the raw input code
    const localFormatted = format ? await formatCode(originalCode, baseReport.language) : "";
    const localDiff = format ? diffEngine(originalCode, localFormatted) : "";

    const report = {
        language: baseReport.language, score: scoreVal, grade,
        bugs: allBugs, lint: allLint, aiUsed: ai.ok,
        security: [...detections.map(d => `${d.type} (Line ${d.line})`), ...(ai.aiSecurity || [])],
        complexity: baseReport.complexity, redundancy: ai.redundancy || [],
        suggestions: ai.suggestions || [],
        formatted: localFormatted,
        diff: format ? (localDiff || "No changes.") : "",
        aiSuggestedRewrite: ai.formatted || null
    };
    return { report, detections };
}

// Same as analyze() but also returns the structured secret/danger detections (used by the CLI).
async function analyzeDetailed(codeString, opts = {}) {
    const prelim = await router.route(codeString, opts.filename || "");
    return fanalyze(prelim, opts);
}

async function analyze(codeString, opts = {}) {
    return (await analyzeDetailed(codeString, opts)).report;
}

module.exports = { analyze, analyzeDetailed };