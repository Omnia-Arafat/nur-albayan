"use client";

import { useCallback } from "react";

import { useApp } from "@/components/app/app-data";
import { active } from "@/modules/progress/local";
import { useDevice } from "@/modules/progress/store";
import { type CueKey, playCue, sounds } from "@/modules/sound/cues";

/** A setting as the learner sees it: their own choice on this device, else the platform's. */
export function useSetting<T>(key: string, fallback: T): T {
  const { catalog } = useApp();
  const mine = active(useDevice())?.settings ?? {};
  return (mine[key] ?? catalog.settings[key] ?? fallback) as T;
}

/** play("correct") etc., honouring the sound on/off and volume settings. */
export function useSound() {
  const on = useSetting<boolean>("sound.enabled", true) !== false;
  const volume = Number(useSetting("sound.volume", 80));
  return useCallback((key: CueKey) => on && playCue(sounds, key, volume), [on, volume]);
}
