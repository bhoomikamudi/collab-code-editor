const { createClient } = require("redis");

let redisClient = null;

async function getRedisClient() {
  if (redisClient && redisClient.isOpen) {
    return redisClient;
  }

  redisClient = createClient({
    url: process.env.REDIS_URL
  });

  redisClient.on("error", (error) => {
    console.error("Redis client error:", error.message);
  });

  await redisClient.connect();

  console.log("Connected to Redis");

  return redisClient;
}

async function closeRedisClient() {
  if (redisClient && redisClient.isOpen) {
    await redisClient.quit();
  }
}

module.exports = {
  getRedisClient,
  closeRedisClient
};