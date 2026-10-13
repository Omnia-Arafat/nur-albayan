"use client";

import Link from "next/link";

import { useApp, useT, xpRates } from "@/components/app/app-data";
import { Icon } from "@/components/book/icon";
import { Ribbon, Ring, Tag } from "@/components/book/parts";
import { Pill, pillVars } from "@/components/book/word";
import type { Lesson } from "@/modules/content/service";
import { type CardRead, levelOf, type LocalProfile, streakOf, xpOf } from "@/modules/progress/local";
import type { SessionSummary } from "@/modules/scoring/engine";

export type ResultData = {
  summary: SessionSummary;
  missed: CardRead[];
  newBadges: string[];
  profile: LocalProfile;
  total: number;
};

export function Result({
  lesson,
  data,
  next,
  onAgain,
}: {
  lesson: Lesson;
  data: ResultData;
  next: number | null;
  onAgain: () => void;
}) {
  const { catalog } = useApp();
  const t = useT();
  const { summary, missed, profile } = data;
  const max = Math.max(...(catalog.scoring?.stars ?? []).map((s) => s.stars), 3);
  const xp = catalog.scoring ? xpOf(profile, catalog.scoring, xpRates(catalog)) : 0;
  const { current, next: nextLevel } = levelOf(catalog.levels, xp);
  const badge = catalog.badges.find((b) => data.newBadges.includes(b.key));

  return (
    <main className="nb-page nb-narrow">
      <section className="nb-card nb-anim-rise nb-result">
        <div className="nb-row nb-center">
          {lesson.unitTag && <Ribbon colour="color.purple.deep">{lesson.unitTag}</Ribbon>}
          {lesson.lessonTag && <Ribbon colour="color.tag.lesson">{lesson.lessonTag}</Ribbon>}
        </div>
        <div className="nb-stars" role="img" aria-label={t("result.stars", { n: summary.stars })}>
          {Array.from({ length: max }, (_, k) => (
            <span
              key={k}
              className="nb-anim-pop nb-flex"
              style={{ animationDelay: `${100 + k * 150}ms` }}
              data-mid={k === Math.floor(max / 2) ? "" : undefined}
            >
              <Icon
                name="star"
                size={k === Math.floor(max / 2) ? 84 : 64}
                tone={k < summary.stars ? undefined : "gray"}
              />
            </span>
          ))}
        </div>
        <h1 className="nb-h1 nb-ok-title">
          {t(summary.stars >= 2 ? "result.title" : "result.titleLow", { page: lesson.bookPage })}
        </h1>
        <p className="nb-sub" lang="ar">
          {lesson.title} {lesson.subtitle ? `· ${lesson.subtitle}` : ""}
        </p>
        <div className="nb-summary-stats">
          <Ring value={summary.accuracy} size={140} label={t("result.accuracy")} text={t.pct(summary.accuracy)} />
          <div className="nb-summary-grid">
            <div className="nb-stat-box" style={pillVars("yellow")}>
              <Icon name="star" size={30} />
              <b>+{t.num(summary.score)}</b>
              <span>{t("result.points")}</span>
            </div>
            <div className="nb-stat-box" style={pillVars("lime")}>
              <Icon name="check" size={30} tone="lime" />
              <b>
                {t.num(summary.correct)} / {t.num(data.total)}
              </b>
              <span>{t("result.correct")}</span>
            </div>
            <div className="nb-stat-box" style={pillVars("salmon")}>
              <Icon name="candle" size={30} />
              <b>{t.num(streakOf(profile))}</b>
              <span>{t("result.streak")}</span>
            </div>
            <div className="nb-stat-box" style={pillVars("lavender")}>
              <Icon name="level" size={30} tone="lavender" />
              <b>{t.num(current.position)}</b>
              <span>{current.name}</span>
            </div>
          </div>
        </div>
        {nextLevel && (
          <div className="nb-meter-row">
            <span className="nb-level">{t.num(current.position)}</span>
            <div
              className="nb-meter"
              style={
                {
                  ...pillVars("lime"),
                  "--v": `${Math.round(((xp - current.xpThreshold) / (nextLevel.xpThreshold - current.xpThreshold)) * 100)}%`,
                } as React.CSSProperties
              }
            >
              <span />
            </div>
            <span className="nb-muted">
              {t("result.toLevel", { xp, next: nextLevel.xpThreshold, name: nextLevel.name })}
            </span>
          </div>
        )}
      </section>

      <section className="nb-card nb-anim-rise" style={{ animationDelay: "120ms" }}>
        <div className="nb-spread">
          <h2 className="nb-h2">{t("result.review")}</h2>
          {missed.length > 0 && (
            <Tag palette="salmon">
              <Icon name="box" size={18} tone="salmon" /> {t("result.addedToBank")}
            </Tag>
          )}
        </div>
        {missed.length ? (
          <div className="nb-grid" style={{ "--min": "150px" } as React.CSSProperties}>
            {missed.map((m) => (
              <Pill key={m.itemId} segments={m.segments} palette="pink" size={28} />
            ))}
          </div>
        ) : (
          <p className="nb-muted">{t("result.noMistakes")}</p>
        )}
      </section>

      {badge && (
        <section className="nb-band nb-anim-pop" style={pillVars(badge.fillTokenKey.split(".")[2])}>
          <div className="nb-row">
            <Icon name={badge.iconKey} size={44} tone={badge.fillTokenKey.split(".")[2]} />
            <div>
              <b className="nb-h3">{t("result.newBadge", { name: badge.name })}</b>
              <div className="nb-muted">{badge.description}</div>
            </div>
          </div>
        </section>
      )}

      <div className="nb-row nb-row-btns nb-center">
        {next !== null && (
          <Link href={t.href(`/lesson/${next}`)} className="nb-btn nb-btn-ok nb-anim-shine nb-cta">
            {t("result.next", { page: next })} <Icon name="next" size={22} className="nb-dir-flip" />
          </Link>
        )}
        {missed.length > 0 ? (
          <Link href={t.href("/mistakes")} className="nb-btn nb-btn-soft">
            <Icon name="review" size={24} /> {t("result.reviewWords")}
          </Link>
        ) : (
          <button type="button" className="nb-btn nb-btn-soft" onClick={onAgain}>
            <Icon name="review" size={24} /> {t("result.again")}
          </button>
        )}
        {lesson.sections.some((x) => x.items.some((i) => i.isDrillable)) && (
          <Link href={t.href(`/games?page=${lesson.bookPage}`)} className="nb-btn nb-btn-quiet">
            <Icon name="cards" size={24} /> {t("result.break")}
          </Link>
        )}
      </div>
    </main>
  );
}
