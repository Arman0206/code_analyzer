// Validates environment variables once at startup. Fail fast beats failing at 2am.
require("dotenv").config();
const { z } = require("zod");

const Env = z.object({
  NODE_ENV: z.string().default("development"),
  PORT: z.coerce.number().default(8000),
  DATABASE_URL: z.string().min(1, "required"),
  REDIS_URL: z.string().default("redis://localhost:6379"),
  GROQ_API_KEY: z.string().min(1, "required"),
  JWT_SECRET: z.string().min(32, "must be at least 32 characters"),
  GOOGLE_CLIENT_ID: z.string().min(1, "required"),
  FRONTEND_URL: z.string().default("http://localhost:5173"),
  SMTP_USER: z.string().optional(),
  SMTP_PASS: z.string().optional(),
});

const parsed = Env.safeParse(process.env);
if (!parsed.success) {
  const problems = parsed.error.issues.map((i) => `  - ${i.path.join(".")}: ${i.message}`).join("\n");
  console.error("Invalid environment variables:\n" + problems);
  process.exit(1);
}
module.exports = parsed.data;