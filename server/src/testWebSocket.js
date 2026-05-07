const WebSocket = require("ws");

const [, , documentId, token] = process.argv;

if (!documentId || !token) {
  console.error("Usage: node src/testWebSocket.js <documentId> <jwtToken>");
  process.exit(1);
}

const ws = new WebSocket("ws://server:5000");

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
        type: "OPERATION",
        revision: 0,
        operation: {
          type: "insert",
          position: 0,
          text: "// test operation\n"
        }
      })
    );
  }

  if (message.type === "OPERATION_ACK") {
    console.log("Operation acknowledged");
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