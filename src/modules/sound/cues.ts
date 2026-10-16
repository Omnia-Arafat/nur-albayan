import { z } from "zod";

import soundSeed from "../../../seed/sounds.json";

const cue = z.object({
  wave: z.enum(["sine", "triangle", "square", "sawtooth"]),
  notes: z.array(z.object({ hz: z.number().positive(), ms: z.number().positive() })).min(1),
});
export const soundSet = z.object({
  cues: z.record(z.string(), cue),
  gapMs: z.number().min(0),
  attackMs: z.number().positive(),
  peakGain: z.number().positive().max(1),
});
export type SoundSet = z.infer<typeof soundSet>;
export type CueKey = "correct" | "again" | "finish" | "win" | "draw" | "tap";

/** The app's sounds: short tones drawn on the device (no audio files), described in seed/sounds.json. */
export const sounds = soundSet.parse(soundSeed);

let ctx: AudioContext | null = null;

/** Plays one cue at a volume from 0 to 100. Silent where the browser has no audio. */
export function playCue(set: SoundSet, key: CueKey, volume: number) {
  const c = set.cues[key];
  if (!c || volume <= 0 || typeof window === "undefined" || !("AudioContext" in window)) return;
  ctx ??= new AudioContext();
  if (ctx.state === "suspended") void ctx.resume();
  const peak = set.peakGain * Math.min(1, volume / 100);
  let at = ctx.currentTime;
  for (const n of c.notes) {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = c.wave;
    osc.frequency.value = n.hz;
    gain.gain.setValueAtTime(0, at);
    gain.gain.linearRampToValueAtTime(peak, at + set.attackMs / 1000);
    gain.gain.exponentialRampToValueAtTime(0.0001, at + n.ms / 1000);
    osc.connect(gain).connect(ctx.destination);
    osc.start(at);
    osc.stop(at + n.ms / 1000 + 0.02);
    at += (n.ms + set.gapMs) / 1000;
  }
}
