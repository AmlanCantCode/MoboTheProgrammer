"use client";

import type { Crime } from "../lib/crime";

interface Props {
  crimes: Crime[];
  scanning: boolean;
}

export default function TacticalRadar({ crimes, scanning }: Props) {
  // Project up to 12 recent incidents onto the radar disc relative to India's center (22.5°N, 79°E)
  const blips = crimes.slice(0, 12).map((c) => {
    const dx = Math.max(-1, Math.min(1, (c.lng - 79) / 16));
    const dy = Math.max(-1, Math.min(1, -(c.lat - 22.5) / 16));
    return {
      id: c.id,
      x: 50 + dx * 38,
      y: 50 + dy * 38,
      high: c.severity === "HIGH",
    };
  });

  return (
    <aside
      aria-hidden
      className="pointer-events-none fixed right-5 top-1/2 z-20 hidden -translate-y-1/2 flex-col items-center gap-3 xl:flex"
    >
      <div className="glass relative flex h-48 w-48 items-center justify-center rounded-full p-3 shadow-[0_0_50px_-12px_rgba(190,18,60,0.35)]">
        {/* Concentric range rings */}
        <div className="relative h-full w-full overflow-hidden rounded-full border border-maroon-500/25 bg-[#040508]/80">
          <div className="absolute inset-4 rounded-full border border-white/[0.06]" />
          <div className="absolute inset-9 rounded-full border border-white/[0.06]" />
          <div className="absolute inset-14 rounded-full border border-maroon-500/20" />

          {/* Crosshairs */}
          <div className="absolute inset-x-0 top-1/2 h-px bg-white/[0.07]" />
          <div className="absolute inset-y-0 left-1/2 w-px bg-white/[0.07]" />

          {/* Rotating radar sweep beam */}
          <div
            className="absolute inset-0 rounded-full"
            style={{
              background:
                "conic-gradient(from 0deg, rgba(190,18,60,0.42) 0deg, rgba(190,18,60,0.08) 55deg, transparent 95deg)",
              animation: `spin ${scanning ? "1.6s" : "5s"} linear infinite`,
            }}
          />

          {/* Live incident blips */}
          {blips.map((b) => (
            <span
              key={b.id}
              style={{ left: `${b.x}%`, top: `${b.y}%` }}
              className={`absolute h-1.5 w-1.5 -translate-x-1/2 -translate-y-1/2 rounded-full ${
                b.high
                  ? "animate-ping bg-rose-500 shadow-[0_0_8px_#f43f5e]"
                  : "bg-white/70"
              }`}
            />
          ))}

          {/* Center reticle */}
          <div className="absolute left-1/2 top-1/2 h-1.5 w-1.5 -translate-x-1/2 -translate-y-1/2 rounded-full bg-maroon-400" />
        </div>
      </div>

      {/* Telemetry readout pill */}
      <div className="glass flex items-center gap-2.5 rounded-full px-3.5 py-1.5 font-mono text-[9.5px] uppercase tracking-[0.2em] text-white/50">
        <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-maroon-500" />
        <span>{scanning ? "SWEEP ACTIVE" : "SAT-GRID 22.5°N"}</span>
      </div>
    </aside>
  );
}