"use client";

import { memo, useEffect, useRef, useState } from "react";
import { getConfig } from "../lib/quality";
import { Search } from "lucide-react";
import { CATEGORIES, SEVERITY, stripHtml, timeAgo, type Crime, type Severity } from "../lib/crime";

interface Props {
  crimes: Crime[];
  total: number;
  loading: boolean;
  activeId?: string;
  open: boolean;
  query: string;
  severity: string;
  category: string;
  severityCounts: Record<Severity, number>;
  onQuery: (v: string) => void;
  onSeverity: (v: string) => void;
  onCategory: (v: string) => void;
  onSelect: (c: Crime) => void;
}

const Row = memo(function Row({
  crime,
  active,
  index,
  onSelect,
}: {
  crime: Crime;
  active: boolean;
  index: number;
  onSelect: (c: Crime) => void;
}) {
  const sev = SEVERITY[crime.severity];
  return (
    <button
      id={`crime-${crime.id}`}
      onClick={() => onSelect(crime)}
      style={{ animationDelay: `${Math.min(index, 10) * 28}ms` }}
      className={`animate-feed [content-visibility:auto] [contain-intrinsic-size:auto_112px] group relative block w-full cursor-pointer px-4 py-3.5 text-left transition-colors ${
        active ? "bg-white/[0.06]" : "hover:bg-white/[0.03]"
      }`}
    >
      <span
        className={`absolute left-0 top-3 bottom-3 w-[2px] rounded-full transition-opacity ${
          active ? "opacity-100" : "opacity-0"
        }`}
        style={{ background: sev.color, boxShadow: `0 0 10px ${sev.color}` }}
      />
      <div className="mb-1 flex items-center gap-2 font-mono text-[10px] uppercase tracking-wider text-white/40">
        <span className="h-1.5 w-1.5 rounded-full" style={{ background: sev.color }} />
        <span style={{ color: crime.severity === "HIGH" ? sev.color : undefined }}>{sev.label}</span>
        <span>·</span>
        <span className="truncate">{crime.city}</span>
        <span className="ml-auto shrink-0 normal-case tracking-normal">{timeAgo(crime.publishedAt)}</span>
      </div>
      <h3 className="line-clamp-2 text-[13px] font-semibold leading-snug text-white/95">{crime.title}</h3>
      {crime.summary && (
        <p className="mt-1.5 line-clamp-3 text-[11.5px] leading-relaxed text-white/55">
          {stripHtml(crime.summary)}
        </p>
      )}
      <div className="mt-2 flex items-center justify-between font-mono text-[9.5px] text-white/30">
        <span className="truncate">{crime.source}</span>
        <span className="uppercase text-maroon-300/70">{crime.state}</span>
      </div>
    </button>
  );
});

export default function FeedPanel(p: Props) {
  const searchRef = useRef<HTMLInputElement>(null);
  // Render the list in pages: hundreds of rows with blurred glass behind them is what janks phones
  const pageSize = getConfig().feedPage;
  const [limit, setLimit] = useState(pageSize);
  const shown = p.crimes.slice(0, limit);

  // "/" focuses search
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "/" && document.activeElement?.tagName !== "INPUT") {
        e.preventDefault();
        searchRef.current?.focus();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  // Keep the selected row visible when the selection came from the globe
  useEffect(() => {
    if (p.activeId) {
      document.getElementById(`crime-${p.activeId}`)?.scrollIntoView({ block: "nearest", behavior: "smooth" });
    }
  }, [p.activeId]);

  const severities: { value: string; label: string; count?: number }[] = [
    { value: "ALL", label: "All", count: p.total },
    { value: "HIGH", label: "High", count: p.severityCounts.HIGH },
    { value: "MEDIUM", label: "Med", count: p.severityCounts.MEDIUM },
    { value: "LOW", label: "Low", count: p.severityCounts.LOW },
  ];

  return (
    <aside
      className={`glass absolute bottom-3 left-3 right-3 top-[76px] z-20 flex-col overflow-hidden rounded-3xl pb-[env(safe-area-inset-bottom)] md:bottom-4 md:left-4 md:right-auto md:top-[84px] md:flex md:w-[372px] ${
        p.open ? "flex" : "hidden"
      }`}
    >
      <div className="space-y-3 p-4 pb-3">
        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-white/35" />
          <input
            ref={searchRef}
            value={p.query}
            onChange={(e) => p.onQuery(e.target.value)}
            placeholder="Search city, state, keyword"
            className="w-full rounded-xl border border-white/[0.06] bg-white/[0.04] py-2 pl-9 pr-9 text-[12.5px] text-white placeholder:text-white/30 outline-none transition focus:border-maroon-700 focus:bg-white/[0.06]"
          />
          <kbd className="absolute right-2.5 top-1/2 -translate-y-1/2 rounded border border-white/10 px-1.5 font-mono text-[9px] text-white/30">
            /
          </kbd>
        </div>

        <div className="grid grid-cols-4 gap-1 rounded-xl bg-white/[0.04] p-1" role="tablist">
          {severities.map((s) => (
            <button
              key={s.value}
              role="tab"
              aria-selected={p.severity === s.value}
              onClick={() => p.onSeverity(s.value)}
              className={`cursor-pointer rounded-lg py-1.5 text-[11px] font-medium transition ${
                p.severity === s.value
                  ? "bg-white/10 text-white shadow-sm"
                  : "text-white/45 hover:text-white/80"
              }`}
            >
              {s.label} <span className="font-mono text-[9px] opacity-60">{s.count}</span>
            </button>
          ))}
        </div>

        <div className="no-scrollbar -mx-4 flex gap-1.5 overflow-x-auto px-4">
          {CATEGORIES.map((c) => (
            <button
              key={c.value}
              onClick={() => p.onCategory(c.value)}
              className={`shrink-0 cursor-pointer rounded-full border px-3 py-1 text-[11px] transition ${
                p.category === c.value
                  ? "border-maroon-700 bg-maroon-900/60 text-maroon-200"
                  : "border-white/[0.07] text-white/45 hover:border-white/20 hover:text-white/80"
              }`}
            >
              {c.label}
            </button>
          ))}
        </div>
      </div>

      <div className="thin-scroll min-h-0 flex-1 divide-y divide-white/[0.05] overflow-y-auto border-t border-white/[0.06]">
        {p.loading ? (
          <div className="space-y-3 p-4">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="h-20 animate-pulse rounded-lg bg-white/[0.04]" />
            ))}
          </div>
        ) : p.crimes.length === 0 ? (
          <p className="p-8 text-center text-xs text-white/35">No incidents match these filters.</p>
        ) : (
          <>
            {shown.map((c, i) => (
              <Row key={c.id} crime={c} index={i} active={p.activeId === c.id} onSelect={p.onSelect} />
            ))}
            {p.crimes.length > shown.length && (
              <button
                onClick={() => setLimit((l) => l + pageSize)}
                className="block w-full cursor-pointer py-4 font-mono text-[10.5px] tracking-widest text-maroon-200/70 transition hover:bg-white/[0.03]"
              >
                SHOW {Math.min(pageSize, p.crimes.length - shown.length)} MORE · {p.crimes.length - shown.length} HIDDEN
              </button>
            )}
          </>
        )}
      </div>
    </aside>
  );
}