import * as THREE from "three";
import { mesh } from "topojson-client";
import type { Topology } from "topojson-specification";
import countries110m from "world-atlas/countries-110m.json";
import { latLngToVec3 } from "./landDots";

/**
 * Country borders as ONE LineSegments draw call.
 *
 * This replaces react-globe.gl's `polygonsData`, which triangulates and extrudes all ~177
 * countries into separate meshes — even though we only ever showed the outline (caps and sides
 * were transparent). Those meshes also had to be ray-cast on every pointer move, which is
 * what makes phones stutter when you touch the globe.
 */
export function createBorders(radius: number) {
  const topo = countries110m as unknown as Topology;
  const lines = mesh(topo, topo.objects.countries as never) as unknown as { coordinates: number[][][] };

  const pos: number[] = [];
  const a = new THREE.Vector3();
  const b = new THREE.Vector3();
  const r = radius * 1.001;

  for (const line of lines.coordinates) {
    for (let i = 1; i < line.length; i++) {
      const [lng0, lat0] = line[i - 1];
      const [lng1, lat1] = line[i];
      if (Math.abs(lng1 - lng0) > 180) continue; // antimeridian cut
      // subdivide so long 110m-resolution edges follow the sphere instead of cutting through it
      const n = Math.max(1, Math.ceil(Math.max(Math.abs(lng1 - lng0), Math.abs(lat1 - lat0)) / 1.5));
      let pLat = lat0;
      let pLng = lng0;
      for (let k = 1; k <= n; k++) {
        const t = k / n;
        const lat = lat0 + (lat1 - lat0) * t;
        const lng = lng0 + (lng1 - lng0) * t;
        latLngToVec3(pLat, pLng, r, a);
        latLngToVec3(lat, lng, r, b);
        pos.push(a.x, a.y, a.z, b.x, b.y, b.z);
        pLat = lat;
        pLng = lng;
      }
    }
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.BufferAttribute(new Float32Array(pos), 3));
  const material = new THREE.LineBasicMaterial({ color: "#be123c", transparent: true, opacity: 0, depthWrite: false });
  const object = new THREE.LineSegments(geometry, material);
  object.frustumCulled = false;

  return {
    object,
    material,
    dispose: () => {
      geometry.dispose();
      material.dispose();
    },
  };
}
