"use client";

import Link from "next/link";
import { useState } from "react";

import { useApp, useT } from "@/components/app/app-data";
import { Icon } from "@/components/book/icon";
import { pillVars } from "@/components/book/word";
import { active } from "@/modules/progress/local";
import { useDevice } from "@/modules/progress/store";

import { bookMap, currentPage, isDone } from "./journey";

/**
 * The book's contents on home: a strip with the book's parts, and under the chosen part every topic
 * with its page numbers, so any page is one tap away. Opens on the part the learner is reading.
 */
export function QuickIndex() {
  const { lessons, catalog } = useApp();
  const t = useT();
  const me = active(useDevice());
  const stages = bookMap(lessons);
  const here = currentPage(lessons, me)?.bookPage;
  const hereStage = Math.max(
    0,
    stages.findIndex((s) => s.units.some((u) => u.pages.some((p) => p.bookPage === here))),
  );
  const [chosen, setChosen] = useState<number | null>(null);
  const si = chosen ?? hereStage;
  const stage = stages[si];
  const pal = (n: number) => catalog.palette[n % catalog.palette.length] ?? "yellow";
  if (!stage) return null;
  return (
    <section className="nb-card nb-index" aria-labelledby="nb-index-title">
      <div className="nb-book-title">
        <span className="nb-book-icon">
          <Icon name="journey" size={32} />
        </span>
        <div className="nb-stack nb-gap-2">
          <h2 className="nb-h2" id="nb-index-title">
            {t("home.index")}
          </h2>
          <span className="nb-muted">{t("home.indexText")}</span>
        </div>
      </div>
      <nav className="nb-strip" aria-label={t("book.units")}>
        {stages.map((s, n) => (
          <button
            key={s.position}
            type="button"
            className="nb-unit nb-tr-state nb-tr-press"
            style={pillVars(pal(n))}
            aria-pressed={n === si}
            onClick={() => setChosen(n)}
          >
            {s.title}
          </button>
        ))}
      </nav>
      <ul className="nb-index-units" style={pillVars(pal(si))}>
        {stage.units.map((u) => (
          <li key={u.key} className="nb-index-unit">
            <span className="nb-index-unit-title">{u.title}</span>
            <span className="nb-index-pages">
              {u.pages.map((p) => {
                const label = t("book.pageAria", {
                  page: p.bookPage,
                  title: p.title,
                });
                const done = isDone(me, p.bookPage);
                return (
                  <Link
                    key={p.bookPage}
                    href={t.href(`/lesson/${p.bookPage}`)}
                    className="nb-pg nb-tr-state nb-tr-press"
                    style={pillVars(pal(si))}
                    aria-current={p.bookPage === here ? "page" : undefined}
                    aria-label={done ? t("book.pageRead", { label }) : label}
                    title={p.title}
                  >
                    {t.num(p.bookPage)}
                    {done && <span className="nb-pg-dot" aria-hidden="true" />}
                  </Link>
                );
              })}
            </span>
          </li>
        ))}
      </ul>
    </section>
  );
}
