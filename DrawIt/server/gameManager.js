const { getRandomWords } = require("./words");

const CHOOSE_MS = 15000;
const BREAK_MS = 5000;
const MIN_PLAYERS = 2;
const MAX_PLAYERS = 12;
const MAX_OPS = 8000;
const ROUND_OPTIONS = [2, 3, 4, 5, 6];
const TIME_OPTIONS = [30, 45, 60, 80, 100, 120];

const rooms = {}; // roomId -> room
const socketRoom = {}; // socketId -> roomId

/* -------------------------------- helpers -------------------------------- */

const sanitize = (s, max) => String(s ?? "").replace(/\s+/g, " ").trim().slice(0, max);
const mask = (word) => word.replace(/[a-zA-Z]/g, "_");

function createRoom(roomId) {
  return {
    roomId,
    players: [],
    hostId: null,
    settings: { rounds: 3, drawTime: 80 },
    status: "waiting", // waiting | choosing | playing | round_over | game_over
    round: 0,
    queue: [], // player ids still to draw this round
    drawerId: null,
    word: "",
    choices: [],
    revealed: new Set(),
    turnEndsAt: 0,
    ops: [], // canvas history: {t:"seg"|"fill", ...}
    lastRoundOver: null,
    avatarCounter: 0,
    timers: { choose: null, turn: null, next: null, hints: [] },
  };
}

function clearTimers(room) {
  const t = room.timers;
  for (const k of ["choose", "turn", "next"]) {
    if (t[k]) clearTimeout(t[k]);
    t[k] = null;
  }
  t.hints.forEach(clearTimeout);
  t.hints = [];
}

const roomOf = (socketId) => rooms[socketRoom[socketId]];
const turnMs = (room) => room.settings.drawTime * 1000;

function publicState(room) {
  return {
    roomId: room.roomId,
    status: room.status,
    round: room.round,
    rounds: room.settings.rounds,
    drawTime: room.settings.drawTime,
    hostId: room.hostId,
    drawerId: room.drawerId,
    players: room.players.map(({ id, username, score, guessed, avatar }) => ({
      id, username, score, guessed, avatar,
    })),
  };
}

const broadcastState = (io, room) => io.to(room.roomId).emit("state", publicState(room));
const say = (io, room, text, kind = "system") =>
  io.to(room.roomId).emit("chat_message", { kind, text });

function hintString(room) {
  return room.word
    .split("")
    .map((c, i) => (room.revealed.has(i) ? c : "_"))
    .join("");
}

function levenshtein(a, b) {
  const dp = Array.from({ length: a.length + 1 }, (_, i) => [i]);
  for (let j = 1; j <= b.length; j++) dp[0][j] = j;
  for (let i = 1; i <= a.length; i++)
    for (let j = 1; j <= b.length; j++)
      dp[i][j] = Math.min(dp[i - 1][j] + 1, dp[i][j - 1] + 1, dp[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
  return dp[a.length][b.length];
}

/* ---------------------------- join / leave / host ------------------------- */

function joinRoom(io, socket, payload) {
  const roomId = sanitize(payload?.roomId, 24).toLowerCase();
  const username = sanitize(payload?.username, 15);
  if (!roomId || !username) return socket.emit("join_error", "Enter a name and a room code.");

  if (socketRoom[socket.id]) leaveRoom(io, socket.id);

  const room = (rooms[roomId] ||= createRoom(roomId));
  if (room.players.length >= MAX_PLAYERS) {
    return socket.emit("join_error", `Room "${roomId}" is full (${MAX_PLAYERS} players).`);
  }

  socket.join(roomId);
  socketRoom[socket.id] = roomId;
  room.players.push({
    id: socket.id, username, score: 0, guessed: false, gained: 0,
    avatar: room.avatarCounter++ % 12,
  });
  if (!room.hostId) room.hostId = socket.id;
  // Joined mid-game: draw at the end of the current round.
  if (room.status !== "waiting" && room.status !== "game_over") room.queue.push(socket.id);

  broadcastState(io, room);
  say(io, room, `${username} joined the room`);
  syncJoiner(socket, room);
}

function syncJoiner(socket, room) {
  if (room.ops.length) socket.emit("canvas_history", room.ops);
  if (room.status === "playing") {
    socket.emit("turn_started", {
      hint: hintString(room), isDrawer: false,
      timeLeft: Math.max(0, room.turnEndsAt - Date.now()), duration: turnMs(room),
    });
  } else if (room.status === "round_over" && room.lastRoundOver) {
    socket.emit("round_over", room.lastRoundOver);
  }
}

function leaveRoom(io, socketId) {
  const roomId = socketRoom[socketId];
  delete socketRoom[socketId];
  io.sockets.sockets.get(socketId)?.leave(roomId);
  const room = rooms[roomId];
  if (!room) return;

  const leaving = room.players.find((p) => p.id === socketId);
  const wasDrawer = room.drawerId === socketId;
  room.players = room.players.filter((p) => p.id !== socketId);

  if (room.players.length === 0) {
    clearTimers(room);
    delete rooms[roomId];
    return;
  }
  if (room.hostId === socketId) room.hostId = room.players[0].id;
  if (leaving) say(io, room, `${leaving.username} left the room`);

  if (room.players.length < MIN_PLAYERS && room.status !== "waiting") {
    resetToWaiting(io, room);
    return;
  }
  broadcastState(io, room);

  if (room.status === "choosing" || room.status === "playing") {
    if (wasDrawer) endTurn(io, room, "drawer_left");
    else if (room.status === "playing") checkAllGuessed(io, room);
  }
}

function resetToWaiting(io, room) {
  clearTimers(room);
  room.status = "waiting";
  room.word = "";
  room.drawerId = null;
  room.round = 0;
  room.queue = [];
  room.ops = [];
  room.lastRoundOver = null;
  io.to(room.roomId).emit("clear_canvas");
  broadcastState(io, room);
  say(io, room, "Not enough players. Waiting for someone to join.");
}

/* ---------------------------------- lobby --------------------------------- */

function updateSettings(io, socket, payload) {
  const room = roomOf(socket.id);
  if (!room || room.hostId !== socket.id) return;
  if (room.status !== "waiting" && room.status !== "game_over") return;
  const rounds = Number(payload?.rounds);
  const drawTime = Number(payload?.drawTime);
  if (ROUND_OPTIONS.includes(rounds)) room.settings.rounds = rounds;
  if (TIME_OPTIONS.includes(drawTime)) room.settings.drawTime = drawTime;
  broadcastState(io, room);
}

function startGame(io, socket) {
  const room = roomOf(socket.id);
  if (!room || room.hostId !== socket.id) return;
  if (room.status !== "waiting" && room.status !== "game_over") return;
  if (room.players.length < MIN_PLAYERS) return socket.emit("join_error", "You need at least 2 players to start.");

  room.players.forEach((p) => { p.score = 0; p.guessed = false; p.gained = 0; });
  room.round = 1;
  room.queue = room.players.map((p) => p.id);
  startTurn(io, room);
}

/* ---------------------------------- turns --------------------------------- */

function nextDrawer(room) {
  for (;;) {
    while (room.queue.length) {
      const id = room.queue.shift();
      const p = room.players.find((x) => x.id === id);
      if (p) return p;
    }
    room.round++;
    if (room.round > room.settings.rounds) return null;
    room.queue = room.players.map((p) => p.id);
  }
}

function startTurn(io, room) {
  clearTimers(room);
  if (room.players.length < MIN_PLAYERS) return resetToWaiting(io, room);

  const drawer = nextDrawer(room);
  if (!drawer) return endGame(io, room);

  room.players.forEach((p) => { p.guessed = false; p.gained = 0; });
  room.word = "";
  room.revealed = new Set();
  room.ops = [];
  room.lastRoundOver = null;
  room.status = "choosing";
  room.drawerId = drawer.id;
  room.choices = getRandomWords(3);

  io.to(room.roomId).emit("clear_canvas");
  broadcastState(io, room);
  io.to(drawer.id).emit("choose_word", { choices: room.choices, timeLeft: CHOOSE_MS });

  room.timers.choose = setTimeout(() => {
    if (room.status === "choosing") beginPlaying(io, room, room.choices[0]);
  }, CHOOSE_MS);
}

function selectWord(io, socket, payload) {
  const room = roomOf(socket.id);
  if (!room || room.status !== "choosing" || socket.id !== room.drawerId) return;
  const word = String(payload?.word ?? "").toLowerCase();
  if (!room.choices.includes(word)) return;
  beginPlaying(io, room, word);
}

function beginPlaying(io, room, word) {
  if (room.timers.choose) clearTimeout(room.timers.choose);
  room.timers.choose = null;

  room.word = word.toLowerCase();
  room.revealed = new Set();
  room.status = "playing";
  const duration = turnMs(room);
  room.turnEndsAt = Date.now() + duration;

  broadcastState(io, room);
  io.to(room.drawerId).emit("turn_started", { hint: room.word, isDrawer: true, timeLeft: duration, duration });
  io.to(room.roomId).except(room.drawerId).emit("turn_started", {
    hint: hintString(room), isDrawer: false, timeLeft: duration, duration,
  });

  room.timers.turn = setTimeout(() => endTurn(io, room, "time_up"), duration);
  if (room.word.length >= 4) {
    for (const f of [0.4, 0.7]) room.timers.hints.push(setTimeout(() => revealLetter(io, room), duration * f));
  }
}

function revealLetter(io, room) {
  if (room.status !== "playing") return;
  const hidden = [...room.word].map((_, i) => i).filter((i) => !room.revealed.has(i));
  if (hidden.length <= 1) return;
  room.revealed.add(hidden[Math.floor(Math.random() * hidden.length)]);
  io.to(room.roomId).except(room.drawerId).emit("hint_update", { hint: hintString(room) });
}

function endTurn(io, room, reason) {
  if (rooms[room.roomId] !== room) return; // room was deleted
  if (room.status !== "playing" && room.status !== "choosing") return; // already ended
  clearTimers(room);

  const payload = {
    word: room.word,
    reason,
    results: room.players
      .map((p) => ({ id: p.id, username: p.username, avatar: p.avatar, gained: p.gained || 0 }))
      .sort((a, b) => b.gained - a.gained),
  };
  room.lastRoundOver = payload;
  room.status = "round_over";
  broadcastState(io, room);
  io.to(room.roomId).emit("round_over", payload);

  room.timers.next = setTimeout(() => {
    if (rooms[room.roomId] === room) startTurn(io, room);
  }, BREAK_MS);
}

function endGame(io, room) {
  clearTimers(room);
  room.status = "game_over";
  room.drawerId = null;
  room.word = "";
  broadcastState(io, room);
  io.to(room.roomId).emit("game_over");
}

function checkAllGuessed(io, room) {
  const guessers = room.players.filter((p) => p.id !== room.drawerId);
  if (guessers.length > 0 && guessers.every((p) => p.guessed)) endTurn(io, room, "all_guessed");
}

/* ------------------------------ guesses & chat ---------------------------- */

function handleGuess(io, socket, payload) {
  const room = roomOf(socket.id);
  if (!room) return;
  const player = room.players.find((p) => p.id === socket.id);
  const text = sanitize(payload?.text, 100);
  if (!player || !text) return;

  // Outside a playing turn, or for the drawer, it's plain chat (never a guess).
  const canGuess = room.status === "playing" && player.id !== room.drawerId && !player.guessed;

  if (!canGuess) {
    if (room.status === "playing" && player.id === room.drawerId) return; // drawer can't chat (could leak the word)
    if (room.status === "playing" && player.guessed) {
      // Players who already guessed talk privately, so they can't leak the word.
      room.players
        .filter((p) => p.guessed || p.id === room.drawerId)
        .forEach((p) => io.to(p.id).emit("chat_message", { kind: "private", username: player.username, text }));
      return;
    }
    return io.to(room.roomId).emit("chat_message", { kind: "chat", username: player.username, text });
  }

  const guess = text.toLowerCase();
  if (guess === room.word) {
    const timeLeft = Math.max(0, room.turnEndsAt - Date.now());
    const gained = 50 + Math.round((timeLeft / turnMs(room)) * 100);
    player.guessed = true;
    player.score += gained;
    player.gained += gained;
    const drawer = room.players.find((p) => p.id === room.drawerId);
    if (drawer) { drawer.score += 25; drawer.gained += 25; }

    say(io, room, `${player.username} guessed the word!`, "correct");
    broadcastState(io, room);
    checkAllGuessed(io, room);
  } else {
    io.to(room.roomId).emit("chat_message", { kind: "chat", username: player.username, text });
    if (room.word.length >= 4 && levenshtein(guess, room.word) === 1) {
      socket.emit("chat_message", { kind: "close", text: `"${text}" is really close!` });
    }
  }
}

/* --------------------------------- drawing -------------------------------- */

const n01 = (v) => typeof v === "number" && v >= -0.05 && v <= 1.05;
const isDrawing = (room, socket) => room && room.status === "playing" && room.drawerId === socket.id;
const pushOp = (room, op) => { if (room.ops.length < MAX_OPS) room.ops.push(op); };
const cleanColor = (c) => (/^#[0-9a-f]{3,8}$/i.test(c) ? c : "#000000");

function handleStroke(socket, s) {
  const room = roomOf(socket.id);
  if (!isDrawing(room, socket) || !s) return;
  if (![s.x0, s.y0, s.x1, s.y1].every(n01)) return;
  const op = {
    t: "seg", sid: String(s.sid ?? "").slice(0, 24),
    x0: s.x0, y0: s.y0, x1: s.x1, y1: s.y1,
    color: cleanColor(s.color), size: Math.min(48, Math.max(1, Number(s.size) || 4)),
  };
  pushOp(room, op);
  socket.to(room.roomId).emit("draw_stroke", op);
}

function handleFill(socket, f) {
  const room = roomOf(socket.id);
  if (!isDrawing(room, socket) || !f || !n01(f.x) || !n01(f.y)) return;
  const op = { t: "fill", x: f.x, y: f.y, color: cleanColor(f.color) };
  pushOp(room, op);
  socket.to(room.roomId).emit("fill", op);
}

function handleUndo(io, socket) {
  const room = roomOf(socket.id);
  if (!isDrawing(room, socket) || !room.ops.length) return;
  const last = room.ops[room.ops.length - 1];
  if (last.t === "fill") room.ops.pop();
  else while (room.ops.length && room.ops[room.ops.length - 1].t === "seg" && room.ops[room.ops.length - 1].sid === last.sid) room.ops.pop();
  io.to(room.roomId).emit("canvas_history", room.ops); // everyone replays from scratch
}

function handleClear(socket) {
  const room = roomOf(socket.id);
  if (!isDrawing(room, socket)) return;
  room.ops = [];
  socket.to(room.roomId).emit("clear_canvas");
}

module.exports = {
  rooms, joinRoom, leaveRoom, updateSettings, startGame, selectWord,
  handleGuess, handleStroke, handleFill, handleUndo, handleClear,
};
