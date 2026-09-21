const crypto = require("crypto");
const redis = require("./redis");

const TTL_SECONDS = 60 * 60 * 24; // 24h

// "v1" lets you invalidate every cached result by bumping it when scoring/prompt logic changes.
const keyFor = (code) =>
  "analysis:v1:" + crypto.createHash("sha256").update(code.trim()).digest("hex");

// If Redis is down we just skip the cache; the app must not go down with it.
async function cacheGet(code) {
  try {
    const raw = await redis.get(keyFor(code));
    return raw ? JSON.parse(raw) : null;
  } catch (err) {
    console.error("cacheGet failed:", err.message);
    return null;
  }
}

async function cacheSet(code, report) {
  try {
    await redis.set(keyFor(code), JSON.stringify(report), "EX", TTL_SECONDS);
  } catch (err) {
    console.error("cacheSet failed:", err.message);
  }
}

// Daily AI budget per user (fixed window, resets at 00:00 UTC).
async function consumeAiQuota(userId, limit = 30) {
  const day = new Date().toISOString().slice(0, 10);
  const key = `quota:ai:${userId}:${day}`;
  const used = await redis.incr(key);
  if (used === 1) await redis.expire(key, 60 * 60 * 25);
  return { allowed: used <= limit, remaining: Math.max(0, limit - used) };
}

module.exports = { cacheGet, cacheSet, consumeAiQuota };