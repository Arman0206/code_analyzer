require("dotenv").config();
const Groq = require('groq-sdk');
const { redactAndDetect } = require('./security');
const { calculateFinalScore } = require('./maths');
const router = require("./src/router");
const diffEngine = require("./src/diff");
const formatCode = require("./src/formatter");
const { z } = require("zod");

// A hung AI call should not hang your API: fail after 20s, retry twice on 429/5xx.
const groq = new Groq({ apiKey: process.env.GROQ_API_KEY, timeout: 20_000, maxRetries: 2 });

// Never trust LLM output: validate its shape. Anything malformed becomes a safe default.
const strList = z.array(z.string()).catch([]);
const AiSchema = z.object({
  bugs: strList, lint: strList, redundancy: strList, aiSecurity: strList,
  suggestions: z.array(z.object({ line: z.coerce.number().catch(0), fix: z.string() })).catch([]),
  formatted: z.string().catch(""),
});

async function getDeepAnalysis(cleanCode, detections, baseReport) {
    const prompt = `Act as a Senior Software Auditor. Analyze this ${baseReport.language} code.
    TASKS: 1. BUGS 2. LINT 3. REDUNDANCY 4. FORMATTED (Refactor code, output exactly as it would appear in editor, NO markdown) 5. DIFF
    OUTPUT FORMAT (STRICT JSON): {"bugs": ["string"], "lint": ["string"], "redundancy": ["string"], "aiSecurity": ["string"], "suggestions": [{ "line": 0, "fix": "string" }], "formatted": "Full source code here", "diff": "string"}
    INPUT DATA: Code: ${cleanCode} Scanner Detections: ${JSON.stringify(detections)}`;
    try {
        const completion = await groq.chat.completions.create({
            messages: [{ role: 'user', content: prompt }], model: 'llama-3.3-70b-versatile',
            response_format: { type: "json_object" }, temperature: 0.1,
        });
        const parsed = AiSchema.parse(JSON.parse(completion.choices[0].message.content));
        return { ...parsed, ok: true };
    } catch (e) {
        console.error("🔥 GROQ AI ERROR:", e);
        return { bugs: [], lint: [], redundancy: [], aiSecurity: [], suggestions: [], formatted: cleanCode, ok: false };
    }
}

async function fanalyze(baseReport) {
    const { cleanCode, detections } = redactAndDetect(baseReport.formatted);
    const ai = await getDeepAnalysis(cleanCode, detections, baseReport);

    const allBugs = [...baseReport.bugs, ...ai.bugs];
    const allLint = [...baseReport.lint, ...ai.lint];
    const secCount = detections.length + ai.aiSecurity.length;
    const cap = (count, perItem) => Math.min(100, count * perItem); // each category maxes out at 100
    const cyclo = baseReport.complexity.cyclomatic || 1;
    const penalties = {
        bug: cap(allBugs.length, 35),
        sec: cap(secCount, 40),
        cplx: cyclo > 8 ? Math.min(100, (cyclo - 8) * 10) : 0,
        red: cap(ai.redundancy.length, 20),
        lint: cap(allLint.length, 10),
    };
    const scoreVal = calculateFinalScore(penalties);

    // Deterministic formatting instead of trusting the LLM to reproduce the whole file.
    const originalCode = baseReport.formatted; // router.js sets this to the raw input code
    const localFormatted = await formatCode(originalCode, baseReport.language);
    const localDiff = diffEngine(originalCode, localFormatted);

    return {
        language: baseReport.language, score: parseFloat(scoreVal.toFixed(2)),
        grade: scoreVal > 85 ? "A" : scoreVal > 70 ? "B" : "C",
        bugs: allBugs, lint: allLint, aiUsed: ai.ok,
        security: [...detections.map(d => `${d.type} (Line ${d.line})`), ...(ai.aiSecurity || [])],
        complexity: baseReport.complexity, redundancy: ai.redundancy || [],
        suggestions: ai.suggestions || [],
        formatted: localFormatted,
        diff: localDiff || "No changes.",
        aiSuggestedRewrite: ai.formatted || null
    };
}

async function analyze(codeString) {
    const prelim = await router.route(codeString);
    return await fanalyze(prelim);
}
module.exports = { analyze };