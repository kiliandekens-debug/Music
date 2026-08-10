"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

/** État persisté dans localStorage — utilisé pour les filtres et préférences d'affichage. */
export function useLocalState<T>(key: string, initial: T): [T, (value: T | ((prev: T) => T)) => void] {
  const [value, setValue] = useState<T>(initial);
  const loaded = useRef(false);

  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(key);
      if (raw !== null) setValue(JSON.parse(raw) as T);
    } catch {
      // Stockage indisponible (navigation privée) : on garde la valeur initiale.
    }
    loaded.current = true;
  }, [key]);

  const update = useCallback(
    (next: T | ((prev: T) => T)) => {
      setValue((prev) => {
        const resolved = typeof next === "function" ? (next as (p: T) => T)(prev) : next;
        try {
          window.localStorage.setItem(key, JSON.stringify(resolved));
        } catch {
          // ignoré
        }
        return resolved;
      });
    },
    [key],
  );

  return [value, update];
}

export function useMediaQuery(query: string): boolean {
  const [matches, setMatches] = useState(false);
  useEffect(() => {
    const media = window.matchMedia(query);
    setMatches(media.matches);
    const listener = (event: MediaQueryListEvent) => setMatches(event.matches);
    media.addEventListener("change", listener);
    return () => media.removeEventListener("change", listener);
  }, [query]);
  return matches;
}

export function useIsDesktop(): boolean {
  return useMediaQuery("(min-width: 1024px)");
}

export function useDebounced<T>(value: T, delay = 200): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const timer = window.setTimeout(() => setDebounced(value), delay);
    return () => window.clearTimeout(timer);
  }, [value, delay]);
  return debounced;
}

/** Compteur de secondes écoulées depuis un instant donné, mis à jour chaque seconde. */
export function useElapsedSeconds(startedAt: string | null, running: boolean): number {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!running || !startedAt) return;
    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, [running, startedAt]);

  return useMemo(() => {
    if (!startedAt) return 0;
    const start = new Date(startedAt).getTime();
    return Math.max(0, Math.floor((now - start) / 1000));
  }, [now, startedAt]);
}

/** Rend visible une liste longue par tranches, sans dépendance de virtualisation. */
export function useProgressiveList<T>(items: T[], step = 40): [T[], boolean, () => void] {
  const [count, setCount] = useState(step);
  useEffect(() => {
    setCount(step);
  }, [items.length, step]);
  const visible = useMemo(() => items.slice(0, count), [items, count]);
  const hasMore = count < items.length;
  const showMore = useCallback(() => setCount((c) => c + step), [step]);
  return [visible, hasMore, showMore];
}
