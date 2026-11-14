"use client";

import { useEffect, useRef } from "react";

/** Halftone eye that tracks the cursor with eased motion and an occasional blink. */
export default function EyeMark({ width = 64, height = 28 }: { width?: number; height?: number }) {
  const ref = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = ref.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx) return;

    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = width * dpr;
    canvas.height = height * dpr;
    ctx.scale(dpr, dpr);

    const target = { x: 0, y: 0 };
    const pupil = { x: 0, y: 0 };
    let blink = 0; // 0 open → 1 closed
    let nextBlink = performance.now() + 2500;
    let raf = 0;

    const onMove = (e: MouseEvent) => {
      const r = canvas.getBoundingClientRect();
      const dx = e.clientX - (r.left + r.width / 2);
      const dy = e.clientY - (r.top + r.height / 2);
      const d = Math.hypot(dx, dy) || 1;
      const m = Math.min(d * 0.12, 7);
      target.x = (dx / d) * m;
      target.y = (dy / d) * m * 0.55;
    };
    window.addEventListener("mousemove", onMove, { passive: true });

    const cx = width / 2;
    const cy = height / 2;

    const draw = (t: number) => {
      pupil.x += (target.x - pupil.x) * 0.14;
      pupil.y += (target.y - pupil.y) * 0.14;

      if (t > nextBlink) {
        blink = Math.min(1, blink + 0.25);
        if (blink >= 1) {
          nextBlink = t + 2500 + Math.random() * 3500;
          blink = 0.999;
        }
      } else if (blink > 0) {
        blink = Math.max(0, blink - 0.2);
      }
      const open = 1 - blink;

      ctx.clearRect(0, 0, width, height);

      // halftone almond
      ctx.fillStyle = "#831843";
      for (let x = -28; x <= 28; x += 4) {
        for (let y = -11; y <= 11; y += 4) {
          if ((x * x) / 784 + (y * y) / 121 <= 1) ctx.fillRect(cx + x, cy + y * open, 1.4, 1.4);
        }
      }

      ctx.fillStyle = "#030406";
      ctx.beginPath();
      ctx.ellipse(cx, cy, 20, Math.max(0.6, 9 * open), 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = "rgba(255,255,255,0.85)";
      ctx.lineWidth = 0.8;
      ctx.stroke();

      if (open > 0.3) {
        ctx.fillStyle = "#fff";
        ctx.beginPath();
        ctx.arc(cx + pupil.x, cy + pupil.y, 5.5 * open, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = "#be123c";
        ctx.beginPath();
        ctx.arc(cx + pupil.x, cy + pupil.y, 2.4 * open, 0, Math.PI * 2);
        ctx.fill();
      }
      raf = requestAnimationFrame(draw);
    };
    raf = requestAnimationFrame(draw);

    return () => {
      window.removeEventListener("mousemove", onMove);
      cancelAnimationFrame(raf);
    };
  }, [width, height]);

  return <canvas ref={ref} style={{ width, height }} className="block" aria-hidden />;
}
