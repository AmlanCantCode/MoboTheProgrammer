"use client";

import { useEffect, useState } from "react";
import { Check, Crown, Link2, Pencil, Play, Trophy } from "lucide-react";
import Avatar from "@/components/Avatar";
import type { GameState, RoundOver } from "@/lib/useGame";

const ROUND_OPTIONS = [2, 3, 4, 5, 6];
const TIME_OPTIONS = [30, 45, 60, 80, 100, 120];

interface StageOverlayProps {
  state: GameState;
  isDrawer: boolean;
  isHost: boolean;
  drawerName: string;
  hostName: string;
  choices: { words: string[]; endsAt: number } | null;
  roundOver: RoundOver | null;
  onPick: (w: string) => void;
  onStart: () => void;
  onSettings: (s: { rounds?: number; drawTime?: number }) => void;
}

function Segmented({
  label, options, value, onChange, disabled, suffix = "",
}: { label: string; options: number[]; value: number; onChange: (n: number) => void; disabled: boolean; suffix?: string }) {
  return (
    <div>
      <div className="mb-1.5 text-sm font-bold">{label}</div>
      <div className="flex flex-wrap gap-1.5" role="group" aria-label={label}>
        {options.map((o) => (
          <button
            key={o}
            disabled={disabled}
            aria-pressed={value === o}
            onClick={() => onChange(o)}
            className={`rounded-lg border-2 border-ink px-3 py-1.5 text-sm font-bold ${
              value === o ? "bg-sun shadow-pop-sm" : "bg-white hover:bg-ink/5"
            } disabled:cursor-default disabled:hover:bg-white ${disabled && value === o ? "disabled:opacity-100" : "disabled:opacity-60"}`}
          >
            {o}{suffix}
          </button>
        ))}
      </div>
    </div>
  );
}

function PickCountdown({ endsAt }: { endsAt: number }) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 200);
    return () => clearInterval(id);
  }, []);
  const left = Math.max(0, endsAt - now);
  return (
    <div className="mt-5">
      <div className="h-2.5 overflow-hidden rounded-full border-2 border-ink bg-white">
        <div className="h-full bg-tomato" style={{ width: `${Math.min(100, (left / 15000) * 100)}%`, transition: "width 0.2s linear" }} />
      </div>
      <p className="mt-1.5 text-xs font-semibold text-ink-soft">
        Not picked in {Math.ceil(left / 1000)}s? We&apos;ll choose the first one.
      </p>
    </div>
  );
}

const REASONS: Record<string, string> = {
  time_up: "Time's up!",
  all_guessed: "Everyone got it!",
  drawer_left: "The drawer left, so this turn is skipped.",
};

export default function StageOverlay(p: StageOverlayProps) {
  const { state, isDrawer, isHost } = p;
  const [copied, setCopied] = useState(false);

  const shell = (children: React.ReactNode, key: string) => (
    <div key={key} className="absolute inset-0 z-10 flex items-center justify-center bg-white/80 p-3 backdrop-blur-[3px] max-sm:static max-sm:bg-white sm:p-5">
      <div className="animate-pop sticker max-h-full w-full max-w-lg overflow-y-auto p-5 text-center sm:p-6">{children}</div>
    </div>
  );

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

  /* ---- waiting room ---- */
  if (state.status === "waiting") {
    const enough = state.players.length >= 2;
    return shell(
      <>
        <h2 className="font-display text-2xl font-extrabold">{enough ? "Ready when you are" : "Waiting for a friend"}</h2>
        <p className="mt-1 text-sm text-ink-soft">
          {enough
            ? isHost ? "Set up the game, then start it." : `${p.hostName} is setting up the game.`
            : "Send the invite link. You need at least 2 players."}
        </p>

        <button onClick={copyInvite} className="btn mx-auto mt-4">
          {copied ? <Check className="h-4 w-4 text-mint" /> : <Link2 className="h-4 w-4" />}
          {copied ? "Link copied" : "Copy invite link"}
        </button>

        <div className="mt-5 space-y-4 text-left">
          <Segmented label="Rounds" options={ROUND_OPTIONS} value={state.rounds} disabled={!isHost} onChange={(rounds) => p.onSettings({ rounds })} />
          <Segmented label="Drawing time" options={TIME_OPTIONS} value={state.drawTime} disabled={!isHost} suffix="s" onChange={(drawTime) => p.onSettings({ drawTime })} />
        </div>

        {isHost ? (
          <button onClick={p.onStart} disabled={!enough} className="btn btn-primary mt-6 w-full py-3 text-lg">
            <Play className="h-5 w-5 fill-current" />
            Start game
          </button>
        ) : (
          <p className="mt-6 rounded-xl border-2 border-dashed border-ink/40 p-3 text-sm font-semibold text-ink-soft">
            Waiting for the host to start.
          </p>
        )}
      </>,
      "waiting",
    );
  }

  /* ---- choosing a word ---- */
  if (state.status === "choosing") {
    if (isDrawer && p.choices) {
      return shell(
        <>
          <h2 className="font-display text-2xl font-extrabold">Pick a word to draw</h2>
          <div className="mt-4 grid gap-2.5">
            {p.choices.words.map((w) => (
              <button key={w} onClick={() => p.onPick(w)} className="btn w-full py-3.5 text-xl capitalize hover:!bg-sun">
                {w}
              </button>
            ))}
          </div>
          <PickCountdown endsAt={p.choices.endsAt} />
        </>,
        "choose",
      );
    }
    return shell(
      <>
        <Pencil className="animate-wobble mx-auto h-10 w-10" />
        <h2 className="mt-3 font-display text-2xl font-extrabold">{p.drawerName} is picking a word</h2>
        <p className="mt-1 text-sm text-ink-soft">Get your guessing fingers ready.</p>
      </>,
      "choosing",
    );
  }

  /* ---- between turns ---- */
  if (state.status === "round_over") {
    const r = p.roundOver;
    return shell(
      <>
        <p className="text-sm font-bold text-ink-soft">{r ? REASONS[r.reason] ?? "Turn over" : "Turn over"}</p>
        {r?.word ? (
          <h2 className="mt-1 font-display text-3xl font-extrabold">
            The word was <span className="rounded-lg bg-sun px-2 capitalize">{r.word}</span>
          </h2>
        ) : (
          <h2 className="mt-1 font-display text-2xl font-extrabold">Next turn is coming</h2>
        )}
        {r && r.results.length > 0 && (
          <ul className="mt-4 space-y-1.5 text-left">
            {r.results.map((x) => (
              <li key={x.id} className="flex items-center gap-2.5 rounded-xl border-2 border-ink/15 px-2.5 py-1.5">
                <Avatar name={x.username} index={x.avatar} size={30} />
                <span className="flex-1 truncate text-sm font-bold">{x.username}</span>
                <span className={`font-display text-base font-extrabold ${x.gained > 0 ? "text-mint" : "text-ink-soft"}`}>
                  {x.gained > 0 ? `+${x.gained}` : "0"}
                </span>
              </li>
            ))}
          </ul>
        )}
      </>,
      "round_over",
    );
  }

  /* ---- game over: podium ---- */
  if (state.status === "game_over") {
    const ranked = [...state.players].sort((a, b) => b.score - a.score);
    const podium = [ranked[1], ranked[0], ranked[2]].filter(Boolean);
    const heights: Record<number, string> = { 0: "h-24", 1: "h-16", 2: "h-12" };
    return shell(
      <>
        <Trophy className="mx-auto h-9 w-9" />
        <h2 className="mt-1 font-display text-3xl font-extrabold">{ranked[0]?.username} wins!</h2>

        <div className="mt-5 flex items-end justify-center gap-2">
          {podium.map((pl) => {
            const rank = ranked.indexOf(pl);
            return (
              <div key={pl.id} className="flex w-24 flex-col items-center">
                {rank === 0 && <Crown className="mb-1 h-6 w-6 fill-sun" />}
                <Avatar name={pl.username} index={pl.avatar} size={44} />
                <div className="mt-1 w-full truncate text-sm font-bold">{pl.username}</div>
                <div
                  className={`mt-1 flex w-full items-start justify-center rounded-t-lg border-2 border-ink pt-1.5 font-display text-lg font-extrabold ${heights[rank]} ${
                    rank === 0 ? "bg-sun" : rank === 1 ? "bg-sky/40" : "bg-tomato/40"
                  }`}
                >
                  {pl.score}
                </div>
              </div>
            );
          })}
        </div>

        {ranked.length > 3 && (
          <ul className="mt-3 space-y-1 text-left text-sm">
            {ranked.slice(3).map((pl, i) => (
              <li key={pl.id} className="flex items-center gap-2 px-2 font-semibold">
                <span className="w-5 text-ink-soft">{i + 4}</span>
                <span className="flex-1 truncate">{pl.username}</span>
                <span>{pl.score}</span>
              </li>
            ))}
          </ul>
        )}

        {isHost ? (
          <button onClick={p.onStart} className="btn btn-good mt-6 w-full py-3 text-lg">
            <Play className="h-5 w-5 fill-current" />
            Play again
          </button>
        ) : (
          <p className="mt-6 text-sm font-semibold text-ink-soft">Waiting for {p.hostName} to start another game.</p>
        )}
      </>,
      "game_over",
    );
  }

  return null;
}
