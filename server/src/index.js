const http = require("http");
const express = require("express");
const cors = require("cors");
require("dotenv").config();

const authRoutes = require("./authRoutes");
const documentRoutes = require("./documentRoutes");
const { setupWebSocketServer } = require("./websocketServer");

const app = express();

const PORT = process.env.PORT || 5000;
const CLIENT_URL = process.env.CLIENT_URL || "http://localhost:3000";

app.use(cors({ origin: CLIENT_URL }));
app.use(express.json());

app.get("/health", (req, res) => {
  res.status(200).json({
    status: "ok",
    service: "collab-code-editor-server",
    timestamp: new Date().toISOString()
  });
});

app.use("/auth", authRoutes);
app.use("/documents", documentRoutes);

const server = http.createServer(app);

setupWebSocketServer(server);

server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});