"use client";

import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from "react";
import { socket } from "@/lib/socket";
import { playSound } from "@/lib/sound";

export interface Player {
  id: string;
  username: string;
  score: number;
  guessed: boolean;
  avatar: number;
}

export type Status = "waiting" | "choosing" | "playing" | "round_over" | "game_over";

export interface GameState {
  roomId: string;
  status: Status;
  round: number;
  rounds: number;
  drawTime: number;
  hostId: string | null;
  drawerId: string | null;
  players: Player[];
}

export interface ChatMsg {
  id: number;
  kind: "chat" | "system" | "correct" | "close" | "private";
  username?: string;
  text: string;
}

export interface TurnInfo {
  hint: string;
  isDrawer: boolean;
  endsAt: number; // client clock
  duration: number; // ms
}

export interface RoundOver {
  word: string;
  reason: string;
  results: { id: string; username: string; avatar: number; gained: number }[];
}

let msgId = 0;

export function useGame() {
  const [state, setState] = useState<GameState | null>(null);
  // socket.id as an external store: right on first render, even if already connected.
  const myId = useSyncExternalStore(
    (cb) => {
      socket.on("connect", cb);
      socket.on("disconnect", cb);
      return () => { socket.off("connect", cb); socket.off("disconnect", cb); };
    },
    () => socket.id ?? "",
    () => "",
  );
  const [error, setError] = useState("");
  const [joining, setJoining] = useState(false);
  const [choices, setChoices] = useState<{ words: string[]; endsAt: number } | null>(null);
  const [turn, setTurn] = useState<TurnInfo | null>(null);
  const [roundOver, setRoundOver] = useState<RoundOver | null>(null);
  const [messages, setMessages] = useState<ChatMsg[]>([]);
  const [muted, setMuted] = useState(false);

  const joinInfo = useRef<{ roomId: string; username: string } | null>(null);
  const mutedRef = useRef(false);
  useEffect(() => { mutedRef.current = muted; }, [muted]);

  useEffect(() => {
    const addMsg = (m: Omit<ChatMsg, "id">) =>
      setMessages((prev) => [...prev.slice(-150), { ...m, id: ++msgId }]);

    const onConnect = () => {
      // New socket id after a network blip: re-join so we aren't a ghost.
      if (joinInfo.current) socket.emit("join_room", joinInfo.current);
    };

    const onState = (s: GameState) => {
      setJoining(false);
      setError("");
      setState(s);
      if (s.status !== "choosing") setChoices(null);
      if (s.status !== "playing") setTurn(null);
      if (s.status === "choosing" || s.status === "playing") setRoundOver(null);
    };

    const onChoose = ({ choices: words, timeLeft }: { choices: string[]; timeLeft: number }) => {
      setChoices({ words, endsAt: Date.now() + timeLeft });
      playSound("turn", mutedRef.current);
    };

    const onTurn = (t: { hint: string; isDrawer: boolean; timeLeft: number; duration: number }) => {
      setChoices(null);
      setTurn({ hint: t.hint, isDrawer: t.isDrawer, endsAt: Date.now() + t.timeLeft, duration: t.duration });
      if (!t.isDrawer) playSound("turn", mutedRef.current);
    };

    const onHint = ({ hint }: { hint: string }) =>
      setTurn((t) => (t ? { ...t, hint } : t));

    const onRoundOver = (r: RoundOver) => {
      setRoundOver(r);
      playSound("end", mutedRef.current);
    };

    const onChat = (m: Omit<ChatMsg, "id">) => {
      addMsg(m);
      if (m.kind === "correct") playSound("correct", mutedRef.current);
    };

    const onJoinError = (msg: string) => {
      setJoining(false);
      setError(msg);
    };

    socket.on("connect", onConnect);
    socket.on("state", onState);
    socket.on("choose_word", onChoose);
    socket.on("turn_started", onTurn);
    socket.on("hint_update", onHint);
    socket.on("round_over", onRoundOver);
    socket.on("chat_message", onChat);
    socket.on("join_error", onJoinError);

    return () => {
      socket.off("connect", onConnect);
      socket.off("state", onState);
      socket.off("choose_word", onChoose);
      socket.off("turn_started", onTurn);
      socket.off("hint_update", onHint);
      socket.off("round_over", onRoundOver);
      socket.off("chat_message", onChat);
      socket.off("join_error", onJoinError);
    };
  }, []);

  const join = useCallback((roomId: string, username: string) => {
    joinInfo.current = { roomId, username };
    setError("");
    setJoining(true);
    setMessages([]);
    socket.emit("join_room", joinInfo.current);
  }, []);

  const leave = useCallback(() => {
    joinInfo.current = null;
    socket.emit("leave_room");
    setState(null);
    setTurn(null);
    setChoices(null);
    setRoundOver(null);
    setMessages([]);
  }, []);

  const pickWord = useCallback((word: string) => {
    socket.emit("select_word", { word });
    setChoices(null);
  }, []);

  const sendGuess = useCallback((text: string) => socket.emit("send_guess", { text }), []);
  const startGame = useCallback(() => socket.emit("start_game"), []);
  const updateSettings = useCallback(
    (s: { rounds?: number; drawTime?: number }) => socket.emit("update_settings", s),
    [],
  );

  const isDrawer = !!state && state.drawerId === myId && (state.status === "choosing" || state.status === "playing");
  const isHost = !!state && state.hostId === myId;
  const me = state?.players.find((p) => p.id === myId);

  return {
    state, myId, me, error, joining, choices, turn, roundOver, messages, muted, isDrawer, isHost,
    setMuted, join, leave, pickWord, sendGuess, startGame, updateSettings,
  };
}
