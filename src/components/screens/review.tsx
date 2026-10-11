"use client";

import Link from "next/link";

import { useApp, useT } from "@/components/app/app-data";
import { Icon } from "@/components/book/icon";
import { pillVars } from "@/components/book/word";
import { active, openMistakes } from "@/modules/progress/local";
import { useDevice } from "@/modules/progress/store";

/** Pages the learner has read, weakest first, plus the way into the mistake bank. */
export function Review() {
  const { catalog, lessons } = useApp();
  const t = useT();
  const me = active(useDevice());
  const most = Math.max(0, ...(catalog.scoring?.stars ?? []).map((s) => s.stars));
  const read = lessons
    .map((l) => ({ l, r: me?.records[String(l.bookPage)] }))
    .filter((x) => x.r && x.r.completedCount > 0)
    .sort((a, b) => a.r!.stars - b.r!.stars || a.l.bookPage - b.l.bookPage);
  const open = me ? openMistakes(me).length : 0;
  const allTop = read.length > 0 && read.every((x) => x.r!.stars >= most);

  return (
    <main className="nb-page">
      <section className="nb-card nb-anim-rise">
        <h1 className="nb-h1">{t("review.title")}</h1>
        <p className="nb-sub">{t("review.intro")}</p>
        {!read.length && <p className="nb-muted nb-m0">{t("review.empty")}</p>}
        {allTop && <p className="nb-muted nb-m0">{t("review.allStars")}</p>}
        <ul className="nb-plain nb-review-list">
          {read.map(({ l, r }) => (
            <li key={l.slug}>
              <Link href={t.href(`/lesson/${l.bookPage}`)} className="nb-review-row nb-tr-press">
                <span className="nb-review-page" style={pillVars(r!.stars >= most ? "lime" : "peach")}>
                  {t.num(l.bookPage)}
                </span>
                <span className="nb-review-text">
                  <b className="nb-book-text" lang="ar">
                    {l.title}
                  </b>
                  <span className="nb-muted nb-small">
                    {t("review.page", { page: t.num(l.bookPage) })} ·{" "}
                    {t("review.times", { n: t.num(r!.completedCount) })}
                  </span>
                </span>
                <span className="nb-review-stars" aria-label={`${t.num(r!.stars)} / ${t.num(most)}`}>
                  {Array.from({ length: most }, (_, i) => (
                    <Icon key={i} name="star" size={20} tone={i < r!.stars ? undefined : "yellow"} />
                  ))}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      </section>
      {open > 0 && (
        <section className="nb-band nb-band-row nb-anim-rise" style={pillVars("salmon")}>
          <Icon name="box" size={40} tone="salmon" />
          <div className="nb-grow">
            <b>{t("review.bank")}</b>
            <div className="nb-muted">{t("review.bankText", { n: t.num(open) })}</div>
          </div>
          <Link href={t.href("/mistakes")} className="nb-btn nb-btn-ok">
            {t("review.toBank")}
          </Link>
        </section>
      )}
    </main>
  );
}
