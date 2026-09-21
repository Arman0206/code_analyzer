const express = require("express");
const crypto = require("crypto");
const nodemailer = require("nodemailer");
const { OAuth2Client } = require("google-auth-library");
const { z } = require("zod");
const redis = require("../redis");
const { upsertUser } = require("../../db");
const { issueSession, requireAuth, COOKIE_OPTS } = require("../middleware/auth");
const { authLimiter } = require("../middleware/rateLimit");

const router = express.Router();
const isProd = process.env.NODE_ENV === "production";
const googleClient = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);

const OTP_TTL = 300; // seconds
const MAX_ATTEMPTS = 5;

const mailer = process.env.SMTP_USER
  ? nodemailer.createTransport({
      service: "gmail",
      auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS }, // Gmail *App Password*
    })
  : null;

async function sendOtpEmail(email, otp) {
  if (!mailer) {
    if (isProd) throw new Error("SMTP is not configured");
    console.log(`[DEV ONLY] OTP for ${email}: ${otp}`);
    return;
  }
  await mailer.sendMail({
    from: `"AI Code Analyzer" <${process.env.SMTP_USER}>`,
    to: email,
    subject: "Your login code",
    text: `Your code is ${otp}. It expires in 5 minutes. If you didn't request it, ignore this email.`,
  });
}

// Store only a hash of the OTP, never the OTP itself.
const hashOtp = (email, otp) =>
  crypto.createHmac("sha256", process.env.JWT_SECRET).update(`${email}:${otp}`).digest("hex");

const Email = z.string().trim().toLowerCase().email().max(254);

// 1) ask for a code
router.post("/request-otp", authLimiter, async (req, res) => {
  const parsed = z.object({ email: Email }).safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: "Enter a valid email" });
  const { email } = parsed.data;

  // one code per 60s per email (NX = only set if not already set)
  const cooldownKey = `otp:cooldown:${email}`;
  const fresh = await redis.set(cooldownKey, "1", "EX", 60, "NX");
  if (!fresh) return res.status(429).json({ error: "Wait a minute before requesting another code" });

  const otp = String(crypto.randomInt(100000, 1000000)); // cryptographically secure
  await redis.set(`otp:${email}`, hashOtp(email, otp), "EX", OTP_TTL);
  await redis.del(`otp:attempts:${email}`);

  try {
    await sendOtpEmail(email, otp);
  } catch (err) {
    await redis.del(cooldownKey);
    throw err;
  }
  res.json({ message: "Code sent" });
});

// 2) verify the code -> log in
router.post("/verify-otp", authLimiter, async (req, res) => {
  const parsed = z.object({ email: Email, otp: z.string().regex(/^\d{6}$/) }).safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: "Invalid email or code" });
  const { email, otp } = parsed.data;

  const attemptsKey = `otp:attempts:${email}`;
  const attempts = await redis.incr(attemptsKey);
  if (attempts === 1) await redis.expire(attemptsKey, OTP_TTL);
  if (attempts > MAX_ATTEMPTS) return res.status(429).json({ error: "Too many wrong attempts. Request a new code." });

  const stored = await redis.get(`otp:${email}`);
  if (!stored) return res.status(400).json({ error: "Code expired. Request a new one." });

  const a = Buffer.from(stored);
  const b = Buffer.from(hashOtp(email, otp));
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return res.status(400).json({ error: "Wrong code" });

  await redis.del(`otp:${email}`, attemptsKey); // single use
  const user = await upsertUser({ email });
  issueSession(res, user);
  res.json({ user });
});

// Google sign-in: the frontend sends Google's ID token, we verify it server-side
router.post("/google", authLimiter, async (req, res) => {
  const credential = req.body?.credential;
  if (typeof credential !== "string") return res.status(400).json({ error: "Missing credential" });

  let payload;
  try {
    const ticket = await googleClient.verifyIdToken({ idToken: credential, audience: process.env.GOOGLE_CLIENT_ID });
    payload = ticket.getPayload();
  } catch {
    return res.status(401).json({ error: "Invalid Google token" });
  }
  if (!payload?.email || !payload.email_verified) return res.status(401).json({ error: "Google email is not verified" });

  const user = await upsertUser({ email: payload.email, name: payload.name, googleId: payload.sub });
  issueSession(res, user);
  res.json({ user });
});

router.get("/me", requireAuth, (req, res) => res.json({ user: { id: req.user.sub, email: req.user.email } }));

router.post("/logout", (req, res) => {
  res.clearCookie("token", COOKIE_OPTS);
  res.json({ ok: true });
});

module.exports = router;