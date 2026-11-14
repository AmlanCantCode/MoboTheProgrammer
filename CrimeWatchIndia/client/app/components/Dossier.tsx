"use client";

import { useEffect } from "react";
import { X, ExternalLink, MapPin } from "lucide-react";
import { SEVERITY, stripHtml, timeAgo, type Crime } from "../lib/crime";

export default function Dossier({ crime, onClose }: { crime: Crime; onClose: () => void }) {
  const sev = SEVERITY[crime.severity];
  const summary = stripHtml(crime.summary);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <section
      key={crime.id}
      aria-label="Incident dossier"
      className="animate-dossier glass absolute inset-x-3 bottom-3 z-30 rounded-3xl p-5 md:inset-x-auto md:bottom-4 md:right-4 md:w-[440px]"
      style={{ boxShadow: `0 0 0 1px rgba(${sev.rgb},0.18), 0 30px 80px -30px rgba(${sev.rgb},0.35)` }}
    >
      <div className="flex items-center justify-between">
        <span
          className="flex items-center gap-2 rounded-full border px-2.5 py-1 font-mono text-[10px] font-semibold uppercase tracking-wider"
          style={{ color: sev.color, borderColor: `rgba(${sev.rgb},0.35)`, background: `rgba(${sev.rgb},0.08)` }}
        >
          <span className="h-1.5 w-1.5 rounded-full" style={{ background: sev.color }} />
          {sev.label} · {crime.category}
        </span>
        <button
          onClick={onClose}
          aria-label="Close dossier"
          className="cursor-pointer rounded-full p-1.5 text-white/40 transition hover:bg-white/10 hover:text-white"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      <h2 className="mt-4 text-[15.5px] font-semibold leading-snug text-white">{crime.title}</h2>
      {summary && (
        <div className="thin-scroll mt-2.5 max-h-36 overflow-y-auto rounded-xl border border-white/[0.05] bg-white/[0.02] p-3 text-[12.5px] leading-relaxed text-white/70">
          {summary}
        </div>
      )}

      <dl className="mt-4 grid grid-cols-2 gap-3 border-t border-white/[0.07] pt-4 font-mono text-[10.5px]">
        <div>
          <dt className="text-white/30">LOCATION</dt>
          <dd className="mt-0.5 flex items-center gap-1 text-white/80">
            <MapPin className="h-3 w-3 text-maroon-400" />
            {crime.city}, {crime.state}
          </dd>
        </div>
        <div>
          <dt className="text-white/30">COORDINATES</dt>
          <dd className="mt-0.5 text-white/80">
            {crime.lat.toFixed(2)}°N {crime.lng.toFixed(2)}°E
          </dd>
        </div>
        <div>
          <dt className="text-white/30">SOURCE</dt>
          <dd className="mt-0.5 truncate text-white/80">{crime.source}</dd>
        </div>
        <div>
          <dt className="text-white/30">REPORTED</dt>
          <dd className="mt-0.5 text-white/80">{timeAgo(crime.publishedAt)}</dd>
        </div>
      </dl>

      {crime.link && (
        <a
          href={crime.link}
          target="_blank"
          rel="noopener noreferrer"
          className="mt-4 flex items-center justify-center gap-2 rounded-xl bg-white/[0.06] py-2.5 text-xs font-medium text-white transition hover:bg-maroon-700"
        >
          Read full report <ExternalLink className="h-3.5 w-3.5" />
        </a>
      )}
    </section>
  );
}