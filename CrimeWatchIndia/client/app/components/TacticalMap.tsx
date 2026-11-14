"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Globe, { type GlobeMethods } from "react-globe.gl";
import * as THREE from "three";
import { feature } from "topojson-client";
import type { Topology } from "topojson-specification";
import countries110m from "world-atlas/countries-110m.json";
import { createLandDots } from "../lib/landDots";
import { INDIA_VIEW, SEVERITY, escapeHtml, type Crime } from "../lib/crime";

interface Props {
  crimes: Crime[];
  selected: Crime | null;
  onSelect: (c: Crime | null) => void;
  /** false while the intro plays; flips true to trigger the cinematic fly-in */
  ready: boolean;
}

const GLOBE_RADIUS = 100; // three-globe's fixed radius
const IDLE_RETURN_MS = 4500;

/* ---------- shaders ---------- */

const RIM_VERT = /* glsl */ `
  varying vec3 vNormal; varying vec3 vView;
  void main() {
    vec4 mv = modelViewMatrix * vec4(position, 1.0);
    vNormal = normalize(normalMatrix * normal);
    vView = normalize(-mv.xyz);
    gl_Position = projectionMatrix * mv;
  }`;

/** Globe body: near-black with a soft maroon fresnel rim. */
const BODY_FRAG = /* glsl */ `
  uniform vec3 uBase; uniform vec3 uRim;
  varying vec3 vNormal; varying vec3 vView;
  void main() {
    float f = pow(1.0 - max(dot(vNormal, vView), 0.0), 2.6);
    gl_FragColor = vec4(mix(uBase, uRim, f * 0.75), 1.0);
  }`;

/** Outer halo: additive glow that fades out away from the limb. */
const HALO_FRAG = /* glsl */ `
  uniform vec3 uColor; uniform float uPower; uniform float uTime;
  varying vec3 vNormal; varying vec3 vView;
  void main() {
    // back faces: dot is 0 at the outer edge, most negative toward the globe limb
    float f = pow(clamp(-dot(vNormal, vView), 0.0, 1.0), uPower) * 1.35;
    float breathe = 0.9 + 0.1 * sin(uTime * 0.9);
    gl_FragColor = vec4(uColor, clamp(f, 0.0, 1.0) * breathe * 0.85);
  }`;

function useGlobeMaterials() {
  return useMemo(() => {
    const body = new THREE.ShaderMaterial({
      uniforms: { uBase: { value: new THREE.Color("#030406") }, uRim: { value: new THREE.Color("#be123c") } },
      vertexShader: RIM_VERT,
      fragmentShader: BODY_FRAG,
    });
    const halo = new THREE.ShaderMaterial({
      uniforms: {
        uColor: { value: new THREE.Color("#be123c") },
        uPower: { value: 2.4 },
        uTime: { value: 0 },
      },
      vertexShader: RIM_VERT,
      fragmentShader: HALO_FRAG,
      side: THREE.BackSide,
      blending: THREE.AdditiveBlending,
      transparent: true,
      depthWrite: false,
    });
    return { body, halo };
  }, []);
}

/* ---------- component ---------- */

type RingDatum = { lat: number; lng: number; rgb: string; maxR: number; speed: number; period: number };

export default function TacticalMap({ crimes, selected, onSelect, ready }: Props) {
  const globeRef = useRef<GlobeMethods | undefined>(undefined);
  const containerRef = useRef<HTMLDivElement>(null);
  const idleTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const selectedRef = useRef<Crime | null>(selected);
  const readyRef = useRef(ready);
  const rafRef = useRef(0);
  const sceneObjs = useRef<THREE.Object3D[]>([]);
  const disposers = useRef<(() => void)[]>([]);
  const [size, setSize] = useState({ width: 0, height: 0 });

  const { body, halo } = useGlobeMaterials();

  const land = useMemo(() => {
    const topo = countries110m as unknown as Topology;
    return feature(topo, topo.objects.countries as never) as unknown as { features: object[] };
  }, []);

  useEffect(() => {
    selectedRef.current = selected;
  }, [selected]);

  /* responsive sizing without window-resize thrash */
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const ro = new ResizeObserver(([entry]) => {
      const { width, height } = entry.contentRect;
      setSize({ width: Math.round(width), height: Math.round(height) });
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const flyHome = useCallback((ms = 1800) => {
    globeRef.current?.pointOfView(INDIA_VIEW, ms);
  }, []);

  /* one-time scene setup */
  const handleReady = useCallback(() => {
    const globe = globeRef.current;
    if (!globe) return;

    globe.renderer().setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));

    const controls = globe.controls();
    controls.enableDamping = true;
    controls.dampingFactor = 0.07;
    controls.rotateSpeed = 0.55;
    controls.zoomSpeed = 0.55;
    controls.enablePan = false;
    controls.minDistance = 160;
    controls.maxDistance = 420;

    // Halo sphere sits just outside the globe
    const haloMesh = new THREE.Mesh(new THREE.SphereGeometry(GLOBE_RADIUS * 1.22, 96, 96), halo);
    haloMesh.renderOrder = -1;
    globe.scene().add(haloMesh);

    // Drifting dust shell + halo breathing, driven by a single rAF loop
    const N = 1800;
    const pos = new Float32Array(N * 3);
    for (let i = 0; i < N; i++) {
      const r = GLOBE_RADIUS * (1.5 + Math.random() * 2.6);
      const th = Math.random() * Math.PI * 2;
      const ph = Math.acos(2 * Math.random() - 1);
      pos[i * 3] = r * Math.sin(ph) * Math.cos(th);
      pos[i * 3 + 1] = r * Math.cos(ph);
      pos[i * 3 + 2] = r * Math.sin(ph) * Math.sin(th);
    }
    const dustGeo = new THREE.BufferGeometry();
    dustGeo.setAttribute("position", new THREE.BufferAttribute(pos, 3));
    // round, soft-edged sprite instead of the default square
    const sprite = document.createElement("canvas");
    sprite.width = sprite.height = 32;
    const sctx = sprite.getContext("2d")!;
    const grad = sctx.createRadialGradient(16, 16, 0, 16, 16, 16);
    grad.addColorStop(0, "rgba(255,255,255,1)");
    grad.addColorStop(1, "rgba(255,255,255,0)");
    sctx.fillStyle = grad;
    sctx.fillRect(0, 0, 32, 32);
    const dust = new THREE.Points(
      dustGeo,
      new THREE.PointsMaterial({
        color: "#fda4af",
        size: 1.6,
        map: new THREE.CanvasTexture(sprite),
        transparent: true,
        opacity: 0.4,
        depthWrite: false,
      })
    );
    globe.scene().add(dust);

    // Dot-matrix landmasses (replaces h3-based hexPolygons, which throw on some countries)
    const landDots = createLandDots(GLOBE_RADIUS, INDIA_VIEW);
    globe.scene().add(landDots.points);
    sceneObjs.current = [dust, haloMesh, landDots.points];
    disposers.current = [landDots.dispose];

    const t0 = performance.now();
    let last = t0;
    const tick = (now: number) => {
      halo.uniforms.uTime.value = (now - t0) / 1000;
      landDots.uniforms.uTime.value = (now - t0) / 1000;
      if (readyRef.current && landDots.uniforms.uReveal.value < 1) {
        landDots.uniforms.uReveal.value = Math.min(1, landDots.uniforms.uReveal.value + (now - last) / 3600);
      }
      dust.rotation.y += (now - last) * 0.000012;
      dust.rotation.x = Math.sin((now - t0) / 9000) * 0.05;
      last = now;
      rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);

    // Start far out in space if the intro is still playing; the fly-in fires when `ready` flips
    if (readyRef.current) flyHome(2200);
    else globe.pointOfView({ ...INDIA_VIEW, altitude: 5.5 }, 0);
  }, [halo, flyHome]);

  /* cinematic fly-in when the intro hands over */
  useEffect(() => {
    readyRef.current = ready;
    if (ready) globeRef.current?.pointOfView(INDIA_VIEW, 3800);
  }, [ready]);

  /* ease back to India once the user stops interacting (and nothing is selected) */
  useEffect(() => {
    const controls = globeRef.current?.controls();
    if (!controls) return;
    const onStart = () => {
      if (idleTimer.current) clearTimeout(idleTimer.current);
    };
    const onEnd = () => {
      if (idleTimer.current) clearTimeout(idleTimer.current);
      idleTimer.current = setTimeout(() => {
        if (!selectedRef.current) flyHome(2000);
      }, IDLE_RETURN_MS);
    };
    controls.addEventListener("start", onStart);
    controls.addEventListener("end", onEnd);
    return () => {
      controls.removeEventListener("start", onStart);
      controls.removeEventListener("end", onEnd);
      if (idleTimer.current) clearTimeout(idleTimer.current);
    };
  }, [flyHome, size.width]);

  /* cinematic fly-to on selection; return home on deselect */
  useEffect(() => {
    const globe = globeRef.current;
    if (!globe || !readyRef.current) return;
    if (selected) {
      // Nudge the camera east so the pin lands left of centre, clear of the dossier card
      globe.pointOfView({ lat: selected.lat, lng: selected.lng + 3.2, altitude: 1.1 }, 1500);
    } else {
      flyHome(1600);
    }
  }, [selected, flyHome]);

  /* stop burning GPU while the tab is hidden */
  useEffect(() => {
    const onVis = () => {
      const g = globeRef.current;
      if (!g) return;
      if (document.hidden) g.pauseAnimation();
      else g.resumeAnimation();
    };
    document.addEventListener("visibilitychange", onVis);
    return () => document.removeEventListener("visibilitychange", onVis);
  }, []);

  useEffect(
    () => () => {
      cancelAnimationFrame(rafRef.current);
      disposers.current.forEach((d) => d());
      sceneObjs.current.forEach((o) => {
        o.parent?.remove(o);
        (o as THREE.Mesh).geometry?.dispose();
      });
    },
    []
  );

  /* data */
  const points = useMemo(
    () =>
      crimes.map((c) => ({
        ...c,
        color: SEVERITY[c.severity].color,
        radius: c.id === selected?.id ? 0.7 : c.severity === "HIGH" ? 0.5 : 0.36,
      })),
    [crimes, selected]
  );

  const rings = useMemo<RingDatum[]>(() => {
    const out: RingDatum[] = crimes
      .filter((c) => c.severity === "HIGH" && c.id !== selected?.id)
      .map((c) => ({ lat: c.lat, lng: c.lng, rgb: SEVERITY.HIGH.rgb, maxR: 3.2, speed: 1.6, period: 1900 }));
    if (selected) {
      // Selected pin gets a tighter, faster, white "lock-on" pulse
      out.push({ lat: selected.lat, lng: selected.lng, rgb: "255,255,255", maxR: 2.2, speed: 2.6, period: 1000 });
    }
    return out;
  }, [crimes, selected]);

  const tooltip = useCallback((d: object) => {
    const c = d as Crime & { color: string };
    return `<div style="background:rgba(8,9,13,.92);border:1px solid rgba(255,255,255,.1);padding:8px 11px;border-radius:12px;font:11px/1.45 var(--font-geist-sans),system-ui;color:#f5f5f7;max-width:240px;backdrop-filter:blur(12px)">
      <div style="font:600 9px var(--font-geist-mono),monospace;letter-spacing:.14em;color:${c.color};text-transform:uppercase">${escapeHtml(c.severity)} · ${escapeHtml(c.city)}</div>
      <div style="margin-top:3px">${escapeHtml(c.title)}</div></div>`;
  }, []);

  return (
    <div ref={containerRef} className="stage-bg absolute inset-0 cursor-grab select-none overflow-hidden active:cursor-grabbing">
      <div className="stage-halftone" />
      {size.width > 0 && (
        <Globe
          ref={globeRef}
          width={size.width}
          height={size.height}
          backgroundColor="rgba(0,0,0,0)"
          globeMaterial={body}
          showAtmosphere={false}
          onGlobeReady={handleReady}
          /* landmasses: sparse dot matrix + faint borders */
          polygonsData={land.features}
          polygonCapColor={() => "rgba(0,0,0,0)"}
          polygonSideColor={() => "rgba(0,0,0,0)"}
          polygonStrokeColor={() => "rgba(190,18,60,0.4)"}
          polygonAltitude={0.002}
          /* incident pins */
          pointsData={points}
          pointLat="lat"
          pointLng="lng"
          pointColor="color"
          pointRadius="radius"
          pointAltitude={0.012}
          pointResolution={12}
          pointsMerge={false}
          pointLabel={tooltip}
          onPointClick={(p) => onSelect(p as unknown as Crime)}
          onGlobeClick={() => onSelect(null)}
          /* radar pulses */
          ringsData={rings}
          ringLat="lat"
          ringLng="lng"
          ringMaxRadius="maxR"
          ringPropagationSpeed="speed"
          ringRepeatPeriod="period"
          ringColor={(d: object) => (t: number) => `rgba(${(d as RingDatum).rgb},${Math.pow(1 - t, 1.6) * 0.85})`}
        />
      )}
      {/* soft vignette keeps the UI legible over the globe */}
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_center,transparent_55%,rgba(3,4,6,0.85)_100%)]" />
    </div>
  );
}
