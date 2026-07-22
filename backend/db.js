const { Pool } = require("pg");

// One shared connection pool for the whole app - pg manages reusing/closing
// connections internally. DATABASE_URL comes from .env, e.g.:
// Local:  DATABASE_URL=postgres://user:password@localhost:5432/code_analyzer
// Neon:   DATABASE_URL=postgres://user:password@ep-xxxx.neon.tech/dbname?sslmode=require
const connectionString = process.env.DATABASE_URL;
const needsSsl = connectionString && (connectionString.includes("sslmode=require") || connectionString.includes("neon.tech"));

const pool = new Pool({
  connectionString,
  ssl: needsSsl ? { rejectUnauthorized: false } : false,
});

pool.on("error", (err) => {
  // A background/idle client error should not crash the whole server
  console.error("Unexpected Postgres pool error:", err);
});

// Creates the table if it doesn't exist yet. Call this once at startup
// (see server.js) before accepting requests.
async function initDb() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS reports (
      id SERIAL PRIMARY KEY,
      language TEXT NOT NULL,
      score REAL NOT NULL,
      grade TEXT NOT NULL,
      code TEXT NOT NULL,
      report_json JSONB NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now()
    )
  `);
}

async function saveReport(codeString, report) {
  const result = await pool.query(
    `INSERT INTO reports (language, score, grade, code, report_json)
     VALUES ($1, $2, $3, $4, $5)
     RETURNING id`,
    [report.language, report.score, report.grade, codeString, JSON.stringify(report)]
  );
  return result.rows[0].id;
}

// Lightweight rows only (no full report_json) - this is what feeds the score-over-time chart.
async function getHistory(limit = 50) {
  const result = await pool.query(
    `SELECT id, language, score, grade, created_at
     FROM reports ORDER BY id DESC LIMIT $1`,
    [limit]
  );
  return result.rows;
}

// Full report for a single past submission, e.g. if a user clicks a history row.
async function getReportById(id) {
  const result = await pool.query(`SELECT * FROM reports WHERE id = $1`, [id]);
  const row = result.rows[0];
  if (!row) return null;
  // report_json column is JSONB, pg already parses it into an object for us.
  return { ...row, report: row.report_json };
}

module.exports = { initDb, saveReport, getHistory, getReportById };