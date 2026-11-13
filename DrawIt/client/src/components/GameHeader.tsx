"use client";

import { useState } from "react";
import { Check, Link2, LogOut, Volume2, VolumeX } from "lucide-react";
import Timer from "@/components/Timer";
import type { GameState, TurnInfo } from "@/lib/useGame";

interface GameHeaderProps {
  state: GameState;
  turn: TurnInfo | null;
  isDrawer: boolean;
  drawerName: string;
  muted: boolean;
  onToggleMute: () => void;
  onLeave: () => void;
}

export default function GameHeader({ state, turn, isDrawer, drawerName, muted, onToggleMute, onLeave }: GameHeaderProps) {
  const [copied, setCopied] = useState(false);

  const copyInvite = async () => {
    const url = `${window.location.origin}/?room=${encodeURIComponent(state.roomId)}`;
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      window.prompt("Copy this invite link:", url);
    }
  };

  const status =
    state.status === "waiting" ? "Waiting room"
    : state.status === "game_over" ? "Game over"
    : state.status === "choosing" ? (isDrawer ? "Pick a word" : `${drawerName} is picking`)
    : state.status === "round_over" ? "Turn over"
    : isDrawer ? "Draw this word" : "Guess the word";

  const hint = turn?.hint ?? "";
  const letters = hint.split("");

  return (
    <header className="sticker flex flex-wrap items-center gap-x-4 gap-y-3 px-4 py-3">
      <div className="flex items-center gap-3">
        {state.round > 0 && state.status !== "game_over" ? (
          <div className="rounded-xl border-2 border-ink bg-sun px-3 py-1.5 text-center leading-none">
            <div className="font-display text-lg font-extrabold">{state.round}/{state.rounds}</div>
            <div className="mt-0.5 text-[11px] font-bold">round</div>
          </div>
        ) : (
          <div className="font-display text-xl font-extrabold">DrawIt</div>
        )}
        <button onClick={copyInvite} className="btn px-3 py-1.5 text-sm" title="Copy invite link">
          {copied ? <Check className="h-4 w-4 text-mint" /> : <Link2 className="h-4 w-4" />}
          <span className="max-w-[10rem] truncate">{copied ? "Link copied" : state.roomId}</span>
        </button>
      </div>

      {/* The hint row: tiles that fill in as letters are revealed */}
      <div className="order-last flex w-full flex-col items-center gap-1.5 sm:order-none sm:w-auto sm:flex-1">
        <span className="text-sm font-bold text-ink-soft">{status}</span>
        {letters.length > 0 && state.status === "playing" ? (
          <div className="flex flex-wrap items-center justify-center gap-1" aria-label={isDrawer ? `Your word is ${hint}` : `Hint: ${letters.length} letters`}>
            {letters.map((ch, i) => (
              <span
                key={`${i}-${ch}`}
                className={`flex h-10 w-8 items-center justify-center rounded-md border-2 border-ink font-display text-xl font-extrabold uppercase sm:h-11 sm:w-9 ${
                  ch === "_" ? "bg-white" : isDrawer ? "bg-sun" : "animate-tile bg-sun"
                }`}
              >
                {ch === "_" ? "" : ch}
              </span>
            ))}
            {!isDrawer && <span className="ml-1 text-xs font-bold text-ink-soft">{letters.length}</span>}
          </div>
        ) : (
          <div className="hidden h-11 sm:block" />
        )}
      </div>

      <div className="ml-auto flex items-center gap-2">
        {turn && state.status === "playing" && <Timer endsAt={turn.endsAt} duration={turn.duration} muted={muted} />}
        <button onClick={onToggleMute} className="btn px-2.5" aria-label={muted ? "Turn sound on" : "Mute sound"} title={muted ? "Sound off" : "Sound on"}>
          {muted ? <VolumeX className="h-5 w-5" /> : <Volume2 className="h-5 w-5" />}
        </button>
        <button onClick={onLeave} className="btn px-2.5" aria-label="Leave room" title="Leave room">
          <LogOut className="h-5 w-5" />
        </button>
      </div>
    </header>
  );
}
