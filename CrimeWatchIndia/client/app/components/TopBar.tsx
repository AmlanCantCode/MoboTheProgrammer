"use client";

import { useEffect, useState } from "react";
import { RefreshCw, PanelLeft } from "lucide-react";
import EyeMark from "./EyeMark";

interface Props {
  mapped: number;
  scanning: boolean;
  offline: boolean;
  onScan: () => void;
  onTogglePanel: () => void;
}

function UtcClock() {
  const [now, setNow] = useState<string>("");
  useEffect(() => {
    const tick = () => setNow(new Date().toISOString().slice(11, 19));
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, []);
  return <span className="tabular-nums">{now || "--:--:--"} UTC</span>;
}

export default function TopBar({ mapped, scanning, offline, onScan, onTogglePanel }: Props) {
  return (
    <header className="pointer-events-none absolute inset-x-0 top-0 z-30 flex items-start justify-between gap-3 p-3 md:p-4">
      <div className="pointer-events-auto glass flex items-center gap-3 rounded-2xl py-2 pl-3 pr-4">
        <button
          onClick={onTogglePanel}
          aria-label="Toggle intelligence feed"
          className="rounded-lg p-1.5 text-white/60 transition hover:bg-white/5 hover:text-white md:hidden"
        >
          <PanelLeft className="h-4 w-4" />
        </button>
        <EyeMark />
        <div className="leading-none">
          <h1 className="text-[13px] font-semibold tracking-[0.28em] text-white">THE EYE</h1>
          <p className="mt-1 font-mono text-[9px] uppercase tracking-[0.2em] text-maroon-200/60">
            India · Tactical Grid
          </p>
        </div>
      </div>

      <div className="pointer-events-auto glass flex items-center gap-4 rounded-2xl py-2 pl-4 pr-2 font-mono text-[11px] text-white/60">
        <span className="hidden items-center gap-2 sm:flex">
          <span
            className={`live-dot relative h-1.5 w-1.5 rounded-full ${
              offline ? "bg-amber-400" : "bg-maroon-400"
            }`}
          />
          {offline ? "OFFLINE" : "LIVE"}
        </span>
        <span className="hidden text-white/80 md:inline">
          <b className="font-semibold text-white">{mapped}</b> mapped
        </span>
        <span className="hidden lg:inline">
          <UtcClock />
        </span>
        <button
          onClick={onScan}
          disabled={scanning}
          className="flex cursor-pointer items-center gap-2 rounded-xl bg-maroon-700 px-3.5 py-2 text-[11px] font-semibold tracking-wide text-white shadow-[0_0_24px_-4px_rgba(190,18,60,0.7)] transition hover:bg-maroon-500 disabled:opacity-60"
        >
          <RefreshCw className={`h-3.5 w-3.5 ${scanning ? "animate-spin" : ""}`} />
          {scanning ? "Scanning" : "Pull intel"}
        </button>
      </div>
    </header>
  );
}
