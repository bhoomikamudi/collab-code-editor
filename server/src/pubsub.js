const crypto = require("crypto");
const { createClient } = require("redis");

// Redis pub/sub lets multiple Node server instances share collaboration events.
// Each instance publishes after local handling and broadcasts events received
// from other instances to its connected WebSocket clients.
const COLLABORATION_CHANNEL = "collab:websocket:events";

const serverInstanceId =
  process.env.SERVER_INSTANCE_ID || crypto.randomUUID();

let publisherClient = null;
let subscriberClient = null;
let messageHandler = null;

function getServerInstanceId() {
  return serverInstanceId;
}

function createRedisConnection() {
  return createClient({
    url: process.env.REDIS_URL
  });
}

async function getPublisherClient() {
  if (publisherClient && publisherClient.isOpen) {
    return publisherClient;
  }

  publisherClient = createRedisConnection();

  publisherClient.on("error", (error) => {
    console.error("Redis pub/sub publisher error:", error.message);
  });

  await publisherClient.connect();

  return publisherClient;
}

async function publishCollaborationEvent(documentId, payload) {
  const publisher = await getPublisherClient();

  const message = JSON.stringify({
    serverInstanceId,
    documentId,
    payload
  });

  await publisher.publish(COLLABORATION_CHANNEL, message);
}

async function initPubSub(onRemoteEvent) {
  if (subscriberClient && subscriberClient.isOpen) {
    messageHandler = onRemoteEvent;
    return;
  }

  messageHandler = onRemoteEvent;

  subscriberClient = createRedisConnection();

  subscriberClient.on("error", (error) => {
    console.error("Redis pub/sub subscriber error:", error.message);
  });

  await subscriberClient.connect();
  await subscriberClient.subscribe(COLLABORATION_CHANNEL, (message) => {
    try {
      const event = JSON.parse(message);

      if (
        !event ||
        typeof event.documentId !== "string" ||
        !event.payload ||
        typeof event.payload !== "object"
      ) {
        return;
      }

      if (event.serverInstanceId === serverInstanceId) {
        return;
      }

      if (typeof messageHandler === "function") {
        messageHandler(event);
      }
    } catch (error) {
      console.error("Redis pub/sub message handling error:", error.message);
    }
  });

  console.log(
    `Redis pub/sub subscriber ready (instance ${serverInstanceId.slice(0, 8)})`
  );
}

async function closePubSub() {
  if (subscriberClient && subscriberClient.isOpen) {
    await subscriberClient.unsubscribe(COLLABORATION_CHANNEL);
    await subscriberClient.quit();
    subscriberClient = null;
  }

  if (publisherClient && publisherClient.isOpen) {
    await publisherClient.quit();
    publisherClient = null;
  }
}

module.exports = {
  getServerInstanceId,
  initPubSub,
  publishCollaborationEvent,
  closePubSub
};
