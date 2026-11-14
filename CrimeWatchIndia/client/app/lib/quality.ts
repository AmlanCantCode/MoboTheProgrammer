"use client";

import { useSyncExternalStore } from "react";

export type Quality = "low" | "high";

export interface QualityConfig {
  low: boolean;
  /** max device-pixel-ratio the WebGL canvases render at */
  dpr: number;
  /** drifting dust sprites around the globe */
  dust: number;
  /** land-dot lattice size (≈30% become dots) */
  dotLattice: number;
  /** sphere tessellation for the halo */
  haloSegments: number;
  /** most pins ever drawn on the globe (each pin is its own mesh) */
  maxPins: number;
  /** most simultaneous radar-pulse rings */
  maxRings: number;
  pinSegments: number;
  ringSegments: number;
  /** intro particle sampling: image size + point-size multiplier */
  introSample: number;
  introPointScale: number;
  introAssembleS: number;
  /** feed rows rendered before "show more" */
  feedPage: number;
}

let cached: Quality | null = null;

/**
 * Picks a render tier once per page load. Phones, small screens, low-RAM / few-core
 * devices, Save-Data and reduced-motion users get "low". Override with ?q=low|high.
 */
export function getQuality(): Quality {
  if (typeof window === "undefined") return "high";
  if (cached) return cached;

  const forced = new URLSearchParams(window.location.search).get("q");
  if (forced === "low" || forced === "high") return (cached = forced);

  const mq = (q: string) => window.matchMedia(q).matches;
  const nav = navigator as Navigator & { deviceMemory?: number; connection?: { saveData?: boolean } };
  const phone = mq("(max-width: 767px)") || (mq("(pointer: coarse)") && window.innerWidth < 1024);
  const weak = (nav.deviceMemory ?? 8) <= 4 || (navigator.hardwareConcurrency ?? 8) <= 4 || !!nav.connection?.saveData;
  const reduced = mq("(prefers-reduced-motion: reduce)");

  return (cached = phone || weak || reduced ? "low" : "high");
}

export function getConfig(): QualityConfig {
  const low = getQuality() === "low";
  const dpr = typeof window === "undefined" ? 1 : window.devicePixelRatio || 1;
  return low
    ? {
        low, dpr: Math.min(dpr, 1.5), dust: 500, dotLattice: 22000, haloSegments: 40,
        maxPins: 150, maxRings: 10, pinSegments: 6, ringSegments: 20,
        introSample: 500, introPointScale: 1.7, introAssembleS: 2.4, feedPage: 40,
      }
    : {
        low, dpr: Math.min(dpr, 2), dust: 1800, dotLattice: 56000, haloSegments: 96,
        maxPins: 400, maxRings: 28, pinSegments: 12, ringSegments: 64,
        introSample: 1000, introPointScale: 1, introAssembleS: 3.4, feedPage: 80,
      };
}

/** React hook for render-time decisions (server snapshot is "high"; client corrects after hydration). */
export function useQuality(): Quality {
  return useSyncExternalStore(() => () => {}, getQuality, () => "high" as Quality);
}
