"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import type { Crime } from "./crime";

const POLL_MS = 60_000;

export interface Filters {
  category: string;
  severity: string;
  query: string;
}

export function useCrimes(filters: Filters) {
  const [crimes, setCrimes] = useState<Crime[]>([]);
  const [loading, setLoading] = useState(true);
  const [scanning, setScanning] = useState(false);
  const [offline, setOffline] = useState(false);

  // Merge new cases into state while preventing duplicate headlines
  const mergeCrimes = useCallback((incoming: Crime[]) => {
    setCrimes((prev) => {
      const existingTitles = new Set(prev.map((c) => c.title.toLowerCase()));
      const uniqueNew = incoming.filter(
        (c) => !existingTitles.has(c.title.toLowerCase())
      );
      // keep memory + DOM bounded: newest first, 500 max
      return [...uniqueNew, ...prev]
        .sort((a, b) => new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime())
        .slice(0, 500);
    });
  }, []);

  const refresh = useCallback(async () => {
    try {
      const res = await fetch("/api/intel", { cache: "no-store" });
      const json = await res.json();
      if (json.success && Array.isArray(json.crimes)) {
        mergeCrimes(json.crimes);
        setOffline(false);
      } else {
        setOffline(true);
      }
    } catch {
      setOffline(true);
    } finally {
      setLoading(false);
    }
  }, [mergeCrimes]);

  useEffect(() => {
    const first = setTimeout(refresh, 0);
    const id = setInterval(refresh, POLL_MS);
    return () => {
      clearTimeout(first);
      clearInterval(id);
    };
  }, [refresh]);

  const scan = useCallback(async () => {
    setScanning(true);
    try {
      const res = await fetch("/api/intel", { cache: "no-store" });
      const json = await res.json();
      if (json.success && Array.isArray(json.crimes)) {
        mergeCrimes(json.crimes);
        setOffline(false);
      } else {
        setOffline(true);
      }
    } catch {
      setOffline(true);
    } finally {
      setScanning(false);
    }
  }, [mergeCrimes]);

  const { category, severity, query } = filters;

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return crimes.filter(
      (c) =>
        (category === "ALL" || c.category === category) &&
        (severity === "ALL" || c.severity === severity) &&
        (!q ||
          c.title.toLowerCase().includes(q) ||
          c.city.toLowerCase().includes(q) ||
          c.state.toLowerCase().includes(q))
    );
  }, [crimes, category, severity, query]);

  const severityCounts = useMemo(() => {
    const counts = { HIGH: 0, MEDIUM: 0, LOW: 0 };
    for (const c of crimes) counts[c.severity]++;
    return counts;
  }, [crimes]);

  return { crimes, filtered, severityCounts, loading, scanning, offline, scan };
}