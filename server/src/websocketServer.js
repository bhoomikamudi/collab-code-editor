const WebSocket = require("ws");
const jwt = require("jsonwebtoken");
const { query } = require("./db");

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

async function getDocument(documentId) {
  const result = await query(
    `SELECT id, title, content, updated_at
     FROM documents
     WHERE id = $1`,
    [documentId]
  );

  return result.rows[0];
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

          const document = await getDocument(documentId);

          ws.user = decoded;
          ws.documentId = documentId;

          const room = getRoom(documentId);
          room.add(ws);

          sendJson(ws, {
            type: "DOCUMENT_JOINED",
            document,
            revision: 0
          });

          broadcastToRoom(documentId, ws, {
            type: "USER_JOINED",
            user: {
              userId: decoded.userId,
              email: decoded.email
            }
          });

          return;
        }

        if (message.type === "OPERATION") {
          if (!ws.user || !ws.documentId) {
            return sendJson(ws, {
              type: "ERROR",
              error: "Join a document before sending operations"
            });
          }

          const payload = {
            type: "REMOTE_OPERATION",
            documentId: ws.documentId,
            operation: message.operation,
            revision: message.revision || 0,
            user: {
              userId: ws.user.userId,
              email: ws.user.email
            }
          };

          broadcastToRoom(ws.documentId, ws, payload);

          return sendJson(ws, {
            type: "OPERATION_ACK",
            revision: message.revision || 0
          });
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

    ws.on("close", () => {
      if (ws.documentId && documentRooms.has(ws.documentId)) {
        const room = documentRooms.get(ws.documentId);
        room.delete(ws);

        if (room.size === 0) {
          documentRooms.delete(ws.documentId);
        } else if (ws.user) {
          broadcastToRoom(ws.documentId, ws, {
            type: "USER_LEFT",
            user: {
              userId: ws.user.userId,
              email: ws.user.email
            }
          });
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