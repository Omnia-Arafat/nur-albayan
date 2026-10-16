"use client";

import Link from "next/link";

import { useApp, useT } from "@/components/app/app-data";
import { Icon } from "@/components/book/icon";
import { Meter, Ribbon, Ring } from "@/components/book/parts";
import { pillVars, tokenVar, Word } from "@/components/book/word";
import { active, openMistakes } from "@/modules/progress/local";
import { useDevice } from "@/modules/progress/store";

import { bookMap, currentPage, isDone } from "./journey";
import { useLesson } from "./use-lesson";

/** Where each node sits across the path, as a share of the free width: the book's zigzag. */
const ZIGZAG = [0, 0.5, 1, 0.5];

export function Home() {
  const { lessons, catalog, locale } = useApp();
  const t = useT();
  const me = active(useDevice());
  const here = currentPage(lessons, me);
  const lesson = useLesson(here?.bookPage ?? null, locale.code);
  const stages = bookMap(lessons);
  const unit = stages.flatMap((s) => s.units).find((u) => u.pages.some((p) => p.bookPage === here?.bookPage));
  const unitDone = unit ? unit.pages.filter((p) => isDone(me, p.bookPage)).length : 0;
  const words = (lesson?.sections ?? []).flatMap((s) => s.items.filter((i) => i.isDrillable)).slice(0, 2);
  const goal = Number(catalog.settings["gamification.dailyGoalLessons"] ?? 1);
  const today = new Date();
  const todayKey = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;
  const readToday = me?.pagesByDay[todayKey] ?? 0;
  const bank = me ? openMistakes(me) : [];

  return (
    <main className="nb-page nb-home">
      <section className="nb-col-main" aria-label={t("home.journey")}>
        {here && (
          <div className="nb-hero nb-anim-rise">
            <div className="nb-hero-tags">
              {here.unitTag && <Ribbon colour="color.purple.deep">{here.unitTag}</Ribbon>}
              {here.lessonTag && <Ribbon colour="color.tag.lesson">{here.lessonTag}</Ribbon>}
            </div>
            <div className="nb-hero-title">
              <span className="nb-hero-kicker">
                {me && Object.keys(me.records).length ? t("home.continue") : t("home.start")}
              </span>
              <h1 lang="ar">{here.title}</h1>
              {here.subtitle && <p>{here.subtitle}</p>}
            </div>
            {words.length > 0 && (
              <div className="nb-hero-words">
                {lesson?.observeTag && <Ribbon colour="color.teal.deep">{lesson.observeTag}</Ribbon>}
                <div className="nb-anim-float nb-word-row">
                  {words.map((w) => (
                    <span
                      key={w.id}
                      className="nb-word"
                      style={{ fontFamily: w.script === "uthmani" ? "var(--nb-font-quran)" : undefined }}
                    >
                      <Word segments={w.segments} />
                    </span>
                  ))}
                </div>
                <span className="nb-hero-note">{t("home.fromPage", { page: here.bookPage })}</span>
              </div>
            )}
            {unit && (
              <div className="nb-hero-progress">
                <span className="nb-hero-page">
                  {t("home.pageOf", {
                    page: here.bookPage,
                    first: unit.pages[0].bookPage,
                    last: unit.pages.at(-1)!.bookPage,
                  })}
                </span>
                <Meter value={unitDone / unit.pages.length} />
              </div>
            )}
            <div className="nb-hero-actions">
              <Link
                href={t.href(`/lesson/${here.bookPage}`)}
                className="nb-cta nb-anim-shine nb-tr-press nb-btn-primary"
              >
                {t("home.read")} <Icon name="next" size={24} />
              </Link>
              {here.drillable > 0 && (
                <Link href={t.href(`/games?page=${here.bookPage}`)} className="nb-btn-secondary">
                  <Icon name="cards" size={28} />
                  {t("home.play")}
                </Link>
              )}
            </div>
          </div>
        )}

        {stages.map((st, si) => {
          const pal = catalog.palette[si % catalog.palette.length] ?? "yellow";
          const pages = st.units.flatMap((u) => u.pages);
          return (
            <section key={st.position} className="nb-stage" style={pillVars(pal)}>
              <div className="nb-spread">
                <div className="nb-row">
                  <Ribbon colour={st.tagToken ?? "color.purple.deep"}>{t.num(st.position)}</Ribbon>
                  <h2 className="nb-stage-title">{st.title}</h2>
                </div>
                <span className="nb-muted">
                  {t("home.lessonsDone", {
                    done: pages.filter((p) => isDone(me, p.bookPage)).length,
                    total: pages.length,
                  })}
                </span>
              </div>
              <ol className="nb-path">
                {st.units.map((u, ui) => {
                  const done = u.pages.every((p) => isDone(me, p.bookPage));
                  const isHere = u === unit;
                  const next = u.pages.find((p) => !isDone(me, p.bookPage)) ?? u.pages[0];
                  const stars = Math.round(
                    u.pages.reduce((n, p) => n + (me?.records[String(p.bookPage)]?.stars ?? 0), 0) / u.pages.length,
                  );
                  const first = u.pages[0].bookPage;
                  const last = u.pages.at(-1)!.bookPage;
                  return (
                    <li
                      key={u.key}
                      className="nb-node-wrap"
                      style={{ "--f": ZIGZAG[ui % ZIGZAG.length] } as React.CSSProperties}
                      data-state={done ? "done" : isHere ? "here" : "open"}
                    >
                      {ui > 0 && <span className="nb-node-link" aria-hidden="true" />}
                      {isHere && <span className="nb-here nb-anim-bob">{t("home.here")}</span>}
                      <span className="nb-node-ring">
                        {isHere && <span className="nb-node-pulse nb-anim-pulse" aria-hidden="true" />}
                        <Link
                          href={t.href(`/lesson/${next.bookPage}`)}
                          className="nb-node nb-anim-pop nb-tr-press"
                          style={{ animationDelay: `${ui * 60}ms` }}
                          aria-label={`${u.title}, ${first === last ? t("home.pages", { first }) : t("home.pagesRange", { first, last })}`}
                        >
                          {done ? <Icon name="check" size={34} tone="lime" /> : <b>{t.num(ui + 1)}</b>}
                        </Link>
                      </span>
                      <span className="nb-node-stars" aria-hidden="true">
                        {[0, 1, 2].map((i) => (
                          <Icon key={i} name="star" size={20} tone={i < stars ? undefined : "yellow"} />
                        ))}
                      </span>
                      <span className="nb-node-title">{u.title}</span>
                      <span className="nb-node-pages">
                        {first === last ? t("home.pages", { first }) : t("home.pagesRange", { first, last })}
                      </span>
                    </li>
                  );
                })}
              </ol>
            </section>
          );
        })}
      </section>

      <aside className="nb-col-side" aria-label={t("home.goal")}>
        <div className="nb-card nb-goal">
          <Ring
            value={Math.min(1, readToday / goal)}
            size={110}
            label=""
            text={`${t.num(Math.min(readToday, goal))}/${t.num(goal)}`}
          />
          <div className="nb-stack">
            <span className="nb-h3">{t("home.goal")}</span>
            <span className="nb-muted">{t("home.goalText", { n: goal })}</span>
            <span className="nb-ok-text">
              {readToday >= goal ? t("home.goalDone") : t("home.goalLeft", { n: goal - readToday })}
            </span>
          </div>
        </div>
        <div className="nb-card">
          <span className="nb-h3">{t("home.badges")}</span>
          <div className="nb-badge-mini">
            {catalog.badges.slice(0, 6).map((b) => {
              const got = me?.badges.includes(b.key);
              return (
                <span
                  key={b.key}
                  className={`nb-badge-chip${got ? "" : " locked"}`}
                  style={pillVars(b.fillTokenKey.split(".")[2])}
                >
                  <span className="big">
                    <Icon name={b.iconKey} size={32} tone={got ? b.fillTokenKey.split(".")[2] : "gray"} />
                  </span>
                  <span>{b.name}</span>
                </span>
              );
            })}
          </div>
        </div>
        <div className="nb-band" style={pillVars("salmon")}>
          <span className="nb-row nb-h3">
            <Icon name="review" size={30} tone="salmon" />
            {t("nav.mistakes")}
          </span>
          <span>{bank.length ? t("home.mistakes", { n: bank.length }) : t("home.mistakesNone")}</span>
          {bank.length > 0 && (
            <Link
              href={t.href("/mistakes")}
              className="nb-btn nb-btn-quiet"
              style={{ color: tokenVar("color.danger") }}
            >
              {t("home.reviewNow")}
            </Link>
          )}
        </div>
      </aside>
    </main>
  );
}
