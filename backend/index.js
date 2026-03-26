require("dotenv").config();
const Groq = require('groq-sdk');
const { redactAndDetect } = require('./security');
const { calculateFinalScore } = require('./maths');
const router = require("./src/router");
const diffEngine = require("./src/diff");

const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });

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
        return JSON.parse(completion.choices[0].message.content);
    } catch (e) {
        console.error("🔥 GROQ AI ERROR:", e);
        return { bugs: [], lint: [], redundancy: [], aiSecurity: [], suggestions: [], formatted: cleanCode, diff: "AI Error" };
    }
}

async function fanalyze(baseReport) {
    const { cleanCode, detections } = redactAndDetect(baseReport.formatted);
    const ai = await getDeepAnalysis(cleanCode, detections, baseReport);
    
    const penalties = { sec: detections.length * 15, cplx: baseReport.complexity.cyclomatic > 8 ? (baseReport.complexity.cyclomatic - 8) * 5 : 0 };
    const scoreVal = calculateFinalScore(penalties);
    
    return {
        language: baseReport.language, score: parseFloat(scoreVal.toFixed(2)),
        grade: scoreVal > 85 ? "A" : scoreVal > 70 ? "B" : "C",
        bugs: [...baseReport.bugs, ...(ai.bugs || [])], lint: [...baseReport.lint, ...(ai.lint || [])],
        security: [...detections.map(d => `${d.type} (Line ${d.line})`), ...(ai.aiSecurity || [])],
        complexity: baseReport.complexity, redundancy: ai.redundancy || [],
        suggestions: ai.suggestions || [], formatted: ai.formatted || baseReport.formatted, diff: ai.diff || "No changes."
    };
}

async function analyze(codeString) {
    const prelim = await router.route(codeString);
    return await fanalyze(prelim);
}
module.exports = { analyze };