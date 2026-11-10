
# 🚀 AI Code Analyzer

![CI](https://github.com/Arman0206/code_analyzer/actions/workflows/ci.yml/badge.svg)

Scores your code with static analysis and an optional AI review, and **blocks pull requests that fall below a quality bar you set**. It comes in two forms that share one analysis engine:

- **A CI quality gate** (GitHub Action and command-line tool). It analyzes every pull request, posts a score and the top issues as a comment, and fails the check below your threshold.
- **A web app.** Sign in, paste JavaScript, Python, Java or C++, and get a scored report saved to your history.

Pasting code into a chat gives you one review, once. The gate runs on **every pull request**, gives the **same score for the same code**, and takes its rules from a file in your repo.

---

## 📚 Contents

[Quick start](#-quick-start-github-action) · [CLI](#-command-line-tool) · [Config file](#-analyzeryml) · [Scoring](#-scoring) · [Web app](#-web-app) · [Architecture](#-architecture) · [Installation](#-installation) · [API](#-api-reference) · [Security](#-security) · [Testing](#-testing) · [Deployment](#-deployment) · [Limitations](#-known-limitations)

---

## ⚡ Quick start: GitHub Action

Add `.github/workflows/quality.yml` to your repository:

```yaml
name: Quality gate
on: pull_request
permissions:
  contents: read
  pull-requests: write          # lets the Action post its comment
jobs:
  analyze:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
        with:
          fetch-depth: 0        # lets the Action diff against the base branch
      - uses: Arman0206/code_analyzer@v1.0.0
```

Open a pull request. Within a minute you get:

- a green or red check on the PR
- one comment with a score table and the top issues, **updated on each push** instead of adding a new one
- the same report in the job's Summary tab

A red check does not stop a merge on its own. To enforce it, go to **Settings → Branches → Add rule** for `main`, turn on **Require status checks to pass**, and select the check.

By default it analyzes **only the files the pull request changed**.

### Action inputs and outputs

| Input | Default | Description |
|---|---|---|
| `path` | `.` | File or folder to analyze |
| `config` | `.analyzer.yml` if present | Path to the config file |
| `min-score` | from config | Override `min_score` (0 to 100) |
| `changed-only` | `true` | On pull requests, analyze only changed files (needs `fetch-depth: 0`) |
| `ai` | `false` | Add an LLM review of the weakest files (needs `groq-api-key`) |
| `groq-api-key` | none | Groq API key. Store it as a repository secret |
| `comment` | `true` | Post or update the PR comment |
| `github-token` | `github.token` | Token used to post the comment |

Outputs: `score` (0 to 100) and `passed` (`true` or `false`).

Comments cannot be posted on pull requests from forks (the token is read-only). The Summary tab still has the report, and the check still passes or fails.

### Example comment

> ## ❌ Code Analyzer: failed (80/100, grade B)
>
> 2 files · 8 lines · AI review: off · required: **85** · security findings fail the build
>
> - ❌ Overall score 80 is below min_score 85
> - ❌ 3 security findings found (fail_on_security is on)
>
> | File | Score | Security | Bugs | Complexity | Redundancy | Lint |
> |---|---:|---:|---:|---:|---:|---:|
> | `src/auth.js` | 68.0 (C) | 3 | 0 | 0 | 0 | 2 |
> | `src/util.js` | 100.0 (A) | 0 | 0 | 0 | 0 | 0 |
>
> **Top issues:** `src/auth.js:1` Hardcoded Secret · `src/auth.js:3` Dangerous Eval · `src/auth.js:2` Variable 'unusedHelper' declared but never used

---

## 💻 Command-line tool

Run it on your own machine, or in any CI system (GitLab, Jenkins, CircleCI). It needs Node 18.3 or newer.

```bash
git clone https://github.com/Arman0206/code_analyzer.git
cd code_analyzer/backend
npm install

node bin/analyzer.js ../my-project           # analyze a folder or files
node bin/analyzer.js . --changed origin/main # only files changed since main
node bin/analyzer.js . --format markdown     # the PR-comment version
node bin/analyzer.js . --ai                  # add an LLM review (needs GROQ_API_KEY)
npm link                                     # optional: gives you a `code-analyzer` command
```

Static analysis works **offline with no API key** and sends nothing anywhere.

| Flag | Description |
|---|---|
| `--config <file>` | Config file (default: `.analyzer.yml` if present) |
| `--min-score <0-100>` | Override `min_score` for this run |
| `--changed <git-ref>` | Only analyze files changed since the ref |
| `--ai` | LLM review of the weakest files (needs `GROQ_API_KEY`) |
| `--format <text\|json\|markdown>` | Stdout format (default: `text`) |
| `--markdown-file <file>` | Also write the Markdown report to a file |
| `--json-file <file>` | Also write the JSON report to a file |

**Exit codes:** `0` the gate passed, `1` the gate failed, `2` usage or config error. That is what makes it work in any CI.

Supported files: `.js .mjs .cjs` (JavaScript), `.py` (Python), `.java` (Java), `.cpp .cc .c .h .hpp` (C and C++, analyzed as C++). TypeScript and JSX are not analyzed.

### AI review (optional)

`--ai` (or `ai: true`) adds an LLM review on top of the static analysis, and it is **off by default**. To keep cost and latency bounded, only the lowest-scoring files are sent (`ai_max_files`, default 10), two at a time, up to 20,000 characters each. Secrets are redacted before anything is sent. If `GROQ_API_KEY` is missing or the call fails, you still get the static report with a warning, and the gate still works.

---

## 📄 `.analyzer.yml`

Put this file in the root of the repo being analyzed. **Unknown keys are rejected**, so a typo like `min_scor` is an error and never a silently ignored rule.

```yaml
min_score: 80            # overall score (weighted by lines of code) must be at least this
min_file_score: 60       # optional: no single file may score below this
fail_on_security: true   # any secret / eval / os.system finding fails the build
max_complexity: 15       # cyclomatic points above this, per function, cost score
include: ["src/**"]      # optional globs; default is every supported file
exclude: ["legacy", "**/*.generated.js"]   # added to the built-in excludes
max_file_kb: 500         # larger files are skipped and reported
ai: false                # same as --ai
ai_max_files: 10         # how many of the weakest files get AI review
weights: { bug: 0.4, lint: 0 }   # partial override; merged with defaults, must sum to 1
```

| Key | Default | Meaning |
|---|---|---|
| `min_score` | 70 | Overall score must be at least this |
| `min_file_score` | none | Every file must be at least this |
| `fail_on_security` | `false` | Any security finding fails the run |
| `max_complexity` | 8 | Cyclomatic points above this cost score |
| `include` | all supported files | Globs a file must match |
| `exclude` | see below | Extra globs to skip |
| `max_file_kb` | 500 | Skip larger files |
| `ai` | `false` | LLM review |
| `ai_max_files` | 10 | AI review budget |
| `weights` | bug 0.3, sec 0.3, cplx 0.2, red 0.1, lint 0.1 | Must sum to 1 |

Always excluded: `node_modules`, `.git`, `dist`, `build`, `coverage`, `vendor`, `__pycache__`, `venv`, `.venv`, `*.min.js`.

### How the gate decides

- **Overall score** is the average of the file scores **weighted by line count**, so a 5-line file can't hide a 2,000-line one.
- **The score is soft.** A file with a hardcoded password and an `eval` still scores around 75. If a finding should never be merged, turn on `fail_on_security`, which is a hard rule.
- **A run fails** if the overall score is below `min_score`, any file is below `min_file_score`, or (with `fail_on_security`) there is any security finding.

---

## 📊 Scoring

Each category produces a penalty from 0 to 100, and the score is `100 - (weighted sum of penalties)`, never below 0.

| Category | Weight | Penalty |
|---|---|---|
| Bugs | 30% | 35 per bug (static and AI), capped at 100 |
| Security | 30% | 40 per finding, capped at 100 |
| Complexity | 20% | 10 for each cyclomatic point above the limit (default 8, set `max_complexity` in the CLI), capped at 100 |
| Redundancy | 10% | 20 per item, capped at 100 |
| Lint | 10% | 10 per warning, capped at 100 |

Grades: **A** above 85, **B** above 70, otherwise **C**. Weights must sum to 1.

For JavaScript, complexity is the worst **single function** (nested functions are scored separately). Python, Java and C++ still count a whole file, so treat their complexity numbers as rougher.

**What the static checks find without AI:** hardcoded secrets and dangerous calls (`eval`, `os.system`), syntax errors, unused JavaScript variables, and complexity. Bug and redundancy findings come **only from the AI review**, so without `--ai` they are always zero. A score of 100 means the checks found nothing, not that the code is bug-free.

---

## 🖥️ Web app

A full-stack code review tool. Sign in, paste code, and get a scored report that combines deterministic static analysis with an LLM review. Each report is saved, so you can reopen it and track your score over time.

**Analysis**

- 🔍 **Multi-language support**: JavaScript, Python, Java, C++
- 🧪 **Static analysis**: real AST parsing for JavaScript (Acorn), CST parsing for Java (java-parser), and heuristic line and indentation analysis for Python and C++
- 🤖 **AI code review** with a Groq-hosted LLM (the model ID is set in `backend/index.js`). The reply is validated against a schema, so malformed model output can't break a report
- 🔐 **Secret detection and redaction**: API keys, hardcoded credentials and dangerous calls are detected and masked before code is sent to the LLM, and again before anything is stored
- 🧾 **Deterministic formatting and diff**: Prettier for JavaScript and a brace-indent formatter for other languages, so the result never depends on an LLM reproducing your file
- 📊 **Weighted scoring** (see [Scoring](#-scoring))

**Platform**

- 🔑 **Passwordless authentication**: email one-time codes or Google Sign-In, with a signed JWT in an `httpOnly` cookie
- 🚦 **Rate limiting**: Redis-backed limits per IP and per user, plus a daily AI quota per user
- ⚡ **Caching**: identical code is served from Redis, with no AI call and no quota used
- 💾 **Per-user history**: every report is stored under your account, with a score trend
- 🖥️ **Workspace UI**: side-by-side editor and review, issue groups, a diff view, formatted code with copy, light and dark themes, and a `Ctrl/⌘ + Enter` shortcut

---

## 🏗️ Architecture

```
GitHub pull request                          Browser: React + Vite + Monaco
   |                                            |  HTTPS, JWT in httpOnly cookie
   v                                            v
GitHub Action (action.yml)                   Express API
   |                                          |- helmet > cors > json(100kb) > cookieParser > rate limit
   v                                          |- /auth/*  -> Redis (OTP) + Postgres (users)
CLI (bin/analyzer.js)                         |- /solve   -> cache > quota > analysis > Postgres
   |                                          '- /reports -> Postgres (ownership enforced in SQL)
   |                                                         |
   '---------------> shared analysis engine <---------------'
                     router > language analyzers > redaction > (optional) LLM > weighted score
```

The CLI and the web app call the **same engine** (`backend/index.js` and `backend/src/scoring.js`), so a file gets the same score in both.

| Store | Holds | Why |
|---|---|---|
| PostgreSQL | Users and reports | Durable data with ownership and history |
| Redis | Rate-limit counters, OTP hashes, daily quotas, cached reports | Atomic counters, expiry (TTL), shared across instances |

---

## 🛠️ Tech Stack

**Frontend:** React 19 (Vite), Monaco Editor, Recharts, `@react-oauth/google`, IBM Plex Sans and JetBrains Mono (Fontsource)

**Backend:** Node.js and Express 5, PostgreSQL (`pg`), Redis (`ioredis`, `express-rate-limit`, `rate-limit-redis`), Groq SDK, Acorn and acorn-walk (JavaScript AST), java-parser (Java CST), Prettier, `jsonwebtoken`, `google-auth-library`, `nodemailer`, `zod` (request, environment, config and AI-output validation), `yaml`, `helmet`, `cors`, `cookie-parser`

**CI:** GitHub Actions (tests on Node 20 and 22, plus this project analyzing itself with its own Action)

---

## ⚙️ How the web app works

1. You sign in with an emailed one-time code or with Google. The server sets a signed session cookie.
2. You paste code into the editor and press **Analyze code**.
3. The API checks your session, rate limits and the input (non-empty, at most 20,000 characters).
4. If the same code was analyzed recently, the cached report is returned and your daily quota is not used.
5. Otherwise the language is detected and a static analyzer computes complexity and lint findings.
6. Secrets and dangerous patterns are detected and redacted.
7. The **redacted** code goes to the LLM for bugs, redundancy and suggestions. If the AI fails, you still get the static report, marked as such.
8. A deterministic formatter produces the formatted code and diff.
9. Static and AI findings are merged into one weighted score.
10. The report is stored (redacted) under your account and returned to the UI.

---

## 📁 Project Structure

```
code_analyzer/
├── action.yml                  GitHub Action (composite): analyze, comment, enforce the gate
├── .analyzer.yml               This repo's own quality gate
├── .github/workflows/ci.yml    Tests on Node 20 and 22, plus the Action run on itself
├── docker-compose.yml          Local Postgres + Redis
├── backend/
│   ├── bin/analyzer.js         CLI entry point
│   ├── server.js               Express app: middleware, routes, error handling
│   ├── index.js                Analysis pipeline: optional AI call, merge, scoring
│   ├── db.js                   Postgres pool, schema, queries
│   ├── security.js             Secret detection and redaction
│   ├── maths.js                Weighted score calculation
│   ├── src/
│   │   ├── scoring.js          Penalties and grade, shared by the API and the CLI
│   │   ├── config.js           Validates server environment variables at startup
│   │   ├── redis.js            Redis client
│   │   ├── cache.js            Result cache and daily AI quota
│   │   ├── router.js           Language detection and analyzer dispatch
│   │   ├── formatter.js        Prettier / brace formatter
│   │   ├── diff.js             Line diff
│   │   ├── cli/                config (.analyzer.yml), files (globs, git diff), gate, run, report, main
│   │   ├── languages/          javascript.js, python.js, java.js, cpp.js
│   │   ├── middleware/         auth.js (JWT cookie), rateLimit.js
│   │   └── routes/             auth.js (OTP, Google, session)
│   └── test/                   Unit tests (node:test)
└── frontend/
    └── src/
        ├── App.jsx             Auth gate and analysis workspace
        ├── Login.jsx           Email-code and Google sign-in
        ├── api.js              fetch wrapper (cookies, error handling)
        ├── components/         ScoreRing, IssuesPanel, DiffView, HistoryPanel, Icons
        ├── hooks/              useTheme
        └── lib/                Issue grouping helpers
```

---

## 📦 Installation

This section sets up the **web app**. To use only the CLI, see [Command-line tool](#-command-line-tool).

### Prerequisites

- Node.js 18.3 or newer (20+ recommended)
- Docker (optional, for local Postgres and Redis)
- A [Groq API key](https://console.groq.com) and a Google OAuth Client ID (steps below)

### 1. Clone the repository

```bash
git clone https://github.com/Arman0206/code_analyzer.git
cd code_analyzer
```

### 2. Start Postgres and Redis

With Docker:

```bash
docker compose up -d
```

This starts Postgres (user `app`, password `app`, database `code_analyzer`) and Redis on their default ports. Without Docker, use any Postgres (for example [Neon](https://neon.tech)) and a Redis instance (for example [Upstash](https://upstash.com)), and put their connection strings in `.env`.

### 3. Get a Google Client ID

1. Open the [Google Cloud Console](https://console.cloud.google.com) and create a project.
2. Configure the OAuth consent screen (External). While the app is in Testing mode, add your own Gmail address under Test users.
3. Go to Credentials → Create Credentials → OAuth client ID → Web application.
4. Add `http://localhost:5173` under Authorized JavaScript origins. Add your deployed frontend URL later.
5. Copy the Client ID.

### 4. Set up the backend

```bash
cd backend
npm install
```

Create `backend/.env`:

```env
NODE_ENV=development
PORT=8000
DATABASE_URL=postgres://app:app@localhost:5432/code_analyzer
REDIS_URL=redis://localhost:6379
GROQ_API_KEY=your_groq_api_key
JWT_SECRET=a_random_string_of_at_least_32_characters
GOOGLE_CLIENT_ID=your_id.apps.googleusercontent.com
FRONTEND_URL=http://localhost:5173
# Optional: leave blank in development and the login code prints in the server console
SMTP_USER=
SMTP_PASS=
```

Generate a secret for `JWT_SECRET`:

```bash
node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"
```

Run the backend:

```bash
npm run dev      # auto-restarts on changes
# or
npm start
```

On startup the server validates every environment variable and exits with a clear message if one is missing. It then creates its tables (`users`, `reports`) automatically.

### 5. Set up the frontend

```bash
cd frontend
npm install
```

Create `frontend/.env`:

```env
VITE_API_URL=http://localhost:8000
VITE_GOOGLE_CLIENT_ID=your_id.apps.googleusercontent.com
```

```bash
npm run dev
```

Open http://localhost:5173. Restart the dev server after changing `frontend/.env`.

### 6. Sending real login emails (optional)

Turn on 2-Step Verification for a Gmail account, create an [App Password](https://myaccount.google.com/apppasswords), then set `SMTP_USER` to the Gmail address and `SMTP_PASS` to the app password. Without these, codes are printed to the backend console in development, and login by email fails in production.

---

## 🔧 Configuration

| Variable | Required | Description |
|---|---|---|
| `NODE_ENV` | No | `development` (default) or `production`. Production enables `Secure` and `SameSite=None` cookies |
| `PORT` | No | API port. Defaults to 8000. Hosting platforms set it for you |
| `DATABASE_URL` | Yes | Postgres connection string. SSL is used when it contains `sslmode=require` or a Neon host |
| `REDIS_URL` | No | Defaults to `redis://localhost:6379`. Use `rediss://...` for hosted Redis |
| `GROQ_API_KEY` | Yes | Groq API key |
| `JWT_SECRET` | Yes | At least 32 characters. Signs sessions and hashes login codes |
| `GOOGLE_CLIENT_ID` | Yes | OAuth Client ID used to verify Google sign-in tokens |
| `FRONTEND_URL` | No | Allowed CORS origin. Defaults to `http://localhost:5173` |
| `SMTP_USER`, `SMTP_PASS` | No | Gmail address and App Password for sending login codes |

Frontend: `VITE_API_URL` (API base URL) and `VITE_GOOGLE_CLIENT_ID`.

---

## 🌐 API Reference

All endpoints except `/health` and the `/auth` login routes need the session cookie. Requests from the browser must send credentials (`credentials: "include"`).

### Authentication

| Method | Path | Body | Description |
|---|---|---|---|
| POST | `/auth/request-otp` | `{ "email" }` | Emails a 6-digit code. One request per email per minute |
| POST | `/auth/verify-otp` | `{ "email", "otp" }` | Verifies the code and sets the session cookie. Five attempts per code |
| POST | `/auth/google` | `{ "credential" }` | Verifies a Google ID token and sets the session cookie |
| GET | `/auth/me` | none | Returns the signed-in user, or 401 |
| POST | `/auth/logout` | none | Clears the session cookie |

### `POST /solve`

Analyze code and store the result.

**Request**

```json
{ "codeString": "your code here" }
```

**Response**

```json
{
  "cached": false,
  "report": {
    "id": 42,
    "language": "javascript",
    "score": 76.5,
    "grade": "B",
    "aiUsed": true,
    "bugs": [],
    "lint": [],
    "security": [],
    "complexity": { "cyclomatic": 3 },
    "redundancy": [],
    "suggestions": [],
    "formatted": "",
    "diff": "",
    "aiSuggestedRewrite": ""
  }
}
```

`cached` is `true` when the report came from Redis. `aiUsed` is `false` when the AI review was unavailable and only static analysis ran.

### `GET /reports?limit=50`

Your score history (id, language, score, grade, timestamp), newest first. Maximum 200 rows.

### `GET /reports/:id`

One of your stored reports, including the (redacted) code and the full analysis. Another user's report returns 404.

### `GET /health`

Returns `{ "status": "ok" }` when Postgres and Redis respond, otherwise 503.

### Errors

Errors return `{ "error": "message" }`.

| Status | Meaning |
|---|---|
| 400 | Invalid input (empty or too long code, invalid email or code) |
| 401 | Not signed in, or the session expired |
| 404 | Report not found |
| 422 | The language could not be detected or is unsupported |
| 429 | Rate limit, login attempt limit, or daily quota reached |
| 500 | Server error (details are logged, not returned) |
| 503 | A dependency is unavailable (`/health`) |

### Limits

| Limit | Value |
|---|---|
| Request body | 100 KB |
| Code length | 20,000 characters |
| All requests | 300 per 15 minutes per IP |
| Login routes | 20 per 10 minutes per IP |
| `/solve` | 5 per minute per user |
| AI analyses | 30 per day per user (UTC), cache hits are free |
| Login code | Valid for 5 minutes, single use, 1 per minute per email |
| AI call | 20 second timeout, 2 retries |
| Cached report | 24 hours |

The values live in `backend/src/middleware/rateLimit.js`, `backend/src/cache.js` and `backend/src/routes/auth.js`.

---

## 🔐 Security

**Web app**

- Passwordless login. Login codes are random (`crypto.randomInt`), stored only as an HMAC, single use, expire after 5 minutes, and allow 5 attempts. Comparison is constant-time.
- Google tokens are verified server-side (signature, audience and verified email).
- Sessions are JWTs in `httpOnly` cookies, so page scripts cannot read them.
- Every report query is scoped to the signed-in user in SQL, so guessing another user's ID returns 404.
- Secrets are redacted before code is sent to the LLM **and** before code, formatted output, diff and rewrite are stored.
- All SQL is parameterized. Inputs, environment variables and AI output are validated with Zod.
- Helmet security headers, a strict CORS origin, a request size limit and rate limiting on every route.

**CI tool**

- The PR comment is built from text that can come from an LLM or from file names, so HTML, backticks and `@mentions` are neutralized before posting.
- The git ref used for `--changed` is validated and passed to git without a shell.
- Action inputs reach the shell through environment variables, never interpolated into the script.
- Config files are validated strictly, so a typo fails loudly instead of silently weakening the gate.

---

## 🧪 Testing

```bash
cd backend
npm test
```

Unit tests use Node's built-in test runner and cover language detection, secret redaction and scoring. CI runs them on Node 20 and 22 for every push and pull request, and also runs this project's own quality gate on every pull request. `cd frontend && npm run lint` checks the frontend.

---

## 🚢 Deployment

A typical setup for the web app: Vercel (frontend), Render (API), Neon (Postgres), Upstash (Redis).

- **API:** set every variable from the table above, with `NODE_ENV=production` and `FRONTEND_URL` set to your frontend URL (no trailing slash). Don't set `PORT`. Use `npm start` and `/health` as the health check.
- **Frontend:** set `VITE_API_URL` to your API URL and `VITE_GOOGLE_CLIENT_ID`.
- **Google:** add the deployed frontend URL to the OAuth client's Authorized JavaScript origins.
- **Cookies:** with the frontend and API on different domains, the session cookie is `SameSite=None; Secure`. Serving both under one parent domain is safer.
- The API sets `trust proxy` so rate limiting sees each visitor's real IP behind the platform's proxy.

The CI tool needs no deployment. It runs inside your pipeline.

---

## 🧭 Known Limitations

**Analysis**

- Without `--ai`, the tool does not find logic bugs. It finds secrets, dangerous calls, syntax errors, unused JavaScript variables and complexity.
- TypeScript and JSX files are not analyzed.
- Python and C++ analysis is heuristic (line and indentation based), so it is less precise than the JavaScript and Java analyzers. The Python unused-variable check does not currently fire.
- Secret detection is regex-based and can miss or over-match. The hardcoded-secret rule only matches when the keyword starts the variable name, so names like `apiToken` or `db_password` are missed. A line matching two rules is counted twice.
- The diff compares lines by position, so one inserted line makes every following line appear changed.

**AI**

- The Groq model ID is hard-coded in `backend/index.js`. Groq retires models, and when the ID stops working the AI step falls back to static-only results (you will see `model_not_found` in the logs). Update the ID to a model listed on Groq's supported-models page.
- AI findings can be wrong, and each bug finding costs score. In CI, `--ai` is opt-in and this project's own pipeline does not use it.
- In the CLI, every `--ai` run re-sends the selected files, because there is no result cache yet.

**Web app**

- Sessions are stateless JWTs: logging out clears the cookie, but a stolen token stays valid until it expires (7 days).
- Rate limits use fixed windows, which allow short bursts at window boundaries.
- Two simultaneous requests for the same new code may both call the AI (no single-flight lock).
- The daily quota is used before the AI call, so a failed call still counts.
- Email login and rate limiting need Redis. If Redis is down, the cache is skipped but login and rate-limited routes fail.
- The database schema is created at startup rather than with a migration tool, and the database connection does not verify the server certificate.
- Automated tests cover core logic only. There are no API integration or frontend tests yet.

**CI tool**

- Pull requests from forks cannot receive the PR comment (read-only token). The Summary tab and the check still work.

---

## 🚀 Future Improvements

- TypeScript and JSX support
- Cache AI results by file hash so unchanged files are not re-sent
- Import findings from existing linters (ESLint, Bandit) into the same score
- Inline comments on the changed lines, not only a summary comment
- Real parsers for Python and C++ (tree-sitter)
- Proper diff algorithm (Myers) and syntax-aware formatting
- Async analysis with a job queue and streamed results
- Token refresh and revocable sessions
- Migrations, API integration tests, and more CLI tests
- Structured logging, metrics and error tracking

---

## 👨‍💻 Author

**Arman**
GitHub: [https://github.com/Arman0206](https://github.com/Arman0206)

---

## ⭐ Contribute

Feel free to fork this repo, raise issues, and submit PRs!