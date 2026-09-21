require("./src/config"); // loads .env and validates it FIRST
const express = require("express");
const cors = require("cors");
const helmet = require("helmet");
const cookieParser = require("cookie-parser");
const { z } = require("zod");

const { analyze } = require("./index.js");
const { pool, initDb, saveReport, getHistory, getReportById } = require("./db.js");
const redis = require("./src/redis");
const { cacheGet, cacheSet, consumeAiQuota } = require("./src/cache");
const { requireAuth } = require("./src/middleware/auth");
const { globalLimiter, solveBurstLimiter } = require("./src/middleware/rateLimit");

const app = express();

app.set("trust proxy", 1); // behind Render/Heroku/Nginx: without this every user shares one IP
app.use(helmet());
app.use(cors({ origin: process.env.FRONTEND_URL || "http://localhost:5173", credentials: true }));
app.use(express.json({ limit: "100kb" }));
app.use(cookieParser());

// Health check for hosting platforms and uptime monitors (before the rate limiter)
app.get("/health", async (req, res) => {
  try {
    await pool.query("SELECT 1");
    await redis.ping();
    res.json({ status: "ok" });
  } catch {
    res.status(503).json({ status: "unhealthy" });
  }
});

app.use(globalLimiter);
app.use("/auth", require("./src/routes/auth"));

const SolveBody = z.object({
  codeString: z
    .string()
    .min(1, "Empty code")
    .max(20000, "Code is too long (max 20,000 characters)")
    .refine((s) => s.trim() !== "", "Empty code"),
});

app.post("/solve", requireAuth, solveBurstLimiter, async (req, res) => {
  const parsed = SolveBody.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.issues[0].message });
  const code = parsed.data.codeString;

  // 1) cache hit = free and instant, and doesn't use up the user's AI quota
  let report = await cacheGet(code);
  const cached = Boolean(report);

  // 2) cache miss = costs an AI call, so check the daily quota first
  if (!cached) {
    const quota = await consumeAiQuota(req.user.sub);
    if (!quota.allowed) return res.status(429).json({ error: "Daily analysis limit reached. Try again tomorrow." });
    report = await analyze(code);
    if (report.aiUsed) await cacheSet(code, report); // never cache a degraded (AI-failed) result
  }

  const id = await saveReport(req.user.sub, code, report);
  res.json({ report: { ...report, id }, cached });
});

app.get("/reports", requireAuth, async (req, res) => {
  const limit = Math.min(parseInt(req.query.limit, 10) || 50, 200);
  res.json({ reports: await getHistory(req.user.sub, limit) });
});

app.get("/reports/:id", requireAuth, async (req, res) => {
  const id = Number.parseInt(req.params.id, 10);
  if (!Number.isInteger(id)) return res.status(400).json({ error: "Invalid id" });
  const full = await getReportById(req.user.sub, id);
  if (!full) return res.status(404).json({ error: "Report not found" });
  res.json(full);
});

app.use((req, res) => res.status(404).json({ error: "Not found" }));

// One place for all errors. Express 5 forwards async errors here automatically.
app.use((err, req, res, next) => {
  const status = err.status || 500;
  if (status >= 500) console.error(err);
  res.status(status).json({ error: status >= 500 ? "Internal server error" : err.message });
});

const PORT = process.env.PORT || 8000;
initDb()
  .then(() => app.listen(PORT, () => console.log(`Backend running on port ${PORT}`)))
  .catch((err) => {
    console.error("Failed to initialize database:", err);
    process.exit(1);
  });