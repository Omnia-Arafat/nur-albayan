"use client";

import Link from "next/link";
import { useMemo, useState } from "react";

import { useApp, useT } from "@/components/app/app-data";
import { ensureProfile } from "@/components/app/profiles";
import { Seg } from "@/components/book/controls";
import { Icon } from "@/components/book/icon";
import { Meter, Tag } from "@/components/book/parts";
import { Pill, pillVars } from "@/components/book/word";
import { active, earnedBadges, openMistakes } from "@/modules/progress/local";
import { updateProfile, useDevice } from "@/modules/progress/store";
import { pointsFor } from "@/modules/scoring/engine";

import { useLesson } from "./use-lesson";

type Word = { id: string; segments: { text: string; role: string }[]; script: "naskh" | "uthmani"; cardType: string };

/** A shuffle that stays the same for one round (seeded by the round number). */
const shuffled = <T,>(xs: T[], seed: number) =>
  xs
    .map((x, i) => ({ x, k: Math.sin(seed * 9973 + i * 7919) }))
    .sort((a, b) => a.k - b.k)
    .map((v) => v.x);

export function Ladder({ from }: { from: string }) {
  const { catalog, locale } = useApp();
  const t = useT();
  const device = useDevice();
  const me = active(device);
  const game = catalog.games.find((g) => g.key === "ladder");
  const cfg = (game?.defaultConfig ?? {}) as { rungOptions?: number[]; defaultRungs?: number };
  const [rungs, setRungs] = useState(cfg.defaultRungs ?? 5);
  const [round, setRound] = useState(1);
  const lesson = useLesson(from === "bank" ? null : Number(from), locale.code);
  const pool: Word[] = useMemo(() => {
    if (from === "bank")
      return me
        ? openMistakes(me).map((m) => ({
            id: m.itemId,
            segments: m.segments,
            script: "naskh" as const,
            cardType: "normal",
          }))
        : [];
    return (lesson?.sections ?? []).flatMap((s) =>
      s.items
        .filter((i) => i.isDrillable)
        .map((i) => ({ id: i.id, segments: i.segments, script: i.script, cardType: i.cardType })),
    );
  }, [from, lesson, me]);
  const words = useMemo(() => shuffled(pool, round).slice(0, rungs), [pool, round, rungs]);
  // A new set of words starts a new climb (state reset during render, not in an effect).
  const key = `${rungs}:${words.map((w) => w.id).join(",")}`;
  const fresh = () => ({ key, queue: words, climbed: [] as Word[], points: 0, tries: 0 });
  const [run, setRun] = useState(fresh);
  if (run.key !== key) setRun(fresh());
  const { queue, climbed, points, tries } = run.key === key ? run : fresh();
  const rules = catalog.scoring;
  const atPeak = words.length > 0 && climbed.length === words.length;
  const pal = game?.fillTokenKey.split(".")[2] ?? "peach";

  const grade = (result: "correct" | "wrong") => {
    if (!rules || !queue.length) return;
    const reachedPeak = result === "correct" && climbed.length + 1 === words.length;
    const gained = pointsFor(rules, { surface: "ladder", cardTypeKey: queue[0].cardType, result, reachedPeak });
    const [head, ...rest] = queue;
    setRun({
      key,
      tries: tries + 1,
      points: points + gained,
      queue: result === "wrong" ? [...rest, head] : rest,
      climbed: result === "wrong" ? climbed : [...climbed, head],
    });
    if (gained || reachedPeak) {
      updateProfile(ensureProfile(device, catalog, t("profile.defaultName")).id, (p) => {
        const next = { ...p, gamePoints: p.gamePoints + gained, peaks: p.peaks + (reachedPeak ? 1 : 0) };
        return { ...next, badges: [...new Set([...p.badges, ...earnedBadges(next, catalog.badges)])] };
      });
    }
  };

  const steps = words.map((w, k) => ({
    w: k < climbed.length ? climbed[k] : k === climbed.length ? queue[0] : null,
    k,
  }));
  const peakBadge = catalog.badges.find((b) => (b.criteria as { type?: string }).type === "ladder_peaks");

  return (
    <main className="nb-page nb-narrow-wide">
      <div className="nb-spread">
        <Link href={t.href(`/games?page=${from === "bank" ? "" : from}`)} className="nb-btn nb-btn-quiet">
          <Icon name="next" size={20} tone="lavender" className="nb-flip nb-dir-flip" /> {t("nav.games")}
        </Link>
        <div className="nb-row">
          <Tag palette={pal}>
            <Icon name="ladder" size={18} tone={pal} /> {game?.name}
          </Tag>
          {cfg.rungOptions && (
            <Seg
              label={t("ladder.rung")}
              value={String(rungs)}
              onChange={(v) => setRungs(Number(v))}
              options={cfg.rungOptions.map((n) => ({ value: String(n), label: t("ladder.rungs", { n }) }))}
            />
          )}
        </div>
      </div>
      <div className="nb-cols">
        <section className="nb-card nb-col-main nb-anim-rise nb-ladder-card">
          <div className={`nb-ladder-top${atPeak ? " nb-anim-pop" : ""}`}>
            <Icon name="crown" size={48} />
            <b>{atPeak ? t("ladder.peak") : t("ladder.top")}</b>
          </div>
          <div className="nb-ladder" style={pillVars(pal)}>
            {[...steps].reverse().map(({ w, k }) => {
              const state = k < climbed.length ? "done" : k === climbed.length ? "here" : "next";
              return (
                <div key={k} className={`nb-rung ${state}${state === "here" ? " nb-anim-pop" : ""}`}>
                  <span className="nb-rung-no">
                    {state === "done" ? <Icon name="check" size={22} tone="lime" /> : <b>{t.num(k + 1)}</b>}
                  </span>
                  {w ? (
                    <Pill
                      segments={w.segments}
                      script={w.script}
                      palette={state === "done" ? "lime" : state === "here" ? "yellow" : "gray"}
                      size={state === "here" ? 30 : 26}
                    />
                  ) : (
                    <span className="nb-pill nb-rung-blank" style={pillVars("gray")} aria-hidden="true" />
                  )}
                </div>
              );
            })}
          </div>
          <p className="nb-muted nb-center nb-m0">{t("ladder.howTo")}</p>
          {atPeak ? (
            <div className="nb-row nb-row-btns nb-center">
              <button type="button" className="nb-btn nb-btn-ok nb-btn-big" onClick={() => setRound(round + 1)}>
                {t("ladder.again")}
              </button>
            </div>
          ) : (
            <div className="nb-row nb-row-btns nb-center">
              <button
                type="button"
                className="nb-btn nb-btn-ok nb-btn-big"
                disabled={!queue.length}
                onClick={() => grade("correct")}
              >
                <Icon name="check" size={24} colours={{ fill: "color.surface", line: "color.surface" }} />{" "}
                {t("lesson.right")}
              </button>
              <button
                type="button"
                className="nb-btn nb-btn-again nb-btn-big"
                disabled={!queue.length}
                onClick={() => grade("wrong")}
              >
                {t("lesson.again")}
              </button>
            </div>
          )}
        </section>
        <aside className="nb-col-side">
          <section className="nb-card">
            <h2 className="nb-h2">{t("ladder.round")}</h2>
            <div className="nb-spread">
              <span className="nb-muted">{t("ladder.rung")}</span>
              <b>{t("ladder.of", { n: climbed.length, total: words.length })}</b>
            </div>
            <Meter value={words.length ? climbed.length / words.length : 0} palette={pal} />
            <div className="nb-spread">
              <span className="nb-muted">{t("ladder.points")}</span>
              <b>{t.num(points)}</b>
            </div>
            <div className="nb-spread">
              <span className="nb-muted">{t("ladder.tries")}</span>
              <b>{t.num(tries)}</b>
            </div>
          </section>
          {peakBadge && (
            <section className="nb-band nb-band-row" style={pillVars(peakBadge.fillTokenKey.split(".")[2])}>
              <Icon name={peakBadge.iconKey} size={40} tone={peakBadge.fillTokenKey.split(".")[2]} />
              <div>
                <b>{peakBadge.name}</b>
                <div className="nb-muted">{peakBadge.description}</div>
              </div>
            </section>
          )}
        </aside>
      </div>
    </main>
  );
}
