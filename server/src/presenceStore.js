const { getRedisClient } = require("./redisClient");

const PRESENCE_TTL_SECONDS = 30;

function getPresenceKey(documentId) {
  return `doc:${documentId}:presence`;
}

async function updatePresence(documentId, user, cursor) {
  const redis = await getRedisClient();
  const key = getPresenceKey(documentId);

  const presenceRecord = {
    userId: user.userId,
    email: user.email,
    cursor: {
      position: Number.isInteger(cursor?.position) ? cursor.position : 0,
      selectionStart: Number.isInteger(cursor?.selectionStart)
        ? cursor.selectionStart
        : null,
      selectionEnd: Number.isInteger(cursor?.selectionEnd)
        ? cursor.selectionEnd
        : null
    },
    updatedAt: new Date().toISOString()
  };

  await redis.hSet(key, user.userId, JSON.stringify(presenceRecord));
  await redis.expire(key, PRESENCE_TTL_SECONDS);

  return presenceRecord;
}

async function removePresence(documentId, userId) {
  const redis = await getRedisClient();
  const key = getPresenceKey(documentId);

  await redis.hDel(key, userId);
}

async function getPresenceList(documentId) {
  const redis = await getRedisClient();
  const key = getPresenceKey(documentId);

  const rawPresence = await redis.hGetAll(key);

  return Object.values(rawPresence).map((item) => JSON.parse(item));
}

module.exports = {
  updatePresence,
  removePresence,
  getPresenceList
};