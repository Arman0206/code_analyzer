const jwt = require("jsonwebtoken");

const isProd = process.env.NODE_ENV === "production";
const WEEK_MS = 7 * 24 * 60 * 60 * 1000;

// Frontend and backend on different domains (Vercel + Render) => SameSite=None; Secure
const COOKIE_OPTS = {
  httpOnly: true,
  secure: isProd,
  sameSite: isProd ? "none" : "lax",
  path: "/",
};

function issueSession(res, user) {
  const token = jwt.sign({ sub: user.id, email: user.email }, process.env.JWT_SECRET, { expiresIn: "7d" });
  res.cookie("token", token, { ...COOKIE_OPTS, maxAge: WEEK_MS });
}

function requireAuth(req, res, next) {
  const token = req.cookies?.token;
  if (!token) return res.status(401).json({ error: "Please log in" });
  try {
    req.user = jwt.verify(token, process.env.JWT_SECRET); // { sub, email, iat, exp }
    next();
  } catch {
    res.status(401).json({ error: "Session expired. Please log in again." });
  }
}

module.exports = { issueSession, requireAuth, COOKIE_OPTS };