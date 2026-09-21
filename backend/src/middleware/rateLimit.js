const rateLimit = require("express-rate-limit");
const { RedisStore } = require("rate-limit-redis");
const redis = require("../redis");

const make = (prefix, options) =>
  rateLimit({
    standardHeaders: "draft-7",
    legacyHeaders: false,
    message: { error: "Too many requests. Please slow down." },
    store: new RedisStore({
      prefix: `rl:${prefix}:`,
      sendCommand: (...args) => redis.call(...args),
    }),
    ...options,
  });

// Every request, per IP
const globalLimiter = make("global", { windowMs: 15 * 60 * 1000, limit: 300 });

// Login / OTP endpoints, per IP (stops OTP spam and brute force)
const authLimiter = make("auth", { windowMs: 10 * 60 * 1000, limit: 20 });

// /solve burst limit, per logged-in user (must run AFTER requireAuth)
const solveBurstLimiter = make("solve", {
  windowMs: 60 * 1000,
  limit: 5,
  keyGenerator: (req) => `user:${req.user.sub}`,
});

module.exports = { globalLimiter, authLimiter, solveBurstLimiter };