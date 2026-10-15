
# 🚀 AI Code Analyzer

A full-stack code review tool. Sign in, paste JavaScript, Python, Java or C++, and get a scored report that combines deterministic static analysis with an LLM review. Each report is saved to a database, so you can reopen it and track your score over time.

The API is built for public use: passwordless login, per-user rate limits and daily quotas, a Redis cache for repeat submissions, secret redaction, and graceful fallback when the AI provider is unavailable.

---

## 🧠 Features

**Analysis**

- 🔍 **Multi-language support**: JavaScript, Python, Java, C++
- 🧪 **Static analysis**: real AST parsing for JavaScript (Acorn), CST parsing for Java (java-parser), and heuristic line and indentation analysis for Python and C++
- 🤖 **AI code review**: semantic analysis with Groq (Llama 3.3 70B). The reply is validated against a schema, so malformed model output can't break a report
- 🔐 **Secret detection and redaction**: API keys, hardcoded credentials and dangerous calls (`eval`, `os.system`) are detected and masked before code is sent to the LLM, and again before anything is stored
- 🧾 **Deterministic formatting and diff**: Prettier for JavaScript and a brace-indent formatter for other languages produce the formatted code and diff, so the result never depends on an LLM reproducing your file. The AI's own rewrite is returned separately
- 📊 **Weighted scoring**: bugs, security, complexity, redundancy and lint each contribute a penalty (see [Scoring](#-scoring))

**Platform**

- 🔑 **Passwordless authentication**: email one-time codes or Google Sign-In. Sessions use a signed JWT in an `httpOnly` cookie
- 🚦 **Rate limiting**: Redis-backed limits per IP and per user, plus a daily AI quota per user
- ⚡ **Caching**: identical code is served from Redis, with no AI call and no quota used
- 💾 **Per-user history**: every report is stored under your account. Reopen any past report, and see your score trend
- 🖥️ **Workspace UI**: side-by-side editor and review, issue groups, a diff view, formatted code with copy, light and dark themes, and a `Ctrl/⌘ + Enter` shortcut

---

## 🏗️ Architecture

```
Browser: React + Vite + Monaco
   |  HTTPS, JWT in httpOnly cookie
   v
Express API
 |- helmet > cors > json(100kb) > cookieParser > global rate limit
 |- /health ------------------------> Postgres + Redis
 |- /auth/* (OTP, Google, me, logout) -> Redis (OTP state) + Postgres (users)
 |- /solve
 |     requireAuth > burst limit > input validation
 |        |- cache HIT (Redis) -----------------------------+
 |        '- MISS > daily quota (Redis)                      |
 |              > detect language > static analysis          |
 |              > redact secrets > Groq LLM (timeout + retry)|
 |              > format + diff > weighted score             |
 |              > cache result (Redis) ----------------------+
 |                                                           v
 |                                   save redacted report (Postgres) > respond
 '- /reports, /reports/:id --- requireAuth > Postgres (ownership enforced in SQL)
```

| Store | Holds | Why |
|---|---|---|
| PostgreSQL | Users and reports | Durable data with ownership and history |
| Redis | Rate-limit counters, OTP hashes, daily quotas, cached reports | Atomic counters, expiry (TTL), and state shared across server instances |

---

## 🛠️ Tech Stack

**Frontend**

- React 19 (Vite)
- Monaco Editor
- Recharts
- `@react-oauth/google`
- IBM Plex Sans and JetBrains Mono (self-hosted via Fontsource)

**Backend**

- Node.js and Express 5
- PostgreSQL via `pg` (any host, including [Neon](https://neon.tech))
- Redis via `ioredis`, with `express-rate-limit` and `rate-limit-redis`
- Groq SDK (LLM inference)
- Acorn and acorn-walk (JavaScript AST), java-parser (Java CST), Prettier (JS formatting)
- `jsonwebtoken`, `google-auth-library`, `nodemailer` (auth)
- `zod` (request, environment and AI-output validation), `helmet`, `cors`, `cookie-parser`

---

## ⚙️ How It Works

1. You sign in with an emailed one-time code or with Google. The server sets a signed session cookie.
2. You paste code into the Monaco editor and press **Analyze code**.
3. The API checks your session, your rate limits and the input (non-empty, at most 20,000 characters).
4. If the same code was analyzed recently, the cached report is returned immediately and your daily quota is not used.
5. Otherwise the language is detected and a language-specific static analyzer computes complexity and lint findings.
6. Secrets and dangerous patterns are detected and redacted.
7. The **redacted** code goes to the Groq LLM for bugs, redundancy and suggestions. If the AI fails, you still get the static-analysis report, marked as such.
8. A deterministic formatter produces the formatted code and diff.
9. Static and AI findings are merged into one weighted score.
10. The report is stored (redacted) under your account and returned to the UI, which renders it and refreshes your history.

---

## 📁 Project Structure

```
code_analyzer/
├── docker-compose.yml          Local Postgres + Redis
├── backend/
│   ├── server.js               Express app: middleware, routes, error handling
│   ├── index.js                Analysis pipeline: AI call, merge, scoring
│   ├── db.js                   Postgres pool, schema, queries
│   ├── security.js             Secret detection and redaction
│   ├── maths.js                Weighted score calculation
│   ├── src/
│   │   ├── config.js           Validates environment variables at startup
│   │   ├── redis.js            Redis client
│   │   ├── cache.js            Result cache and daily AI quota
│   │   ├── router.js           Language detection and analyzer dispatch
│   │   ├── formatter.js        Prettier / brace formatter
│   │   ├── diff.js             Line diff
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

### Prerequisites

- Node.js 18 or newer (20+ recommended)
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

## 📊 Scoring

Each category produces a penalty from 0 to 100, and the score is `100 - (weighted sum of penalties)`, never below 0.

| Category | Weight | Penalty |
|---|---|---|
| Bugs | 30% | 35 per bug (static and AI), capped at 100 |
| Security | 30% | 40 per finding, capped at 100 |
| Complexity | 20% | 10 for each cyclomatic point above 8, capped at 100 |
| Redundancy | 10% | 20 per item, capped at 100 |
| Lint | 10% | 10 per warning, capped at 100 |

Grades: **A** above 85, **B** above 70, otherwise **C**. Weights must sum to 1, and the app refuses to start scoring if they don't.

---

## 🔐 Security

- Passwordless login. Login codes are random (`crypto.randomInt`), stored only as an HMAC, single use, expire after 5 minutes, and allow 5 attempts. Comparison is constant-time.
- Google tokens are verified server-side (signature, audience and verified email).
- Sessions are JWTs in `httpOnly` cookies, so page scripts cannot read them.
- Every report query is scoped to the signed-in user in SQL, so guessing another user's ID returns 404.
- Secrets are redacted before code is sent to the LLM **and** before code, formatted output, diff and rewrite are stored.
- All SQL is parameterized. Inputs, environment variables and AI output are validated with Zod.
- Helmet security headers, a strict CORS origin, a request size limit and rate limiting on every route.

---

## 🧪 Testing

```bash
cd backend
npm test
```

Unit tests use Node's built-in test runner and cover language detection, secret redaction and scoring. `cd frontend && npm run lint` checks the frontend.

---

## 🚢 Deployment

A typical setup: Vercel (frontend), Render (API), Neon (Postgres), Upstash (Redis).

- **API:** set every variable from the table above, with `NODE_ENV=production` and `FRONTEND_URL` set to your frontend URL (no trailing slash). Don't set `PORT`. Use `npm start` and `/health` as the health check.
- **Frontend:** set `VITE_API_URL` to your API URL and `VITE_GOOGLE_CLIENT_ID`.
- **Google:** add the deployed frontend URL to the OAuth client's Authorized JavaScript origins.
- **Cookies:** with the frontend and API on different domains, the session cookie is `SameSite=None; Secure`. Serving both under one parent domain (for example `app.example.com` and `api.example.com`) is safer.
- The API sets `trust proxy` so rate limiting sees each visitor's real IP behind the platform's proxy.

---

## 🧭 Known Limitations

- Python and C++ analysis is heuristic (line and indentation based), so it is less precise than the JavaScript and Java analyzers. The Python unused-variable check does not currently fire.
- The diff compares lines by position, so one inserted line makes every following line appear changed.
- Sessions are stateless JWTs: logging out clears the cookie, but a stolen token stays valid until it expires (7 days).
- Rate limits use fixed windows, which allow short bursts at window boundaries.
- Two simultaneous requests for the same new code may both call the AI (no single-flight lock).
- The daily quota is used before the AI call, so a failed call still counts.
- Email login and rate limiting need Redis. If Redis is down, the cache is skipped but login and rate-limited routes fail.
- Secret detection is regex-based and can miss or over-match. A line matching two rules is counted twice.
- The database schema is created at startup rather than with a migration tool, and the database connection does not verify the server certificate.
- Automated tests cover core logic only. There are no API integration or frontend tests yet.

---

## 🚀 Future Improvements

- Real parsers for Python and C++ (tree-sitter)
- Proper diff algorithm (Myers) and syntax-aware formatting
- Async analysis with a job queue and streamed results
- Token refresh and revocable sessions
- Sliding-window or token-bucket rate limiting
- Migrations, integration tests, and a CI pipeline (GitHub Actions)
- Structured logging, metrics and error tracking
- Dockerfile for the API, and additional languages

---

## 👨‍💻 Author

**Arman**
GitHub: [https://github.com/Arman0206](https://github.com/Arman0206)

---

## ⭐ Contribute

Feel free to fork this repo, raise issues, and submit PRs!
