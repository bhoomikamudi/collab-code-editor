const WebSocket = require("ws");

const [, , documentId, token] = process.argv;

if (!documentId || !token) {
  console.error("Usage: node src/testWebSocket.js <documentId> <jwtToken>");
  process.exit(1);
}

let operationAckReceived = false;
let cursorAckReceived = false;

const ws = new WebSocket("ws://server:5000");

function closeIfDone() {
  if (operationAckReceived && cursorAckReceived) {
    ws.close();
  }
}

ws.on("open", () => {
  console.log("Test client connected");

  ws.send(
    JSON.stringify({
      type: "JOIN_DOCUMENT",
      documentId,
      token
    })
  );
});

ws.on("message", (data) => {
  const message = JSON.parse(data.toString());
  console.log("Received:", message);

  if (message.type === "DOCUMENT_JOINED") {
    ws.send(
      JSON.stringify({
        type: "CURSOR",
        cursor: {
          position: 12,
          selectionStart: 12,
          selectionEnd: 20
        }
      })
    );

    ws.send(
      JSON.stringify({
        type: "OPERATION",
        revision: message.revision,
        operation: {
          type: "insert",
          position: 0,
          text: "// test operation from OT engine\n"
        }
      })
    );
  }

  if (message.type === "CURSOR_ACK") {
    cursorAckReceived = true;
    console.log("Cursor acknowledged:", message.presence);
    closeIfDone();
  }

  if (message.type === "OPERATION_ACK") {
    operationAckReceived = true;
    console.log("Operation acknowledged at revision:", message.revision);
    console.log("Updated document content:", message.document.content);
    closeIfDone();
  }

  if (message.type === "ERROR") {
    console.error("Server returned error:", message.error);
    ws.close();
  }
});

ws.on("close", () => {
  console.log("Test client disconnected");
  process.exit(0);
});

ws.on("error", (error) => {
  console.error("WebSocket error:", error.message);
  process.exit(1);
});