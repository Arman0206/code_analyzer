
# 🚀 AI Code Analyzer

An AI-powered full-stack code analysis platform that detects bugs, security vulnerabilities, and code quality issues across multiple programming languages — combining deterministic static analysis with LLM-based semantic review, and persisting every report to a database for score history over time.

---

## 🧠 Features

- 🔍 **Multi-language support** — JavaScript, Python, Java, C++
- 🧪 **Static analysis** — real AST parsing for JavaScript (Acorn), CST parsing for Java (java-parser), heuristic line/indentation analysis for Python and C++
- 🤖 **AI-powered code review** — deep semantic analysis via Groq LLM (Llama 3.3 70B)
- 🔐 **Sensitive data detection & redaction** — API keys, hardcoded secrets, and dangerous calls (`eval`, `os.system`) are detected and redacted *before* code is ever sent to an external API
- 🧾 **Deterministic code formatting & diffing** — Prettier (JS) / a brace-indent formatter (other languages) generate the "cleaned up" version and diff, rather than trusting an LLM to faithfully reproduce the whole file; the AI's own suggested rewrite is still returned separately for comparison
- 📊 **Weighted code quality scoring** — configurable weights across bugs, security, complexity, redundancy, and lint categories
- 💾 **Persistent history** — every analyzed report is saved to a Postgres database, so score history survives page refreshes and server restarts
- 📈 **Score history graph** loaded from the database on page load

---

## 🏗️ Tech Stack

**Frontend**
- React (Vite)
- Monaco Editor
- Recharts (score visualization)
- GSAP (animation)

**Backend**
- Node.js + Express
- PostgreSQL via `pg` (works with any Postgres host, including [Neon](https://neon.tech))
- Groq SDK (LLM inference)
- Acorn + acorn-walk (JavaScript AST parsing)
- java-parser (Java CST parsing)
- Prettier (JS formatting)

---

## ⚙️ How It Works

1. User submits code via the Monaco Editor in the frontend.
2. The backend detects the language (by filename extension, or keyword heuristics if none is given).
3. A language-specific static analyzer computes cyclomatic complexity and lint warnings (AST-based for JS, CST-based for Java, heuristic for Python/C++).
4. A security scan detects and redacts secrets/dangerous patterns from the code.
5. The **redacted** code is sent to the Groq LLM for deeper semantic analysis — bugs, redundancy, refactor suggestions, and its own rewritten version of the code.
6. In parallel, a deterministic formatter (Prettier for JS, a brace-indent pass otherwise) produces the formatted code and diff shown to the user — the AI's own rewrite is kept available separately, clearly labeled, rather than replacing the deterministic output.
7. Static-analysis and AI results are merged into a single report, and a weighted score (0–100) is calculated.
8. The report is saved to Postgres, and its ID is returned alongside the response.
9. The frontend renders bugs, lint issues, security warnings, suggestions, formatted code, diff output, and a score history chart populated from the database.

---

## 📦 Installation

### 1. Clone the repository
```bash
git clone https://github.com/Arman0206/code_analyzer.git
cd code_analyzer
```

### 2. Set up a Postgres database

Any Postgres instance works — locally installed, Docker, or a hosted free tier like [Neon](https://neon.tech). The app creates its own table automatically on startup (`reports`), so no manual migration is needed.

### 3. Set up the backend
```bash
cd backend
npm install
```

Create a `.env` file inside `backend/`:
```env
GROQ_API_KEY=your_groq_api_key_here
DATABASE_URL=postgres://user:password@localhost:5432/code_analyzer
# For a hosted Neon database instead:
# DATABASE_URL=postgres://user:password@ep-xxxx.neon.tech/dbname?sslmode=require
PORT=8000
# Only needed in production, to allow your deployed frontend's origin:
# FRONTEND_URL=https://your-frontend-domain.com
```

Run the backend:
```bash
node server.js
```
On startup it runs its database migration (`CREATE TABLE IF NOT EXISTS reports...`) before accepting any requests.

### 4. Set up the frontend
```bash
cd frontend
npm install
```

Create a `.env` file inside `frontend/` (only needed if your backend isn't running on `localhost:8000`):
```env
VITE_API_URL=http://localhost:8000
```

Run the frontend:
```bash
npm run dev
```

---

## 🌐 API Reference

### `POST /solve`
Analyze a code submission and persist the result.

**Request**
```json
{
  "codeString": "your code here"
}
```

**Response**
```json
{
  "report": {
    "id": 42,
    "language": "javascript",
    "score": 85,
    "grade": "A",
    "bugs": [],
    "lint": [],
    "security": [],
    "complexity": {},
    "redundancy": [],
    "suggestions": [],
    "formatted": "",
    "diff": "",
    "aiSuggestedRewrite": ""
  }
}
```

### `GET /reports?limit=50`
Returns lightweight score history (id, language, score, grade, timestamp) for charting — no full report bodies, capped at 200 rows per request.

### `GET /reports/:id`
Returns the full stored report for a single past submission, including the original code and complete analysis.

---

## 🔐 Security Notes

- `.env` files (both `backend/.env` and `frontend/.env`) are excluded via `.gitignore` and must never be committed.
- Detected secrets (API keys, hardcoded credentials) are redacted **before** code is ever sent to the LLM — the model never sees real credentials.
- Submitted code is stored in the database as-is (post-redaction is not currently applied to the stored copy) — treat the database itself as containing potentially sensitive user input, and secure its connection string and access accordingly.
- If a secret is ever accidentally committed, rotate it immediately at the provider and remove it from git history — `.gitignore` only prevents *future* commits, it does not retroactively scrub existing history.

---

## 🧭 Known Limitations

Being upfront about the current state of the project:

- Python and C++ static analysis use regex/line-based heuristics rather than a real parser, so they're less precise than the JavaScript (AST) and Java (CST) analyzers.
- The scoring formula supports five weighted categories (bug, security, complexity, redundancy, lint), but only security and complexity penalties are currently populated when the score is calculated — bug, redundancy, and lint penalties default to zero regardless of what the AI finds.
- No automated test suite yet.
- Stored reports include the original submitted code verbatim in the database; there's no redaction applied to what's persisted, only to what's sent to the LLM.

---

## 🚀 Future Improvements

- Replace Python/C++ heuristic analysis with real parsers
- Fully wire up all five scoring categories
- Add automated tests
- Add authentication and per-user rate limiting before any public deployment
- Support additional languages
- Deploy via Docker + cloud hosting

---

## 👨‍💻 Author

**Arman**
GitHub: [https://github.com/Arman0206](https://github.com/Arman0206)

---

## ⭐ Contribute

Feel free to fork this repo, raise issues, and submit PRs!
