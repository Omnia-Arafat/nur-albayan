"use client";

import { useEffect } from "react";

import { useSetting } from "@/components/app/sound";
import { active } from "@/modules/progress/local";
import { useDevice } from "@/modules/progress/store";

/** Applies the active profile's display settings to the page (data-colours, data-motion, data-theme on <html>). */
export function DeviceSettings() {
  const settings = active(useDevice())?.settings ?? {};
  const colours = settings.colours !== false;
  const lessMotion = settings.lessMotion === true;
  const theme = useSetting<string>("display.themeMode", "light");
  useEffect(() => {
    const root = document.documentElement;
    root.dataset.colours = colours ? "on" : "off";
    root.dataset.motion = lessMotion ? "less" : "full";
    root.dataset.theme = theme === "dark" || theme === "system" ? theme : "light";
  }, [colours, lessMotion, theme]);
  return null;
}
