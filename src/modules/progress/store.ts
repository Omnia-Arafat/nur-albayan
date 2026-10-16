"use client";

import { DEVICE_KEY } from "./keys";
import { useSyncExternalStore } from "react";

import { type DeviceState, deviceState, emptyState, type LocalProfile } from "./local";

const KEY = DEVICE_KEY;
const listeners = new Set<() => void>();
let cache: DeviceState | null = null;

function read(): DeviceState {
  if (cache) return cache;
  try {
    const raw = window.localStorage.getItem(KEY);
    const parsed = raw ? deviceState.safeParse(JSON.parse(raw)) : null;
    cache = parsed?.success ? parsed.data : emptyState;
  } catch {
    cache = emptyState;
  }
  return cache;
}

export function writeDevice(next: DeviceState) {
  cache = next;
  try {
    window.localStorage.setItem(KEY, JSON.stringify(next));
  } catch {
    // Private mode or full storage: progress still works for this visit.
  }
  listeners.forEach((l) => l());
}

export function updateProfile(id: string, fn: (p: LocalProfile) => LocalProfile) {
  const s = read();
  writeDevice({ ...s, profiles: s.profiles.map((p) => (p.id === id ? fn(p) : p)) });
}

const subscribe = (l: () => void) => {
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
};

/** The device's profiles. Server render and first paint see the empty state; the browser fills it in. */
export const useDevice = () => useSyncExternalStore(subscribe, read, () => emptyState);
