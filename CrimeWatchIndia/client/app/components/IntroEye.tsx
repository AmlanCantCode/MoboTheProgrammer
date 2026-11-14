"use client";

import { useEffect, useRef, useState } from "react";
import * as THREE from "three";
import { getConfig } from "../lib/quality";

/**
 * Cinematic intro: the halftone eye is rebuilt as GPU particles.
 * - assembles from noise, staggered per particle
 * - repels from the cursor and heats to maroon where disturbed
 * - the iris cluster physically follows the cursor
 * - on exit the whole cloud blasts toward the camera and fades
 */

const WORLD_W = 16; // eye width in world units
const IRIS = { x: (495 / 1000 - 0.5) * WORLD_W, y: -(470 / 1000 - 0.5) * WORLD_W };
const EXIT_S = 1.6;

const VERT = /* glsl */ `
  uniform float uTime, uAssemble, uExit, uPx, uSize;
  uniform vec2 uMouse, uLook;
  attribute vec3 aTarget;
  attribute vec4 aRand;
  attribute float aShade;
  varying float vShade, vHeat, vAlpha;

  void main() {
    float delay = aRand.x * 0.42;
    float a = clamp((uAssemble - delay) / 0.58, 0.0, 1.0);
    a = 1.0 - pow(1.0 - a, 3.0);

    vec3 scatter = (aRand.yzw - 0.5) * vec3(34.0, 22.0, 30.0);
    vec3 p = mix(scatter, aTarget, a);

    // living drift: wide while scattered, a faint shimmer once settled
    float amp = 0.035 + (1.0 - a) * 0.5;
    p += vec3(
      sin(uTime * 0.7 + aRand.y * 6.283),
      cos(uTime * 0.6 + aRand.z * 6.283),
      sin(uTime * 0.5 + aRand.w * 6.283)
    ) * amp;
    p.z += sin(aTarget.x * 0.7 + uTime * 1.3) * 0.1 * a;

    // iris follows the cursor
    float iris = smoothstep(1.75, 1.2, length(aTarget.xy - vec2(${IRIS.x.toFixed(3)}, ${IRIS.y.toFixed(3)})));
    p.xy += uLook * iris;

    // cursor repulsion field
    vec2 d = p.xy - uMouse;
    float dist = length(d);
    float inf = smoothstep(2.0, 0.0, dist) * a;
    p.xy += normalize(d + 1e-4) * inf * 0.8;
    p.z += inf * 1.6;

    // exit: blast outward + toward camera
    vec3 dir = normalize(p + (aRand.yzw - 0.5) * 6.0);
    p += dir * uExit * (6.0 + aRand.x * 20.0);
    p.z += uExit * uExit * 26.0;

    vec4 mv = modelViewMatrix * vec4(p, 1.0);
    gl_Position = projectionMatrix * mv;
    gl_PointSize = (1.1 + aRand.x * 0.9 + inf * 2.4) * uSize * uPx * (16.0 / -mv.z);

    vShade = aShade;
    vHeat = inf;
    vAlpha = (1.0 - smoothstep(0.25, 0.95, uExit)) * mix(0.15, 1.0, a);
  }`;

const FRAG = /* glsl */ `
  varying float vShade, vHeat, vAlpha;
  void main() {
    float r = length(gl_PointCoord - 0.5);
    if (r > 0.5) discard;
    vec3 base = mix(vec3(0.55), vec3(0.96), vShade);
    vec3 hot = vec3(0.86, 0.1, 0.28);
    vec3 col = mix(base, hot, clamp(vHeat * 1.4, 0.0, 1.0));
    gl_FragColor = vec4(col, vAlpha * smoothstep(0.5, 0.15, r));
  }`;

interface Props {
  exiting: boolean;
  onEnter: () => void;
  onDone: () => void;
  /** fired once the eye has fully assembled (the page uses it to start loading the globe) */
  onReady?: () => void;
}

export default function IntroEye({ exiting, onEnter, onDone, onReady }: Props) {
  const mountRef = useRef<HTMLDivElement>(null);
  const counterRef = useRef<HTMLSpanElement>(null);
  const exitingRef = useRef(exiting);
  const onDoneRef = useRef(onDone);
  const onReadyRef = useRef(onReady);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    exitingRef.current = exiting;
    onDoneRef.current = onDone;
    onReadyRef.current = onReady;
  }, [exiting, onDone, onReady]);

  // Enter / Space / Esc all start the transition
  useEffect(() => {
    if (!ready || exiting) return;
    const onKey = (e: KeyboardEvent) => {
      if (["Enter", " ", "Escape"].includes(e.key)) onEnter();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [ready, exiting, onEnter]);

  useEffect(() => {
    const mount = mountRef.current;
    if (!mount) return;

    const cfg = getConfig();
    const renderer = new THREE.WebGLRenderer({ alpha: true, antialias: false, powerPreference: cfg.low ? "low-power" : "high-performance" });
    const px = cfg.dpr;
    renderer.setPixelRatio(px);
    renderer.setClearColor(0x000000, 0);
    mount.appendChild(renderer.domElement);
    renderer.domElement.style.cssText = "position:absolute;inset:0;width:100%;height:100%";

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(45, 1, 0.1, 100);
    camera.position.z = 14;
    const group = new THREE.Group();
    scene.add(group);

    const uniforms = {
      uTime: { value: 0 },
      uAssemble: { value: 0 },
      uExit: { value: 0 },
      uPx: { value: px * (window.innerHeight / 900) },
      uSize: { value: cfg.introPointScale },
      uMouse: { value: new THREE.Vector2(99, 99) },
      uLook: { value: new THREE.Vector2() },
    };
    const material = new THREE.ShaderMaterial({
      uniforms,
      vertexShader: VERT,
      fragmentShader: FRAG,
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    });

    let geometry: THREE.BufferGeometry | null = null;
    let points: THREE.Points | null = null;
    let disposed = false;

    // Sample the eye image into particle targets
    const img = new Image();
    img.src = "/eye.png";
    img.onload = () => {
      if (disposed) return;
      const S = cfg.introSample; // 1000 on desktop, 500 on phones → ~4× fewer particles
      const c = document.createElement("canvas");
      c.width = c.height = S;
      const ctx = c.getContext("2d", { willReadFrequently: true })!;
      ctx.drawImage(img, 0, 0, S, S);
      const data = ctx.getImageData(0, 0, S, S).data;

      const step = 2;
      const t: number[] = [];
      const r: number[] = [];
      const sh: number[] = [];
      for (let y = 0; y < S; y += step) {
        for (let x = 0; x < S; x += step) {
          const lum = data[(y * S + x) * 4];
          if (lum < 70) continue;
          const wx = (x / S - 0.5) * WORLD_W;
          const wy = -(y / S - 0.5) * WORLD_W;
          // soft dome so the eye has volume
          const dome = Math.max(0, 1 - Math.hypot(wx / 8.5, wy / 4.6)) * 1.4;
          t.push(wx, wy, dome + (Math.random() - 0.5) * 0.15);
          r.push(Math.random(), Math.random(), Math.random(), Math.random());
          sh.push(lum / 255);
        }
      }
      geometry = new THREE.BufferGeometry();
      geometry.setAttribute("position", new THREE.BufferAttribute(new Float32Array(t.length), 3));
      geometry.setAttribute("aTarget", new THREE.BufferAttribute(new Float32Array(t), 3));
      geometry.setAttribute("aRand", new THREE.BufferAttribute(new Float32Array(r), 4));
      geometry.setAttribute("aShade", new THREE.BufferAttribute(new Float32Array(sh), 1));
      points = new THREE.Points(geometry, material);
      points.frustumCulled = false;
      group.add(points);
      startTime = performance.now();
    };

    // sizing: keep the whole eye in frame on narrow screens
    const resize = () => {
      const w = mount.clientWidth;
      const h = mount.clientHeight;
      renderer.setSize(w, h, false);
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      const visW = 2 * Math.tan((45 * Math.PI) / 360) * camera.position.z * camera.aspect;
      const s = Math.min(1.15, (visW * 0.86) / WORLD_W);
      group.scale.setScalar(s);
      uniforms.uPx.value = px * Math.min(1.4, h / 900 + 0.3);
    };
    group.position.y = 1.0;
    resize();
    const ro = new ResizeObserver(resize);
    ro.observe(mount);

    // autonomous gaze: the eye darts to random points, holds, and occasionally recentres
    const gaze = new THREE.Vector2(0, 0);
    const smooth = new THREE.Vector2(0, 0);
    let nextGaze = 0;
    uniforms.uMouse.value.set(999, 999); // no cursor repulsion

    let startTime = performance.now() + 1e9; // wait for image
    let exitStart = 0;
    let raf = 0;
    let announced = false;
    const t0 = performance.now();

    const frame = (now: number) => {
      raf = requestAnimationFrame(frame);
      uniforms.uTime.value = (now - t0) / 1000;

      if (now >= nextGaze) {
        if (Math.random() < 0.25) gaze.set(0, 0);
        else gaze.set((Math.random() * 2 - 1) * 0.95, (Math.random() * 2 - 1) * 0.8);
        nextGaze = now + 900 + Math.random() * 2200;
      }
      smooth.lerp(gaze, 0.06);
      uniforms.uLook.value.set(smooth.x * 0.75, smooth.y * 0.4);

      // parallax tilt gives the flat image depth
      group.rotation.y += (smooth.x * 0.22 - group.rotation.y) * 0.05;
      group.rotation.x += (-smooth.y * 0.14 - group.rotation.x) * 0.05;

      const asm = THREE.MathUtils.clamp((now - startTime) / 1000 / cfg.introAssembleS, 0, 1);
      uniforms.uAssemble.value = asm;
      if (counterRef.current) counterRef.current.textContent = String(Math.round(asm * 100)).padStart(3, "0");
      if (asm >= 1 && !announced) {
        announced = true;
        setReady(true);
        onReadyRef.current?.();
      }

      if (exitingRef.current) {
        if (!exitStart) exitStart = now;
        const e = THREE.MathUtils.clamp((now - exitStart) / 1000 / EXIT_S, 0, 1);
        uniforms.uExit.value = e * e * (3 - 2 * e);
        camera.position.z = 14 - e * 4;
        if (e >= 1) {
          onDoneRef.current();
          cancelAnimationFrame(raf);
          return;
        }
      }
      renderer.render(scene, camera);
    };
    raf = requestAnimationFrame(frame);

    return () => {
      disposed = true;
      cancelAnimationFrame(raf);
      ro.disconnect();
      geometry?.dispose();
      material.dispose();
      renderer.dispose();
      renderer.domElement.remove();
    };
  }, []);

  const letters = "THE EYE".split("");

  return (
    <div
      className="fixed inset-0 z-50 overflow-hidden bg-ink transition-opacity duration-[900ms] ease-out"
      style={{ opacity: exiting ? 0 : 1, transitionDelay: exiting ? "800ms" : "0ms" }}
    >
      <div className="stage-bg absolute inset-0" />
      <div ref={mountRef} className="absolute inset-0" />

      {/* HUD corners */}
      <div className="pointer-events-none absolute inset-x-0 top-0 flex justify-between p-5 font-mono text-[10px] tracking-[0.3em] text-white/35 md:p-8">
        <span>TACTICAL GRID · IN</span>
        <span>
          INIT <span ref={counterRef}>000</span>
        </span>
      </div>

      {/* title + CTA */}
      <div
        className="absolute inset-x-0 bottom-[6vh] flex flex-col items-center gap-5 transition-all duration-700 ease-out"
        style={{ opacity: exiting ? 0 : 1, transform: exiting ? "translateY(16px)" : "none" }}
      >
        <h1 className="flex overflow-hidden text-[clamp(2rem,6vw,4.5rem)] font-light leading-none tracking-[0.38em] text-white">
          {letters.map((ch, i) => (
            <span
              key={i}
              className="reveal-letter inline-block"
              style={{ animationDelay: `${600 + i * 90}ms`, width: ch === " " ? "0.5em" : undefined }}
            >
              {ch}
            </span>
          ))}
        </h1>
        <p
          className="reveal-letter px-4 text-center font-mono text-[9px] uppercase tracking-[0.28em] text-maroon-200/70 sm:text-[10px] sm:tracking-[0.45em]"
          style={{ animationDelay: "1500ms" }}
        >
          Real-time crime intelligence · India
        </p>

        <button
          onClick={onEnter}
          disabled={!ready || exiting}
          className="group relative mt-2 cursor-pointer overflow-hidden rounded-full border border-white/15 px-9 py-3 font-mono text-[11px] tracking-[0.35em] text-white transition-all duration-700 hover:border-maroon-500 disabled:pointer-events-none"
          style={{ opacity: ready ? 1 : 0, transform: ready ? "none" : "translateY(10px)" }}
        >
          <span className="absolute inset-0 -translate-x-full bg-maroon-700 transition-transform duration-500 ease-out group-hover:translate-x-0" />
          <span className="relative">ENTER GRID</span>
        </button>
        <span
          className="font-mono text-[9px] tracking-[0.3em] text-white/25 transition-opacity duration-700"
          style={{ opacity: ready ? 1 : 0 }}
        >
          PRESS ENTER
        </span>
      </div>
    </div>
  );
}
