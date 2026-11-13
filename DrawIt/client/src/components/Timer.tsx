"use client";

import { useEffect, useState } from "react";
import { playSound } from "@/lib/sound";

interface TimerProps {
  endsAt: number;
  duration: number;
  muted: boolean;
}

export default function Timer({ endsAt, duration, muted }: TimerProps) {
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 250);
    return () => clearInterval(id);
  }, [endsAt]);

  const left = Math.max(0, endsAt - now);
  const secs = Math.ceil(left / 1000);
  const low = secs <= 10 && secs > 0;

  useEffect(() => {
    if (low) playSound("tick", muted);
  }, [secs, low, muted]);

  const R = 22;
  const C = 2 * Math.PI * R;
  const frac = duration > 0 ? left / duration : 0;

  return (
    <div
      className={`relative flex h-14 w-14 items-center justify-center rounded-full border-2 border-ink bg-white shadow-pop-sm ${low ? "animate-tick" : ""}`}
      role="timer"
      aria-label={`${secs} seconds left`}
    >
      <svg viewBox="0 0 52 52" className="absolute inset-0 -rotate-90">
        <circle cx="26" cy="26" r={R} fill="none" stroke="var(--ink)" strokeOpacity="0.1" strokeWidth="4" />
        <circle
          cx="26" cy="26" r={R} fill="none"
          stroke={low ? "var(--tomato)" : "var(--mint)"}
          strokeWidth="4" strokeLinecap="round"
          strokeDasharray={C} strokeDashoffset={C * (1 - frac)}
          style={{ transition: "stroke-dashoffset 0.25s linear" }}
        />
      </svg>
      <span className={`relative font-display text-lg font-extrabold ${low ? "text-tomato" : ""}`}>{secs}</span>
    </div>
  );
}
