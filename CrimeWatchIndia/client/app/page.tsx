"use client";

import { useCallback, useState } from "react";
import dynamic from "next/dynamic";
import TopBar from "./components/TopBar";
import IntroEye from "./components/IntroEye";
import CursorTrail from "./components/CursorTrail";
import FeedPanel from "./components/FeedPanel";
import TacticalRadar from "./components/TacticalRadar";
import Dossier from "./components/Dossier";
import { useCrimes } from "./lib/useCrimes";
import type { Crime } from "./lib/crime";

// WebGL needs the browser, so the globe is client-only.
const TacticalMap = dynamic(() => import("./components/TacticalMap"), {
  ssr: false,
  loading: () => (
    <div className="stage-bg absolute inset-0 grid place-items-center font-mono text-[11px] tracking-[0.3em] text-white/30">
      <span className="animate-pulse">CALIBRATING GRID</span>
    </div>
  ),
});

export default function TheEyeDashboard() {
  const [category, setCategory] = useState("ALL");
  const [severity, setSeverity] = useState("ALL");
  const [query, setQuery] = useState("");
  const [active, setActive] = useState<Crime | null>(null);
  const [panelOpen, setPanelOpen] = useState(false);
  const [phase, setPhase] = useState<"intro" | "exiting" | "app">("intro");
  const revealed = phase !== "intro";

  const { filtered, severityCounts, crimes, loading, scanning, offline, scan } =
    useCrimes({
      category,
      severity,
      query,
    });

  const select = useCallback((c: Crime | null) => setActive(c), []);
  const close = useCallback(() => setActive(null), []);
  const pick = useCallback((c: Crime) => {
    setActive(c);
    setPanelOpen(false); // reveal the globe on mobile
  }, []);

  return (
    <main className="relative h-dvh w-screen overflow-hidden bg-ink">
      <CursorTrail />
      {phase !== "app" && (
        <IntroEye
          exiting={phase === "exiting"}
          onEnter={() => setPhase("exiting")}
          onDone={() => setPhase("app")}
        />
      )}

      {/* the dashboard loads behind the intro, then blurs into focus */}
      <div
        className="absolute inset-0 transition-[opacity,transform,filter] duration-[1800ms] ease-out-expo"
        style={{
          opacity: revealed ? 1 : 0,
          transform: revealed ? "none" : "scale(1.06)",
          filter: revealed ? "none" : "blur(12px)",
        }}
      >
        <TacticalMap
          crimes={filtered}
          selected={active}
          onSelect={select}
          ready={revealed}
        />

        <TopBar
          mapped={filtered.length}
          scanning={scanning}
          offline={offline}
          onScan={scan}
          onTogglePanel={() => setPanelOpen((o) => !o)}
        />

        <FeedPanel
          crimes={filtered}
          total={crimes.length}
          loading={loading}
          activeId={active?.id}
          open={panelOpen}
          query={query}
          severity={severity}
          category={category}
          severityCounts={severityCounts}
          onQuery={setQuery}
          onSeverity={setSeverity}
          onCategory={setCategory}
          onSelect={pick}
        />

        <TacticalRadar crimes={filtered} scanning={scanning} />

        {active && <Dossier crime={active} onClose={close} />}
      </div>
    </main>
  );
}