const { getRedisClient } = require("./redisClient");

function getOpsKey(documentId) {
  return `doc:${documentId}:ops`;
}

async function getOperationCount(documentId) {
  const redis = await getRedisClient();
  return redis.lLen(getOpsKey(documentId));
}

async function getOperationsSince(documentId, revision) {
  const redis = await getRedisClient();
  const key = getOpsKey(documentId);

  const rawOperations = await redis.lRange(key, revision, -1);

  return rawOperations.map((item) => JSON.parse(item));
}

async function appendOperation(documentId, operationRecord) {
  const redis = await getRedisClient();
  const key = getOpsKey(documentId);

  await redis.rPush(key, JSON.stringify(operationRecord));

  return redis.lLen(key);
}

async function clearOperationHistory(documentId) {
  const redis = await getRedisClient();
  await redis.del(getOpsKey(documentId));
}

module.exports = {
  getOperationCount,
  getOperationsSince,
  appendOperation,
  clearOperationHistory
};