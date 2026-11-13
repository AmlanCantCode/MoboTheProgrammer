"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { socket } from "@/lib/socket";
import { Brush, Eraser, PaintBucket, Trash2, Undo2 } from "lucide-react";

// Fixed logical resolution: every client draws on the same pixel grid, so
// replays (undo, late joiners) and flood fills come out identical everywhere.
const W = 800;
const H = 500;

const COLORS = [
  "#1d1b3a", "#6b6b7b", "#b9b9c6", "#ffffff", "#7a4a2b", "#c98a54",
  "#ff5a4f", "#ff8a3d", "#ffc93c", "#d6e84a", "#27c39b", "#1a9e6f",
  "#2bc0e4", "#3a7bff", "#2848b8", "#8b5cf6", "#e056fd", "#ff8fb8",
];
const SIZES = [3, 7, 14, 26];

type Tool = "brush" | "eraser" | "fill";

interface Seg { t: "seg"; sid: string; x0: number; y0: number; x1: number; y1: number; color: string; size: number }
interface Fill { t: "fill"; x: number; y: number; color: string }
type Op = Seg | Fill;

const hexRgb = (hex: string): [number, number, number] => {
  let h = hex.replace("#", "");
  if (h.length === 3) h = h.split("").map((c) => c + c).join("");
  const n = parseInt(h.slice(0, 6), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
};

function paintWhite(ctx: CanvasRenderingContext2D) {
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, W, H);
}

function drawSeg(ctx: CanvasRenderingContext2D, s: Omit<Seg, "t" | "sid">) {
  ctx.beginPath();
  ctx.moveTo(s.x0 * W, s.y0 * H);
  ctx.lineTo(s.x1 * W, s.y1 * H);
  ctx.strokeStyle = s.color;
  ctx.lineWidth = s.size;
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  ctx.stroke();
}

function floodFill(ctx: CanvasRenderingContext2D, nx: number, ny: number, hex: string) {
  const x = Math.min(W - 1, Math.max(0, Math.floor(nx * W)));
  const y = Math.min(H - 1, Math.max(0, Math.floor(ny * H)));
  const img = ctx.getImageData(0, 0, W, H);
  const d = img.data;
  const [fr, fg, fb] = hexRgb(hex);
  const i0 = (y * W + x) * 4;
  const tr = d[i0], tg = d[i0 + 1], tb = d[i0 + 2];
  if (tr === fr && tg === fg && tb === fb) return;

  const TOL = 80; // soaks up anti-aliased edges so fills don't leave halos
  const match = (i: number) => Math.abs(d[i] - tr) + Math.abs(d[i + 1] - tg) + Math.abs(d[i + 2] - tb) <= TOL;
  const seen = new Uint8Array(W * H);
  const stack: number[] = [x, y];

  while (stack.length) {
    const cy = stack.pop()!;
    const cx = stack.pop()!;
    let lx = cx;
    while (lx >= 0 && !seen[cy * W + lx] && match((cy * W + lx) * 4)) lx--;
    lx++;
    let up = false, down = false;
    for (let px = lx; px < W && !seen[cy * W + px] && match((cy * W + px) * 4); px++) {
      const p = cy * W + px;
      seen[p] = 1;
      d[p * 4] = fr; d[p * 4 + 1] = fg; d[p * 4 + 2] = fb; d[p * 4 + 3] = 255;
      if (cy > 0) {
        const m = !seen[p - W] && match((p - W) * 4);
        if (m && !up) { stack.push(px, cy - 1); up = true; } else if (!m) up = false;
      }
      if (cy < H - 1) {
        const m = !seen[p + W] && match((p + W) * 4);
        if (m && !down) { stack.push(px, cy + 1); down = true; } else if (!m) down = false;
      }
    }
  }
  ctx.putImageData(img, 0, 0);
}

interface CanvasBoardProps {
  canDraw: boolean;
  overlayActive?: boolean; // on phones the canvas steps aside so overlay cards fit
  children?: React.ReactNode; // stage overlays render inside the paper
}

export default function CanvasBoard({ canDraw, overlayActive, children }: CanvasBoardProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [tool, setTool] = useState<Tool>("brush");
  const [color, setColor] = useState(COLORS[0]);
  const [size, setSize] = useState(SIZES[1]);

  const stroke = useRef<{ sid: string; x: number; y: number } | null>(null);

  const ctx = () => canvasRef.current?.getContext("2d", { willReadFrequently: true }) ?? null;

  const applyOp = useCallback((op: Op) => {
    const c = canvasRef.current?.getContext("2d", { willReadFrequently: true });
    if (!c) return;
    if (op.t === "seg") drawSeg(c, op);
    else floodFill(c, op.x, op.y, op.color);
  }, []);

  // Socket wiring + initial white paper
  useEffect(() => {
    const c = canvasRef.current?.getContext("2d", { willReadFrequently: true });
    if (c) paintWhite(c);

    const onSeg = (op: Seg) => applyOp({ ...op, t: "seg" });
    const onFill = (op: Fill) => applyOp({ ...op, t: "fill" });
    const onClear = () => { const k = canvasRef.current?.getContext("2d"); if (k) paintWhite(k); };
    const onHistory = (ops: Op[]) => {
      const k = canvasRef.current?.getContext("2d", { willReadFrequently: true });
      if (!k) return;
      paintWhite(k);
      ops.forEach(applyOp);
    };

    socket.on("draw_stroke", onSeg);
    socket.on("fill", onFill);
    socket.on("clear_canvas", onClear);
    socket.on("canvas_history", onHistory);
    return () => {
      socket.off("draw_stroke", onSeg);
      socket.off("fill", onFill);
      socket.off("clear_canvas", onClear);
      socket.off("canvas_history", onHistory);
    };
  }, [applyOp]);

  const point = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const r = e.currentTarget.getBoundingClientRect();
    return {
      x: Math.min(1, Math.max(0, (e.clientX - r.left) / r.width)),
      y: Math.min(1, Math.max(0, (e.clientY - r.top) / r.height)),
    };
  };

  const strokeColor = tool === "eraser" ? "#ffffff" : color;
  const strokeSize = tool === "eraser" ? size * 1.6 : size;

  const onDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!canDraw) return;
    e.currentTarget.setPointerCapture(e.pointerId);
    const p = point(e);

    if (tool === "fill") {
      const k = ctx();
      if (k) floodFill(k, p.x, p.y, color);
      socket.emit("fill", { x: p.x, y: p.y, color });
      return;
    }
    const sid = Math.random().toString(36).slice(2, 10);
    stroke.current = { sid, ...p };
    const seg = { x0: p.x, y0: p.y, x1: p.x, y1: p.y, color: strokeColor, size: strokeSize };
    const k = ctx();
    if (k) drawSeg(k, seg); // a click leaves a dot
    socket.emit("draw_stroke", { sid, ...seg });
  };

  const onMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const s = stroke.current;
    if (!s || !canDraw) return;
    const p = point(e);
    const seg = { x0: s.x, y0: s.y, x1: p.x, y1: p.y, color: strokeColor, size: strokeSize };
    const k = ctx();
    if (k) drawSeg(k, seg);
    socket.emit("draw_stroke", { sid: s.sid, ...seg });
    stroke.current = { sid: s.sid, ...p };
  };

  const onUp = () => { stroke.current = null; };

  const undo = useCallback(() => { if (canDraw) socket.emit("undo"); }, [canDraw]);

  const clear = () => {
    if (!canDraw) return;
    const k = ctx();
    if (k) paintWhite(k);
    socket.emit("clear_canvas");
  };

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "z" && !(e.target instanceof HTMLInputElement)) {
        e.preventDefault();
        undo();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [undo]);

  const toolBtn = (t: Tool, label: string, Icon: typeof Brush) => (
    <button
      key={t}
      onClick={() => setTool(t)}
      aria-pressed={tool === t}
      aria-label={label}
      title={label}
      className={`btn px-2.5 py-2 ${tool === t ? "!bg-sun" : ""}`}
    >
      <Icon className="h-5 w-5" />
    </button>
  );

  return (
    <div className="flex flex-col gap-3">
      <div className="sticker relative overflow-hidden !rounded-2xl p-0">
        <canvas
          ref={canvasRef}
          width={W}
          height={H}
          onPointerDown={onDown}
          onPointerMove={onMove}
          onPointerUp={onUp}
          onPointerCancel={onUp}
          className={`block aspect-[8/5] w-full touch-none bg-white ${overlayActive ? "max-sm:hidden" : ""} ${canDraw ? (tool === "fill" ? "cursor-cell" : "cursor-crosshair") : "cursor-default"}`}
          aria-label="Drawing canvas"
        />
        {children}
      </div>

      {canDraw && (
        <div className="sticker flex flex-wrap items-center gap-x-4 gap-y-2 px-3 py-2.5">
          <div className="flex gap-1.5">
            {toolBtn("brush", "Brush", Brush)}
            {toolBtn("eraser", "Eraser", Eraser)}
            {toolBtn("fill", "Fill", PaintBucket)}
          </div>

          <div className="grid grid-cols-9 gap-1" role="group" aria-label="Colours">
            {COLORS.map((c) => (
              <button
                key={c}
                onClick={() => { setColor(c); if (tool === "eraser") setTool("brush"); }}
                aria-label={`Colour ${c}`}
                aria-pressed={color === c && tool !== "eraser"}
                className={`h-7 w-7 rounded-md border-2 border-ink transition-transform ${
                  color === c && tool !== "eraser" ? "-translate-y-0.5 scale-110 shadow-pop-sm" : "hover:scale-105"
                }`}
                style={{ backgroundColor: c }}
              />
            ))}
          </div>

          <div className="flex items-center gap-1.5" role="group" aria-label="Brush size">
            {SIZES.map((s) => (
              <button
                key={s}
                onClick={() => setSize(s)}
                aria-label={`Brush size ${s}`}
                aria-pressed={size === s}
                className={`flex h-9 w-9 items-center justify-center rounded-lg border-2 border-ink ${size === s ? "bg-sun" : "bg-white hover:bg-ink/5"}`}
              >
                <span className="rounded-full bg-ink" style={{ width: Math.max(5, s * 0.7), height: Math.max(5, s * 0.7) }} />
              </button>
            ))}
          </div>

          <div className="ml-auto flex gap-1.5">
            <button onClick={undo} className="btn px-2.5 py-2" aria-label="Undo (Ctrl+Z)" title="Undo (Ctrl+Z)">
              <Undo2 className="h-5 w-5" />
            </button>
            <button onClick={clear} className="btn px-3 py-2" aria-label="Clear canvas">
              <Trash2 className="h-5 w-5" />
              <span className="hidden sm:inline">Clear</span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
