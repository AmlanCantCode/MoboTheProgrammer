import * as THREE from "three";
import { feature } from "topojson-client";
import type { Topology } from "topojson-specification";
import countries110m from "world-atlas/countries-110m.json";

/**
 * Dot-matrix landmasses, built without H3.
 * (react-globe.gl's hexPolygons throws inside h3-js on some country polygons, which
 *  aborts the loop and leaves most of the world undrawn.)
 *
 * 1. Rasterise the world's land into an equirectangular mask.
 * 2. Lay an even Fibonacci lattice over the sphere and keep points that land on the mask.
 * 3. Render as one Points draw call with a shader that adds a reveal wave and a radar sweep.
 */

const DEG = Math.PI / 180;
const MASK_W = 2048;
const MASK_H = 1024;

type Ring = number[][];
interface Geom {
  type: string;
  coordinates: Ring[] | Ring[][];
}

function buildMask(): Uint8ClampedArray {
  const topo = countries110m as unknown as Topology;
  const land = feature(topo, topo.objects.land as never) as unknown as {
    features?: { geometry: Geom }[];
    geometry?: Geom;
  };
  const geoms: Geom[] = land.features ? land.features.map((f) => f.geometry) : [land.geometry!];

  const c = document.createElement("canvas");
  c.width = MASK_W;
  c.height = MASK_H;
  const ctx = c.getContext("2d", { willReadFrequently: true })!;
  ctx.fillStyle = "#000";
  ctx.fillRect(0, 0, MASK_W, MASK_H);
  ctx.fillStyle = "#fff";

  const trace = (rings: Ring[]) => {
    for (const ring of rings) {
      ring.forEach(([lng, lat], i) => {
        const x = ((lng + 180) / 360) * MASK_W;
        const y = ((90 - lat) / 180) * MASK_H;
        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      });
      ctx.closePath();
    }
  };

  ctx.beginPath();
  for (const g of geoms) {
    if (g.type === "Polygon") trace(g.coordinates as Ring[]);
    else if (g.type === "MultiPolygon") (g.coordinates as Ring[][]).forEach(trace);
  }
  ctx.fill("evenodd"); // evenodd keeps lakes / inland seas as holes
  return ctx.getImageData(0, 0, MASK_W, MASK_H).data;
}

const VERT = /* glsl */ `
  uniform float uTime, uReveal, uPx;
  uniform vec3 uOrigin;           // reveal / sweep origin on the unit sphere
  attribute float aSeed;
  varying float vAlpha, vGlow;

  void main() {
    vec3 n = normalize(position);
    float ang = acos(clamp(dot(n, uOrigin), -1.0, 1.0));      // 0..PI from India

    // reveal: a ring of light expands from India across the globe
    float front = uReveal * 3.4;
    float shown = smoothstep(front, front - 0.35, ang);
    float edge = smoothstep(0.0, 0.3, front - ang) * smoothstep(0.55, 0.0, front - ang);

    // repeating radar sweep once revealed
    float sweepPos = mod(uTime * 0.38, 4.2);
    float sweep = smoothstep(0.16, 0.0, abs(ang - sweepPos)) * step(3.4, front);

    float twinkle = 0.82 + 0.18 * sin(uTime * 1.4 + aSeed * 40.0);
    vGlow = clamp(edge * 1.2 + sweep, 0.0, 1.0);
    vAlpha = shown * twinkle;

    vec4 mv = modelViewMatrix * vec4(position, 1.0);
    gl_Position = projectionMatrix * mv;
    gl_PointSize = (1.15 + vGlow * 1.6 + aSeed * 0.4) * uPx * (260.0 / -mv.z);
  }`;

const FRAG = /* glsl */ `
  varying float vAlpha, vGlow;
  void main() {
    float r = length(gl_PointCoord - 0.5);
    if (r > 0.5) discard;
    vec3 base = vec3(0.85, 0.86, 0.9);
    vec3 hot = vec3(1.0, 0.35, 0.5);
    vec3 col = mix(base, hot, vGlow);
    gl_FragColor = vec4(col, vAlpha * mix(0.55, 1.0, vGlow) * smoothstep(0.5, 0.2, r));
  }`;

export interface LandDots {
  points: THREE.Points;
  uniforms: {
    uTime: { value: number };
    uReveal: { value: number };
    uPx: { value: number };
    uOrigin: { value: THREE.Vector3 };
  };
  dispose: () => void;
}

/** Same lat/lng → xyz mapping three-globe uses, so dots line up with pins. */
export function latLngToVec3(lat: number, lng: number, r: number, out = new THREE.Vector3()) {
  const phi = (90 - lat) * DEG;
  const theta = (90 - lng) * DEG;
  return out.set(r * Math.sin(phi) * Math.cos(theta), r * Math.cos(phi), r * Math.sin(phi) * Math.sin(theta));
}

export function createLandDots(radius: number, origin: { lat: number; lng: number }, count = 56000): LandDots {
  const mask = buildMask();
  const golden = Math.PI * (3 - Math.sqrt(5));
  const pos: number[] = [];
  const seed: number[] = [];
  const v = new THREE.Vector3();

  for (let i = 0; i < count; i++) {
    const lat = Math.asin(1 - (2 * (i + 0.5)) / count) / DEG;
    const lng = ((((i * golden) / DEG) % 360) + 540) % 360 - 180;
    const px = Math.min(MASK_W - 1, Math.floor(((lng + 180) / 360) * MASK_W));
    const py = Math.min(MASK_H - 1, Math.floor(((90 - lat) / 180) * MASK_H));
    if (mask[(py * MASK_W + px) * 4] < 128) continue;
    latLngToVec3(lat, lng, radius * 1.002, v);
    pos.push(v.x, v.y, v.z);
    seed.push(Math.random());
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.BufferAttribute(new Float32Array(pos), 3));
  geometry.setAttribute("aSeed", new THREE.BufferAttribute(new Float32Array(seed), 1));

  const uniforms = {
    uTime: { value: 0 },
    uReveal: { value: 0 },
    uPx: { value: Math.min(window.devicePixelRatio || 1, 2) },
    uOrigin: { value: latLngToVec3(origin.lat, origin.lng, 1).normalize() },
  };
  const material = new THREE.ShaderMaterial({
    uniforms,
    vertexShader: VERT,
    fragmentShader: FRAG,
    transparent: true,
    depthWrite: false,
  });
  const points = new THREE.Points(geometry, material);
  points.frustumCulled = false;

  return {
    points,
    uniforms,
    dispose: () => {
      geometry.dispose();
      material.dispose();
    },
  };
}
