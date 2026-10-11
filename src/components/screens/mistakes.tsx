"use client";

import { useState } from "react";

import { useApp, useT } from "@/components/app/app-data";
import { Icon } from "@/components/book/icon";
import { Dots, Meter } from "@/components/book/parts";
import { Pill, pillVars, Word } from "@/components/book/word";
import { active, type Mistake, masteredCount, openMistakes, reviewMistake } from "@/modules/progress/local";
import { updateProfile, useDevice } from "@/modules/progress/store";

type Mode = "loop" | "single_pass" | "instant_repeat";
const MODES: { value: Mode; key: string; icon: string }[] = [
  { value: "loop", key: "loop", icon: "review" },
  { value: "single_pass", key: "single", icon: "next" },
  { value: "instant_repeat", key: "instant", icon: "timer" },
];

export function Mistakes() {
  const { catalog, lessons } = useApp();
  const t = useT();
  const me = active(useDevice());
  const rules = catalog.scoring;
  const need = rules?.mastery.consecutiveCorrect ?? 3;
  const [mode, setMode] = useState<Mode>((catalog.settings["lesson.remediationDrillMode"] as Mode) ?? "loop");
  const [queue, setQueue] = useState<Mistake[] | null>(null);
  const [miss, setMiss] = useState<string | null>(null);
  const open = me ? openMistakes(me) : [];
  const byPage = [...new Set(open.map((m) => m.bookPage))].sort((a, b) => a - b);
  const badge = catalog.badges.find((b) => (b.criteria as { type?: string }).type === "words_mastered");
  const target = (badge?.criteria as { count?: number } | undefined)?.count ?? 0;
  const mastered = me ? masteredCount(me) : 0;

  const grade = (result: "correct" | "wrong") => {
    if (!queue?.length || !me || !rules) return;
    const [w, ...rest] = queue;
    updateProfile(me.id, (p) => reviewMistake(p, rules, w.itemId, result));
    if (result === "wrong" && mode === "instant_repeat" && miss !== w.itemId) {
      setMiss(w.itemId);
      return; // the same word again, straight away
    }
    setMiss(null);
    setQueue(result === "wrong" && mode === "loop" ? [...rest, w] : rest);
  };

  if (queue) {
    const w = queue[0];
    return (
      <main className="nb-page nb-narrow">
        <section className="nb-card nb-cards nb-anim-rise">
          {w ? (
            <>
              <span className="nb-muted">{t("mistakes.words", { n: queue.length })}</span>
              <div key={w.itemId + (miss ?? "")} className="nb-bigcard nb-anim-pop" style={pillVars("pink")}>
                <Word segments={w.segments} />
              </div>
              <p className="nb-muted nb-center">{t("lesson.readAloud")}</p>
              <div className="nb-row nb-row-btns nb-center">
                <button type="button" className="nb-btn nb-btn-ok nb-btn-big" onClick={() => grade("correct")}>
                  <Icon name="check" size={26} colours={{ fill: "color.surface", line: "color.surface" }} />{" "}
                  {t("lesson.right")}
                </button>
                <button type="button" className="nb-btn nb-btn-again nb-btn-big" onClick={() => grade("wrong")}>
                  {t("lesson.again")}
                </button>
              </div>
            </>
          ) : (
            <>
              <Icon name="trophy" size={72} />
              <h1 className="nb-h1 nb-ok-title">{t("mistakes.done")}</h1>
              <button type="button" className="nb-btn nb-btn-soft" onClick={() => setQueue(null)}>
                {t("mistakes.title")}
              </button>
            </>
          )}
        </section>
      </main>
    );
  }

  return (
    <main className="nb-page">
      <div className="nb-cols">
        <div className="nb-col-main">
          <section className="nb-card nb-anim-rise">
            <div className="nb-spread">
              <div>
                <h1 className="nb-h1">{t("mistakes.title")}</h1>
                <p className="nb-sub">{t("mistakes.intro", { n: need })}</p>
              </div>
              <span className="nb-hide-phone nb-flex">
                <Icon name="box" size={64} tone="salmon" />
              </span>
            </div>
            <div className="nb-row nb-legend">
              <span className="nb-row">
                <Dots n={0} total={need} label={t("mistakes.new")} />
                <span className="nb-muted">{t("mistakes.new")}</span>
              </span>
              <span className="nb-row">
                <Dots n={need - 1} total={need} label={t("mistakes.close")} />
                <span className="nb-muted">{t("mistakes.close")}</span>
              </span>
              <span className="nb-row">
                <Dots n={need} total={need} label={t("mistakes.mastered")} />
                <span className="nb-muted">{t("mistakes.mastered")}</span>
              </span>
            </div>
            {open.length > 0 && (
              <button type="button" className="nb-btn nb-btn-ok nb-only-phone" onClick={() => setQueue(open)}>
                {t("mistakes.review", { n: open.length })} <Icon name="next" size={22} className="nb-dir-flip" />
              </button>
            )}
          </section>
          {open.length === 0 && (
            <section className="nb-card">
              <p className="nb-muted nb-m0">{t("mistakes.empty")}</p>
            </section>
          )}
          {byPage.map((page) => {
            const l = lessons.find((x) => x.bookPage === page);
            const words = open.filter((m) => m.bookPage === page);
            return (
              <section key={page} className="nb-card nb-anim-rise">
                <div className="nb-spread">
                  <h2 className="nb-h2" lang="ar">
                    {l && <span className="nb-book-text">{l.title}</span>}
                    {l && " · "}
                    {t("lesson.pageTag", { page })}
                  </h2>
                  <span className="nb-muted">{t("mistakes.words", { n: words.length })}</span>
                </div>
                <div className="nb-grid nb-grid-140">
                  {words.map((m) => (
                    <div key={m.itemId} className="nb-mcell">
                      <Pill segments={m.segments} palette="pink" size={26} />
                      <Dots
                        n={m.correctStreak}
                        total={need}
                        label={t("mistakes.mastery", { n: m.correctStreak, total: need })}
                      />
                    </div>
                  ))}
                </div>
              </section>
            );
          })}
        </div>
        <aside className="nb-col-side">
          <section className="nb-card">
            <h2 className="nb-h2">{t("mistakes.start")}</h2>
            <div className="nb-field">
              <span className="nb-label">{t("mistakes.mode")}</span>
              <div className="nb-choice" role="radiogroup" aria-label={t("mistakes.mode")}>
                {MODES.map((m) => (
                  <button
                    key={m.value}
                    type="button"
                    role="radio"
                    aria-checked={mode === m.value}
                    className="nb-tr-state"
                    onClick={() => setMode(m.value)}
                  >
                    <Icon name={m.icon} size={26} tone={mode === m.value ? undefined : "gray"} />
                    <span>
                      <b>{t(`mistakes.${m.key}`)}</b>
                      <span className="nb-muted">{t(`mistakes.${m.key}Hint`)}</span>
                    </span>
                  </button>
                ))}
              </div>
            </div>
            <button
              type="button"
              className="nb-btn nb-btn-ok nb-anim-shine"
              disabled={!open.length}
              onClick={() => setQueue(open)}
            >
              {t("mistakes.review", { n: open.length })} <Icon name="next" size={22} className="nb-dir-flip" />
            </button>
          </section>
          {badge && (
            <section className="nb-card">
              <div className="nb-spread">
                <span className="nb-muted">{t("mistakes.masteredWeek")}</span>
                <b>{t.num(mastered)}</b>
              </div>
              <Meter value={target ? mastered / target : 0} palette="mint" />
              {mastered < target && (
                <span className="nb-muted">{t("mistakes.toBadge", { n: target - mastered, name: badge.name })}</span>
              )}
            </section>
          )}
        </aside>
      </div>
    </main>
  );
}
