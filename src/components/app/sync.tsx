"use client";

import { useEffect, useRef, useState } from "react";

import {
  active,
  type DeviceState,
  type LocalProfile,
  linkedTo,
  localProfile,
  mergeRemote,
  progressKey,
} from "@/modules/progress/local";
import { updateProfile, useDevice, writeDevice } from "@/modules/progress/store";

/** How long after the last change the profile is saved, so a lesson's reads go up together. */
const SAVE_AFTER_MS = 2500;

type Snapshot = { studentId: string | null; profile: LocalProfile | null };

async function snapshot(): Promise<Snapshot | null> {
  const r = await fetch("/api/v1/me/progress", { cache: "no-store" }).catch(() => null);
  if (!r?.ok) return null;
  const d = (await r.json()) as { studentId: string | null; profile: unknown };
  const parsed = d.profile ? localProfile.safeParse(d.profile) : null;
  return { studentId: d.studentId, profile: parsed?.success ? parsed.data : null };
}

async function upload(p: LocalProfile): Promise<string | null> {
  const r = await fetch("/api/v1/me/progress", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(p),
    keepalive: true,
  }).catch(() => null);
  if (!r?.ok) return null;
  return ((await r.json()) as { studentId: string }).studentId;
}

/** Records on the profile that the account now holds what was sent. */
const markSaved = (id: string, sent: LocalProfile, studentId: string) =>
  updateProfile(id, (q) => ({ ...q, link: linkedTo(sent, studentId).link }));

/**
 * Brings the account's progress into a device profile and saves the result back: the first time a
 * learner keeps a profile in an account, and on each visit after that. False when signed out or when
 * the profile belongs to another account.
 */
export async function syncProfile(p: LocalProfile): Promise<boolean> {
  const remote = await snapshot();
  if (!remote) return false;
  if (p.link && remote.studentId && p.link.studentId !== remote.studentId) return false;
  const merged = remote.profile ? mergeRemote(p, remote.profile) : p;
  updateProfile(p.id, (q) => ({ ...merged, settings: q.settings }));
  const studentId = await upload(merged);
  if (!studentId) return false;
  markSaved(p.id, merged, studentId);
  return true;
}

/** A new device profile made from the account's progress, for a learner signing in on a new device. */
export async function bringToDevice(state: DeviceState): Promise<boolean> {
  const remote = await snapshot();
  if (!remote?.studentId || !remote.profile) return false;
  const p = linkedTo({ ...remote.profile, id: crypto.randomUUID() }, remote.studentId);
  writeDevice({ ...state, profiles: [...state.profiles, p], activeId: p.id });
  return true;
}

/**
 * Keeps a linked profile saved in its account while the learner reads: once on each visit (which also
 * brings in what a teacher graded), then a moment after every change. Renders nothing.
 */
export function ProgressSync() {
  const me = active(useDevice());
  const key = me?.link ? progressKey(me) : null;
  const owner = useRef<{ profile: string; ok: boolean } | null>(null);
  // Bumped when the connection comes back, so a save that failed offline is sent again.
  const [back, setBack] = useState(0);
  useEffect(() => {
    const on = () => setBack((n) => n + 1);
    window.addEventListener("online", on);
    return () => window.removeEventListener("online", on);
  }, []);

  useEffect(() => {
    if (!me?.link || owner.current?.profile === me.id) return;
    owner.current = { profile: me.id, ok: false };
    void syncProfile(me).then((ok) => {
      if (owner.current?.profile === me.id) owner.current.ok = ok;
    });
  }, [me]);

  useEffect(() => {
    if (!key || !me?.link || !owner.current || owner.current.profile !== me.id) return;
    if (!owner.current.ok) {
      // The visit's first sync failed (offline, say): try it again once the connection is back.
      if (back === 0) return;
      const mine = owner.current;
      void syncProfile(me).then((ok) => {
        mine.ok = ok;
      });
      return;
    }
    const studentId = me.link.studentId;
    const timer = setTimeout(() => {
      void upload(me).then((id) => {
        if (id === studentId) markSaved(me.id, me, id);
      });
    }, SAVE_AFTER_MS);
    return () => clearTimeout(timer);
    // Save when the progress changes, not when only the sync bookkeeping does.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, back]);

  return null;
}
