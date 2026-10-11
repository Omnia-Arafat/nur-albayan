"use client";

import { useEffect } from "react";

import { active } from "@/modules/progress/local";
import { useDevice } from "@/modules/progress/store";

/** Applies the active profile's display settings to the page (data-colours, data-motion on <html>). */
export function DeviceSettings() {
  const settings = active(useDevice())?.settings ?? {};
  const colours = settings.colours !== false;
  const lessMotion = settings.lessMotion === true;
  useEffect(() => {
    const root = document.documentElement;
    root.dataset.colours = colours ? "on" : "off";
    root.dataset.motion = lessMotion ? "less" : "full";
  }, [colours, lessMotion]);
  return null;
}
