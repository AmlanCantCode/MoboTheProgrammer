"use client";

import { useState, useEffect, useRef } from "react";
import { socket } from "@/lib/socket";
import { Trophy, Send, CheckCircle2 } from "lucide-react";

interface Player {
  id: string;
  username: string;
  score: number;
  guessed: boolean;
}

interface Message {
  system: boolean;
  username?: string;
  text: string;
}

interface ChatSidebarProps {
  roomId: string;
  username: string;
  players: Player[];
  isDrawer: boolean;
}

export default function ChatSidebar({ roomId, username, players, isDrawer }: ChatSidebarProps) {
  const [guess, setGuess] = useState("");
  const [messages, setMessages] = useState<Message[]>([]);
  const chatEndRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const handleMessage = (msg: Message) => {
      setMessages((prev) => [...prev, msg]);
    };

    socket.on("chat_message", handleMessage);
    return () => {
      socket.off("chat_message", handleMessage);
    };
  }, []);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const handleSendGuess = (e: React.FormEvent) => {
    e.preventDefault();
    if (!guess.trim() || isDrawer) return;

    socket.emit("send_guess", {
      roomId,
      username,
      text: guess.trim(),
    });
    setGuess("");
  };

  const sortedPlayers = [...players].sort((a, b) => b.score - a.score);

  return (
    <div className="flex flex-col h-full bg-slate-900 rounded-2xl border border-slate-800 p-4 shadow-xl gap-4">
      {/* Live Scoreboard */}
      <div className="border-b border-slate-800 pb-3">
        <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-slate-400 mb-3">
          <Trophy className="h-4 w-4 text-amber-400" />
          <span>Leaderboard ({players.length})</span>
        </div>
        <div className="space-y-2 max-h-40 overflow-y-auto pr-1">
          {sortedPlayers.map((player, idx) => (
            <div
              key={player.id}
              className={`flex items-center justify-between rounded-xl px-3 py-2 text-sm ${
                player.guessed
                  ? "bg-emerald-500/10 border border-emerald-500/30 text-emerald-300"
                  : "bg-slate-950/60 text-slate-200"
              }`}
            >
              <div className="flex items-center gap-2 truncate">
                <span className="font-mono text-xs text-slate-500">#{idx + 1}</span>
                <span className="font-semibold truncate">{player.username}</span>
                {player.guessed && <CheckCircle2 className="h-4 w-4 text-emerald-400 shrink-0" />}
              </div>
              <span className="font-bold text-indigo-400">{player.score} pts</span>
            </div>
          ))}
        </div>
      </div>

      {/* Live Chat & Guesses */}
      <div className="flex-1 flex flex-col min-h-[240px]">
        <div className="flex-1 overflow-y-auto space-y-2 pr-1 mb-3">
          {messages.map((msg, i) => (
            <div
              key={i}
              className={`rounded-lg px-3 py-1.5 text-sm ${
                msg.system
                  ? "bg-emerald-500/15 text-emerald-300 font-semibold text-center border border-emerald-500/20"
                  : "bg-slate-950/70 text-slate-300"
              }`}
            >
              {!msg.system && (
                <span className="font-bold text-indigo-400 mr-1.5">{msg.username}:</span>
              )}
              <span>{msg.text}</span>
            </div>
          ))}
          <div ref={chatEndRef} />
        </div>

        <form onSubmit={handleSendGuess} className="flex gap-2">
          <input
            type="text"
            value={guess}
            onChange={(e) => setGuess(e.target.value)}
            disabled={isDrawer}
            placeholder={isDrawer ? "You are drawing..." : "Type your guess here..."}
            className="flex-1 rounded-xl border border-slate-800 bg-slate-950 px-3.5 py-2.5 text-sm text-white placeholder-slate-600 focus:border-indigo-500 focus:outline-none disabled:opacity-50"
          />
          <button
            type="submit"
            disabled={isDrawer || !guess.trim()}
            className="rounded-xl bg-indigo-600 px-3.5 py-2.5 text-white hover:bg-indigo-500 disabled:opacity-40 transition"
          >
            <Send className="h-4 w-4" />
          </button>
        </form>
      </div>
    </div>
  );
}