require("dotenv").config();
const express = require("express");
const cors = require("cors");
const { analyze } = require("./index.js");
const { initDb, saveReport, getHistory, getReportById } = require("./db.js");

const app = express();

// Locally this falls back to Vite's dev server. In production, set
// FRONTEND_URL on your host (e.g. Render) to your deployed frontend's URL,
// e.g. https://code-analyzer.vercel.app
app.use(cors({ origin: process.env.FRONTEND_URL || "http://localhost:5173", credentials: true }));
app.use(express.json());

app.post("/solve", async (req, res) => {
    try {
        const { codeString } = req.body;
        if (!codeString || codeString.trim() === "") return res.status(400).json({ error: "Empty code" });
        const report = await analyze(codeString);
        const id = await saveReport(codeString, report);
        res.status(200).json({ report: { ...report, id } });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: "Analysis error", details: error.message });
    }
});

// Score-over-time history, for the frontend to load on mount instead of losing it on refresh.
app.get("/reports", async (req, res) => {
    try {
        const limit = Math.min(parseInt(req.query.limit) || 50, 200);
        res.status(200).json({ reports: await getHistory(limit) });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: "Could not load history", details: error.message });
    }
});

// Full past report (e.g. clicking a point on the history chart).
app.get("/reports/:id", async (req, res) => {
    try {
        const full = await getReportById(req.params.id);
        if (!full) return res.status(404).json({ error: "Report not found" });
        res.status(200).json(full);
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: "Could not load report", details: error.message });
    }
});

// Run the migration, THEN start accepting traffic - avoids a request racing
// against table creation on a fresh database.
initDb()
    .then(() => {
        app.listen(8000, () => console.log(`🚀 Backend running on port 8000`));
    })
    .catch((err) => {
        console.error("Failed to initialize database:", err);
        process.exit(1);
    });