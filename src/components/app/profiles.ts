"use client";

import { type DeviceState, type LocalProfile, newProfile } from "@/modules/progress/local";
import { writeDevice } from "@/modules/progress/store";

import type { AppData } from "./app-data";

type Catalog = AppData["catalog"];

/** A fresh device profile with the first letter avatar and the first colour, made active. */
export function addProfile(
  state: DeviceState,
  catalog: Catalog,
  name: string,
  avatar?: LocalProfile["avatar"],
  colour?: string,
) {
  const letter = catalog.avatars.find((a) => a.kind === "letter");
  const me = newProfile(
    crypto.randomUUID(),
    name,
    avatar ?? { kind: "letter", value: letter?.value ?? "" },
    colour ?? catalog.avatarColors[0] ?? "color.blue",
  );
  writeDevice({ ...state, profiles: [...state.profiles, me], activeId: me.id });
  return me;
}

/** The active profile, or a new one when this device has none yet (no account is ever needed). */
export function ensureProfile(state: DeviceState, catalog: Catalog, name: string) {
  return state.profiles.find((p) => p.id === state.activeId) ?? state.profiles[0] ?? addProfile(state, catalog, name);
}
