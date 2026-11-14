"use client";

import { useEffect, useRef } from "react";

/** Lagging ring + sharp dot that swells over interactive elements. Fine pointers only. */
export default function CursorTrail() {
  const ring = useRef<HTMLDivElement>(null);
  const dot = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!window.matchMedia("(pointer: fine)").matches) return;
    const target = { x: -100, y: -100 };
    const pos = { x: -100, y: -100 };
    let scale = 1;
    let want = 1;
    let raf = 0;

    const onMove = (e: PointerEvent) => {
      target.x = e.clientX;
      target.y = e.clientY;
      const el = e.target as Element | null;
      want = el?.closest("button, a, input, [role=tab], [role=button]") ? 1.9 : 1;
    };
    window.addEventListener("pointermove", onMove, { passive: true });

    const loop = () => {
      pos.x += (target.x - pos.x) * 0.16;
      pos.y += (target.y - pos.y) * 0.16;
      scale += (want - scale) * 0.18;
      if (ring.current) ring.current.style.transform = `translate3d(${pos.x}px,${pos.y}px,0) translate(-50%,-50%) scale(${scale})`;
      if (dot.current) dot.current.style.transform = `translate3d(${target.x}px,${target.y}px,0) translate(-50%,-50%)`;
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);

    return () => {
      window.removeEventListener("pointermove", onMove);
      cancelAnimationFrame(raf);
    };
  }, []);

  return (
    <div className="pointer-events-none fixed inset-0 z-[60] hidden [@media(pointer:fine)]:block" aria-hidden>
      <div
        ref={ring}
        className="absolute left-0 top-0 h-9 w-9 rounded-full border border-white/30 mix-blend-difference"
      />
      <div ref={dot} className="absolute left-0 top-0 h-1 w-1 rounded-full bg-maroon-400" />
    </div>
  );
}
