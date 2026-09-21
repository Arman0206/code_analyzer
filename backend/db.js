const { Pool } = require("pg");
const { redactAndDetect } = require("./security");

const connectionString = process.env.DATABASE_URL;
const needsSsl = connectionString && (connectionString.includes("sslmode=require") || connectionString.includes("neon.tech"));

const pool = new Pool({
  connectionString,
  ssl: needsSsl ? { rejectUnauthorized: false } : false,
});

pool.on("error", (err) => {
  console.error("Unexpected Postgres pool error:", err);
});

async function initDb() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS users (
      id SERIAL PRIMARY KEY,
      email TEXT UNIQUE NOT NULL,
      name TEXT,
      google_id TEXT UNIQUE,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now()
    );
    CREATE TABLE IF NOT EXISTS reports (
      id SERIAL PRIMARY KEY,
      language TEXT NOT NULL,
      score REAL NOT NULL,
      grade TEXT NOT NULL,
      code TEXT NOT NULL,
      report_json JSONB NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now()
    );
    ALTER TABLE reports ADD COLUMN IF NOT EXISTS user_id INTEGER REFERENCES users(id) ON DELETE CASCADE;
    CREATE INDEX IF NOT EXISTS idx_reports_user_created ON reports (user_id, created_at DESC);
  `);
}

// Same email via Google or OTP => same account.
async function upsertUser({ email, name = null, googleId = null }) {
  const result = await pool.query(
    `INSERT INTO users (email, name, google_id) VALUES ($1, $2, $3)
     ON CONFLICT (email) DO UPDATE SET
       name = COALESCE(users.name, EXCLUDED.name),
       google_id = COALESCE(users.google_id, EXCLUDED.google_id)
     RETURNING id, email, name`,
    [email.toLowerCase(), name, googleId]
  );
  return result.rows[0];
}

// Never persist secrets: redact the code AND every code-bearing field of the report.
async function saveReport(userId, codeString, report) {
  const redact = (text) => redactAndDetect(text || "").cleanCode;
  const safeReport = {
    ...report,
    formatted: redact(report.formatted),
    diff: redact(report.diff),
    aiSuggestedRewrite: report.aiSuggestedRewrite ? redact(report.aiSuggestedRewrite) : null,
  };
  const result = await pool.query(
    `INSERT INTO reports (user_id, language, score, grade, code, report_json)
     VALUES ($1, $2, $3, $4, $5, $6) RETURNING id`,
    [userId, report.language, report.score, report.grade, redact(codeString), JSON.stringify(safeReport)]
  );
  return result.rows[0].id;
}

// Only THIS user's rows.
async function getHistory(userId, limit = 50) {
  const result = await pool.query(
    `SELECT id, language, score, grade, created_at
     FROM reports WHERE user_id = $1 ORDER BY id DESC LIMIT $2`,
    [userId, limit]
  );
  return result.rows;
}

// Ownership check in SQL: someone else's id simply returns "not found".
async function getReportById(userId, id) {
  const result = await pool.query(`SELECT * FROM reports WHERE id = $1 AND user_id = $2`, [id, userId]);
  const row = result.rows[0];
  if (!row) return null;
  return { ...row, report: row.report_json };
}

module.exports = { pool, initDb, upsertUser, saveReport, getHistory, getReportById };