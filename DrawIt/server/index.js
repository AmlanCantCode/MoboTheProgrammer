const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const cors = require("cors");
const game = require("./gameManager");

const ORIGIN = process.env.CLIENT_ORIGIN || "*"; // set to your Vercel URL in prod

const app = express();
app.use(cors({ origin: ORIGIN }));

// Health check endpoint for keeping Render awake 24/7 via cron-job.org
app.get("/health", (req, res) => res.status(200).send("OK"));

const server = http.createServer(app);
const io = new Server(server, {
  cors: { origin: ORIGIN, methods: ["GET", "POST"] },
  pingInterval: 10000,
  pingTimeout: 8000, // drop dead tabs quickly so ghost drawers don't linger
});

io.on("connection", (socket) => {
  console.log(`User connected: ${socket.id}`);

  socket.on("join_room", (p) => game.joinRoom(io, socket, p));
  socket.on("leave_room", () => game.leaveRoom(io, socket.id));
  socket.on("update_settings", (p) => game.updateSettings(io, socket, p));
  socket.on("start_game", () => game.startGame(io, socket));
  socket.on("select_word", (p) => game.selectWord(io, socket, p));
  socket.on("send_guess", (p) => game.handleGuess(io, socket, p));
  socket.on("draw_stroke", (p) => game.handleStroke(socket, p));
  socket.on("fill", (p) => game.handleFill(socket, p));
  socket.on("undo", () => game.handleUndo(io, socket));
  socket.on("clear_canvas", () => game.handleClear(socket));

  socket.on("disconnect", () => {
    console.log(`User disconnected: ${socket.id}`);
    game.leaveRoom(io, socket.id);
  });
});

const PORT = process.env.PORT || 4000;
server.listen(PORT, () => {
  console.log(`DrawIt game server running on port ${PORT}`);
});
