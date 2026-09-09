"use client";

import { useSyncExternalStore } from "react";

export interface CompletedRun {
  id: string; // workout id, e.g. w3d2
  week: number;
  day: number;
  completedAt: string; // ISO
  durationSec: number;
}

export interface Settings {
  voice: boolean;
  beeps: boolean;
  countdown: boolean;
  halfway: boolean;
  keepAwake: boolean;
}

export interface Store {
  completed: CompletedRun[];
  settings: Settings;
}

export const DEFAULT_SETTINGS: Settings = {
  voice: true,
  beeps: true,
  countdown: true,
  halfway: true,
  keepAwake: true,
};

const KEY = "c25k:v1";

const EMPTY: Store = { completed: [], settings: DEFAULT_SETTINGS };

let cache: Store | null = null;
const listeners = new Set<() => void>();

function read(): Store {
  if (cache) return cache;
  if (typeof window === "undefined") return EMPTY;
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) {
      cache = EMPTY;
    } else {
      const parsed = JSON.parse(raw) as Partial<Store>;
      cache = {
        completed: Array.isArray(parsed.completed) ? parsed.completed : [],
        settings: { ...DEFAULT_SETTINGS, ...(parsed.settings ?? {}) },
      };
    }
  } catch {
    cache = EMPTY;
  }
  return cache;
}

function write(next: Store) {
  cache = next;
  try {
    localStorage.setItem(KEY, JSON.stringify(next));
  } catch {
    // storage full or unavailable; keep in-memory state
  }
  listeners.forEach((l) => l());
}

function subscribe(l: () => void) {
  listeners.add(l);
  const onStorage = (e: StorageEvent) => {
    if (e.key === KEY) {
      cache = null;
      l();
    }
  };
  window.addEventListener("storage", onStorage);
  return () => {
    listeners.delete(l);
    window.removeEventListener("storage", onStorage);
  };
}

export function useStore(): Store {
  return useSyncExternalStore(subscribe, read, () => EMPTY);
}

export function markComplete(run: CompletedRun) {
  const s = read();
  write({ ...s, completed: [...s.completed.filter((c) => c.id !== run.id), run] });
}

export function unmarkComplete(id: string) {
  const s = read();
  write({ ...s, completed: s.completed.filter((c) => c.id !== id) });
}

export function updateSettings(patch: Partial<Settings>) {
  const s = read();
  write({ ...s, settings: { ...s.settings, ...patch } });
}

export function resetAll() {
  write(EMPTY);
}

export function exportJSON(): string {
  return JSON.stringify(read(), null, 2);
}

export function importJSON(text: string): boolean {
  try {
    const parsed = JSON.parse(text) as Partial<Store>;
    if (!Array.isArray(parsed.completed)) return false;
    write({
      completed: parsed.completed,
      settings: { ...DEFAULT_SETTINGS, ...(parsed.settings ?? {}) },
    });
    return true;
  } catch {
    return false;
  }
}

export function isDone(store: Store, id: string): boolean {
  return store.completed.some((c) => c.id === id);
}

// ---- In-progress session (survives the PWA being killed mid-run) ----

export interface Session {
  workoutId: string;
  startedAt: number;
  pausedAt: number | null;
  pausedTotal: number;
  skipOffset: number;
}

const SESSION_KEY = "c25k:session";

export function loadSession(): Session | null {
  try {
    const raw = localStorage.getItem(SESSION_KEY);
    return raw ? (JSON.parse(raw) as Session) : null;
  } catch {
    return null;
  }
}

export function saveSession(s: Session | null) {
  try {
    if (s) localStorage.setItem(SESSION_KEY, JSON.stringify(s));
    else localStorage.removeItem(SESSION_KEY);
  } catch {
    // ignore
  }
}
