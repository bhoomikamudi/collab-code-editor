const WebSocket = require("ws");
const jwt = require("jsonwebtoken");
const { query } = require("./db");
const {
  getOperationCount,
  getOperationsSince,
  appendOperation
} = require("./operationStore");
const {
  applyTextOperation,
  buildAndTransformOperation,
  textOperationToSimple
} = require("./otEngine");
const { getDocumentById, updateDocumentContent } = require("./documentStore");
const {
  updatePresence,
  removePresence,
  getPresenceList
} = require("./presenceStore");
const { createDocumentSnapshot } = require("./snapshotStore");
const {
  initPubSub,
  publishCollaborationEvent
} = require("./pubsub");

const JWT_SECRET = process.env.JWT_SECRET;
const SNAPSHOT_INTERVAL = 50;

const documentRooms = new Map();

function getRoom(documentId) {
  if (!documentRooms.has(documentId)) {
    documentRooms.set(documentId, new Set());
  }

  return documentRooms.get(documentId);
}

function sendJson(ws, payload) {
  if (ws.readyState === WebSocket.OPEN) {
    ws.send(JSON.stringify(payload));
  }
}

function broadcastToRoom(documentId, senderWs, payload) {
  const room = documentRooms.get(documentId);

  if (!room) {
    return;
  }

  room.forEach((client) => {
    if (client !== senderWs && client.readyState === WebSocket.OPEN) {
      sendJson(client, payload);
    }
  });
}

// Broadcast to every local client in the room. Used for events received from
// other server instances via Redis pub/sub (the originating client lives elsewhere).
function broadcastToRoomAll(documentId, payload) {
  const room = documentRooms.get(documentId);

  if (!room) {
    return;
  }

  room.forEach((client) => {
    if (client.readyState === WebSocket.OPEN) {
      sendJson(client, payload);
    }
  });
}

async function publishRoomEvent(documentId, payload) {
  try {
    await publishCollaborationEvent(documentId, payload);
  } catch (error) {
    console.error("Failed to publish collaboration event:", error.message);
  }
}

async function canAccessDocument(documentId, userId) {
  const result = await query(
    `SELECT d.id
     FROM documents d
     LEFT JOIN document_collaborators dc ON d.id = dc.document_id
     WHERE d.id = $1 AND (d.owner_id = $2 OR dc.user_id = $2)`,
    [documentId, userId]
  );

  return result.rows.length > 0;
}

async function maybeCreateSnapshot({
  documentId,
  content,
  revision,
  createdBy
}) {
  if (revision <= 0 || revision % SNAPSHOT_INTERVAL !== 0) {
    return null;
  }

  return createDocumentSnapshot({
    documentId,
    content,
    revision,
    createdBy
  });
}

async function handleJoinDocument(ws, message) {
  const { documentId, token } = message;

  if (!documentId || !token) {
    return sendJson(ws, {
      type: "ERROR",
      error: "documentId and token are required"
    });
  }

  const decoded = jwt.verify(token, JWT_SECRET);
  const hasAccess = await canAccessDocument(documentId, decoded.userId);

  if (!hasAccess) {
    return sendJson(ws, {
      type: "ERROR",
      error: "You do not have access to this document"
    });
  }

  const document = await getDocumentById(documentId);
  const revision = await getOperationCount(documentId);

  ws.user = decoded;
  ws.documentId = documentId;

  const room = getRoom(documentId);
  room.add(ws);

  const initialPresence = await updatePresence(documentId, decoded, {
    position: 0,
    selectionStart: null,
    selectionEnd: null
  });

  const activeUsers = await getPresenceList(documentId);

  sendJson(ws, {
    type: "DOCUMENT_JOINED",
    document,
    revision,
    presence: activeUsers
  });

  const userJoinedPayload = {
    type: "USER_JOINED",
    presence: initialPresence
  };

  broadcastToRoom(documentId, ws, userJoinedPayload);
  await publishRoomEvent(documentId, userJoinedPayload);
}

async function handleOperation(ws, message) {
  if (!ws.user || !ws.documentId) {
    return sendJson(ws, {
      type: "ERROR",
      error: "Join a document before sending operations"
    });
  }

  if (!Number.isInteger(message.revision) || message.revision < 0) {
    return sendJson(ws, {
      type: "ERROR",
      error: "A valid revision number is required"
    });
  }

  if (!message.operation || typeof message.operation !== "object") {
    return sendJson(ws, {
      type: "ERROR",
      error: "A valid operation is required"
    });
  }

  const documentId = ws.documentId;
  const clientRevision = message.revision;

  const historySinceClientRevision = await getOperationsSince(
    documentId,
    clientRevision
  );

  const currentDocument = await getDocumentById(documentId);
  const baseContent = currentDocument.content || "";

  const transformedTextOperation = buildAndTransformOperation({
    simpleOperation: message.operation,
    baseContentLength: baseContent.length,
    history: historySinceClientRevision
  });

  const updatedContent = applyTextOperation(
    baseContent,
    transformedTextOperation
  );

  const transformedOperation = textOperationToSimple(
    baseContent,
    updatedContent
  );

  const updatedDocument = await updateDocumentContent(documentId, updatedContent);

  const serverRevisionBeforeAppend = await getOperationCount(documentId);

  const operationRecord = {
    revision: serverRevisionBeforeAppend,
    operation: transformedOperation,
    otOperation: transformedTextOperation.toJSON(),
    baseContentLength: baseContent.length,
    user: {
      userId: ws.user.userId,
      email: ws.user.email
    },
    createdAt: new Date().toISOString()
  };

  const serverRevisionAfterAppend = await appendOperation(
    documentId,
    operationRecord
  );

  const snapshot = await maybeCreateSnapshot({
    documentId,
    content: updatedDocument.content,
    revision: serverRevisionAfterAppend,
    createdBy: ws.user.userId
  });

  const payload = {
    type: "REMOTE_OPERATION",
    documentId,
    operation: transformedOperation,
    revision: serverRevisionAfterAppend,
    user: operationRecord.user
  };

  broadcastToRoom(documentId, ws, payload);
  await publishRoomEvent(documentId, payload);

  return sendJson(ws, {
    type: "OPERATION_ACK",
    revision: serverRevisionAfterAppend,
    operation: transformedOperation,
    document: updatedDocument,
    snapshot_created: snapshot
      ? {
          id: snapshot.id,
          revision: snapshot.revision,
          created_at: snapshot.created_at
        }
      : null
  });
}

async function handleCursor(ws, message) {
  if (!ws.user || !ws.documentId) {
    return sendJson(ws, {
      type: "ERROR",
      error: "Join a document before sending cursor updates"
    });
  }

  const presence = await updatePresence(
    ws.documentId,
    ws.user,
    message.cursor || {}
  );

  const cursorPayload = {
    type: "CURSOR_UPDATE",
    presence
  };

  broadcastToRoom(ws.documentId, ws, cursorPayload);
  await publishRoomEvent(ws.documentId, cursorPayload);

  return sendJson(ws, {
    type: "CURSOR_ACK",
    presence
  });
}

function setupWebSocketServer(server) {
  const wss = new WebSocket.Server({ server });

  // Redis pub/sub enables horizontal scaling: collaboration events published by
  // one Node instance are relayed to WebSocket clients connected to other instances.
  initPubSub((event) => {
    broadcastToRoomAll(event.documentId, event.payload);
  }).catch((error) => {
    console.error("Failed to initialize Redis pub/sub:", error.message);
  });

  wss.on("connection", (ws) => {
    ws.user = null;
    ws.documentId = null;

    sendJson(ws, {
      type: "CONNECTED",
      message: "WebSocket connection established"
    });

    ws.on("message", async (rawMessage) => {
      try {
        const message = JSON.parse(rawMessage.toString());

        if (message.type === "JOIN_DOCUMENT") {
          await handleJoinDocument(ws, message);
          return;
        }

        if (message.type === "OPERATION") {
          await handleOperation(ws, message);
          return;
        }

        if (message.type === "CURSOR") {
          await handleCursor(ws, message);
          return;
        }

        return sendJson(ws, {
          type: "ERROR",
          error: `Unknown message type: ${message.type}`
        });
      } catch (error) {
        console.error("WebSocket message handling error:", error);
        console.error(error.stack);

        return sendJson(ws, {
          type: "ERROR",
          error: error.message || "Invalid WebSocket message"
        });
      }
    });

    ws.on("close", async () => {
      if (ws.documentId && documentRooms.has(ws.documentId)) {
        const room = documentRooms.get(ws.documentId);
        room.delete(ws);

        if (ws.user) {
          await removePresence(ws.documentId, ws.user.userId);

          const userLeftPayload = {
            type: "USER_LEFT",
            user: {
              userId: ws.user.userId,
              email: ws.user.email
            }
          };

          broadcastToRoom(ws.documentId, ws, userLeftPayload);
          await publishRoomEvent(ws.documentId, userLeftPayload);
        }

        if (room.size === 0) {
          documentRooms.delete(ws.documentId);
        }
      }
    });
  });

  console.log("WebSocket server attached to HTTP server");

  return wss;
}

module.exports = {
  setupWebSocketServer
};