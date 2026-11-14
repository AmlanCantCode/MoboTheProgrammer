// client/app/components/TacticalMap.jsx
"use client";

import React, { useEffect, useRef, useState, useMemo } from "react";
import dynamic from "next/dynamic";
import * as THREE from "three";
import { feature } from "topojson-client";
import countries110m from "world-atlas/countries-110m.json";
import { X, ExternalLink, MapPin, ShieldAlert } from "lucide-react";

const Globe = dynamic(() => import("react-globe.gl"), { ssr: false });

export default function TacticalMap({ crimes, selectedCrime, onSelectCrime }) {
  const globeEl = useRef();
  const containerRef = useRef();
  const isDraggingRef = useRef(false);
  const [isMounted, setIsMounted] = useState(false);
  const [dimensions, setDimensions] = useState({ width: 800, height: 600 });

  const landPolygons = useMemo(() => {
    const geo = feature(countries110m, countries110m.objects.countries);
    return geo.features;
  }, []);

  const globeMaterial = useMemo(() => {
    return new THREE.MeshBasicMaterial({ color: new THREE.Color("#030406") });
  }, []);

  useEffect(() => {
    setIsMounted(true);
    const updateSize = () => {
      if (containerRef.current) {
        setDimensions({
          width: containerRef.current.offsetWidth,
          height: containerRef.current.offsetHeight,
        });
      }
    };
    updateSize();
    window.addEventListener("resize", updateSize);
    return () => window.removeEventListener("resize", updateSize);
  }, []);

  const handleGlobeReady = () => {
    if (globeEl.current) {
      globeEl.current.pointOfView({ lat: 22.5937, lng: 78.9629, altitude: 1.75 }, 800);
    }
  };

  useEffect(() => {
    if (globeEl.current && selectedCrime) {
      globeEl.current.pointOfView(
        { lat: selectedCrime.lat, lng: selectedCrime.lng, altitude: 1.35 },
        1000
      );
    }
  }, [selectedCrime]);

  const handlePointerDown = () => {
    isDraggingRef.current = false;
  };
  const handlePointerMove = () => {
    isDraggingRef.current = true;
  };
  const handlePointerUp = () => {
    if (isDraggingRef.current && globeEl.current) {
      globeEl.current.pointOfView({ lat: 22.5937, lng: 78.9629, altitude: 1.75 }, 1400);
    }
    isDraggingRef.current = false;
  };

  const pointsData = useMemo(() => {
    return crimes.map((crime) => ({
      ...crime,
      color:
        crime.severity === "HIGH"
          ? "#be123c" // Deep Maroon / Rose-700
          : crime.severity === "MEDIUM"
          ? "#e2e8f0" // Crisp White
          : "#64748b", // Slate Grey
      radius: crime.severity === "HIGH" ? 0.55 : 0.42,
    }));
  }, [crimes]);

  const ringsData = useMemo(() => {
    return crimes
      .filter((c) => c.severity === "HIGH")
      .map((crime) => ({
        lat: crime.lat,
        lng: crime.lng,
        maxR: 3.5,
        propagationSpeed: 1.8,
        repeatPeriod: 1400,
      }));
  }, [crimes]);

  if (!isMounted) {
    return (
      <div className="w-full h-full bg-[#030406] flex items-center justify-center text-slate-500 font-mono text-xs tracking-widest animate-pulse">
        CALIBRATING MAROON/BLACK GRID...
      </div>
    );
  }

  return (
    <div
      ref={containerRef}
      className="w-full h-full relative bg-[#030406] overflow-hidden select-none cursor-grab active:cursor-grabbing"
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
    >
      <Globe
        ref={globeEl}
        width={dimensions.width}
        height={dimensions.height}
        backgroundColor="#030406"
        globeMaterial={globeMaterial}
        onGlobeReady={handleGlobeReady}
        showAtmosphere={true}
        atmosphereColor="#831843"
        atmosphereAltitude={0.15}
        hexPolygonsData={landPolygons}
        hexPolygonResolution={4}
        hexPolygonMargin={0.2}
        hexPolygonUseDots={true}
        hexPolygonColor={() => "rgba(255, 255, 255, 0.8)"}
        polygonsData={landPolygons}
        polygonCapColor={() => "transparent"}
        polygonSideColor={() => "rgba(131, 24, 67, 0.12)"}
        polygonStrokeColor={() => "rgba(131, 24, 67, 0.45)"}
        pointsData={pointsData}
        pointLat={(d) => d.lat}
        pointLng={(d) => d.lng}
        pointColor={(d) => d.color}
        pointAltitude={0.025}
        pointRadius={(d) => d.radius}
        pointsMerge={false}
        pointLabel={(d) => `
          <div style="background:#05070c;border:1px solid #831843;padding:6px 10px;border-radius:4px;font-family:monospace;color:#f8fafc;font-size:11px;max-width:240px;">
            <div style="color:${d.color};font-weight:bold;">[${d.severity}] ${d.city}</div>
            <div style="margin-top:2px;">${d.title}</div>
          </div>
        `}
        onPointClick={(point) => {
          isDraggingRef.current = false;
          onSelectCrime(point);
        }}
        ringsData={ringsData}
        ringLat={(d) => d.lat}
        ringLng={(d) => d.lng}
        ringColor={() => (t) => `rgba(190, 18, 60, ${1 - t})`}
        ringMaxRadius="maxR"
        ringPropagationSpeed="propagationSpeed"
        ringRepeatPeriod="repeatPeriod"
      />

      {/* Intel Dossier HUD Card */}
      {selectedCrime && (
        <div
          onPointerDown={(e) => e.stopPropagation()}
          onPointerUp={(e) => e.stopPropagation()}
          className="absolute bottom-6 right-6 z-20 w-80 md:w-96 bg-[#05070c]/95 backdrop-blur-md border border-[#831843] rounded-lg p-4 shadow-2xl shadow-black font-mono text-slate-100"
        >
          <div className="flex items-start justify-between gap-2 border-b border-slate-800 pb-2.5">
            <div className="flex items-center gap-2">
              <ShieldAlert
                className={`w-4 h-4 shrink-0 ${
                  selectedCrime.severity === "HIGH"
                    ? "text-rose-600"
                    : "text-white"
                }`}
              />
              <span
                className={`text-[10px] px-2 py-0.5 rounded font-bold uppercase ${
                  selectedCrime.severity === "HIGH"
                    ? "bg-[#4c0519] text-rose-200 border border-[#831843]"
                    : "bg-slate-800 text-white border border-slate-700"
                }`}
              >
                {selectedCrime.severity} • {selectedCrime.category}
              </span>
            </div>
            <button
              onClick={() => onSelectCrime(null)}
              className="text-slate-400 hover:text-white p-0.5 rounded transition cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          <div className="mt-3 space-y-2">
            <div className="flex items-center justify-between text-[11px] text-slate-400">
              <span className="flex items-center gap-1 text-slate-200 font-semibold">
                <MapPin className="w-3.5 h-3.5 text-rose-500" />
                {selectedCrime.city}, {selectedCrime.state}
              </span>
              <span>
                {selectedCrime.lat.toFixed(2)}°N, {selectedCrime.lng.toFixed(2)}°E
              </span>
            </div>
            <h3 className="text-xs font-bold text-white leading-relaxed">
              {selectedCrime.title}
            </h3>
            {selectedCrime.summary && (
              <p className="text-[11px] text-slate-400 leading-relaxed">
                {selectedCrime.summary}
              </p>
            )}
            <div className="pt-2 border-t border-slate-800/80 flex items-center justify-between text-[11px]">
              <span className="text-slate-500 truncate max-w-[160px]">
                SRC: {selectedCrime.source}
              </span>
              {selectedCrime.link && (
                <a
                  href={selectedCrime.link}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-1 text-rose-400 hover:text-rose-300 font-bold"
                >
                  READ REPORT <ExternalLink className="w-3 h-3" />
                </a>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}