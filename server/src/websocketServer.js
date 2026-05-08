const WebSocket = require("ws");
const jwt = require("jsonwebtoken");
const { query } = require("./db");
const {
  getOperationCount,
  getOperationsSince,
  appendOperation
} = require("./operationStore");
const { applyOperation, transformAgainstHistory } = require("./otEngine");
const { getDocumentById, updateDocumentContent } = require("./documentStore");
const {
  updatePresence,
  removePresence,
  getPresenceList
} = require("./presenceStore");

const JWT_SECRET = process.env.JWT_SECRET;

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

  broadcastToRoom(documentId, ws, {
    type: "USER_JOINED",
    presence: initialPresence
  });
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

  const documentId = ws.documentId;
  const clientRevision = message.revision;

  const historySinceClientRevision = await getOperationsSince(
    documentId,
    clientRevision
  );

  const transformedOperation = transformAgainstHistory(
    message.operation,
    historySinceClientRevision
  );

  const currentDocument = await getDocumentById(documentId);
  const updatedContent = applyOperation(
    currentDocument.content,
    transformedOperation
  );

  const updatedDocument = await updateDocumentContent(documentId, updatedContent);

  const serverRevisionBeforeAppend = await getOperationCount(documentId);
  const operationRecord = {
    revision: serverRevisionBeforeAppend,
    operation: transformedOperation,
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

  const payload = {
    type: "REMOTE_OPERATION",
    documentId,
    operation: transformedOperation,
    revision: serverRevisionAfterAppend,
    user: operationRecord.user
  };

  broadcastToRoom(documentId, ws, payload);

  return sendJson(ws, {
    type: "OPERATION_ACK",
    revision: serverRevisionAfterAppend,
    operation: transformedOperation,
    document: updatedDocument
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

  broadcastToRoom(ws.documentId, ws, {
    type: "CURSOR_UPDATE",
    presence
  });

  return sendJson(ws, {
    type: "CURSOR_ACK",
    presence
  });
}

function setupWebSocketServer(server) {
  const wss = new WebSocket.Server({ server });

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

          broadcastToRoom(ws.documentId, ws, {
            type: "USER_LEFT",
            user: {
              userId: ws.user.userId,
              email: ws.user.email
            }
          });
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