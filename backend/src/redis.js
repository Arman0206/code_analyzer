const Redis = require("ioredis");

const redis = new Redis(process.env.REDIS_URL || "redis://localhost:6379", {
  maxRetriesPerRequest: 2,
});
redis.on("error", (err) => console.error("Redis error:", err.message));

module.exports = redis;