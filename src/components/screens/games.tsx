"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";

import { useApp, useT } from "@/components/app/app-data";
import { Seg, Select } from "@/components/book/controls";
import { Icon } from "@/components/book/icon";
import { Tag } from "@/components/book/parts";
import { pillVars } from "@/components/book/word";
import { PLAYABLE } from "@/modules/games/screens";
import { active, openMistakes } from "@/modules/progress/local";
import { useDevice } from "@/modules/progress/store";

import { currentPage } from "./journey";

export function Games({ page }: { page: number | null }) {
  const { catalog, lessons } = useApp();
  const t = useT();
  const router = useRouter();
  const me = active(useDevice());
  // Only pages with words to read aloud can feed a game (an intro page has none), so the picker
  // lists those and starts on the asked-for page, then the learner's place, then the first such page.
  const playable = lessons.filter((l) => l.drillable > 0);
  const has = (n?: number) => (n !== undefined && playable.some((l) => l.bookPage === n) ? n : undefined);
  const here = currentPage(lessons, me)?.bookPage;
  const start =
    has(page ?? undefined) ??
    has(here) ??
    playable.find((l) => here !== undefined && l.bookPage > here)?.bookPage ??
    playable[0]?.bookPage;
  const bank = me ? openMistakes(me).length : 0;
  const [source, setSource] = useState(start !== undefined ? String(start) : bank ? "bank" : "");
  const [grader, setGrader] = useState<"teacher" | "self">("teacher");
  const options = [
    ...playable.map((l) => ({
      value: String(l.bookPage),
      label: t("games.sourcePage", { page: l.bookPage, title: l.title }),
    })),
    ...(bank ? [{ value: "bank", label: t("games.sourceBank", { n: bank }) }] : []),
  ];
  const tile = (g: (typeof catalog.games)[number]) => {
    const pal = g.fillTokenKey.split(".")[2];
    const ready = PLAYABLE.has(g.key) && (g.kind === "break" || source !== "");
    const body = (
      <>
        <span className="big">
          <Icon name={g.iconKey} size={40} tone={ready ? pal : "gray"} />
        </span>
        <span>{g.name}</span>
        {!ready && <span className="nb-muted nb-small">{t("games.soon")}</span>}
      </>
    );
    return ready ? (
      <Link
        key={g.key}
        href={t.href(`/games/${g.key}?from=${source}&grader=${grader}`)}
        className="nb-tile nb-tr-press"
        style={pillVars(pal)}
      >
        {body}
      </Link>
    ) : (
      <div key={g.key} className="nb-tile locked" aria-disabled="true" style={pillVars(pal)}>
        {body}
      </div>
    );
  };
  return (
    <main className="nb-page">
      <section className="nb-card nb-anim-rise">
        <h1 className="nb-h1">{t("games.title")}</h1>
        <p className="nb-sub">{t("games.intro")}</p>
        <div className="nb-games-tools">
          <Select
            label={t("games.source")}
            value={source}
            onChange={(v) => {
              setSource(v);
              if (v !== "bank") router.replace(t.href(`/games?page=${v}`), { scroll: false });
            }}
            options={options}
          />
          <div className="nb-field">
            <span className="nb-label">{t("lesson.grader")}</span>
            <Seg
              label={t("lesson.grader")}
              value={grader}
              onChange={setGrader}
              options={[
                { value: "teacher", label: t("lesson.graderTeacher") },
                { value: "self", label: t("lesson.graderSelf") },
              ]}
            />
          </div>
        </div>
        <div className="nb-grid nb-grid-140">{catalog.games.filter((g) => g.kind === "wordwall").map(tile)}</div>
      </section>
      <section className="nb-card nb-anim-rise" style={{ animationDelay: "120ms" }}>
        <div className="nb-spread">
          <div>
            <h2 className="nb-h2">{t("games.breaks")}</h2>
            <p className="nb-muted nb-m0">{t("games.breaksIntro")}</p>
          </div>
          {catalog.settings["games.breaksEnabled"] !== false && (
            <Tag palette="lime">
              <Icon name="flag" size={18} tone="lime" /> {t("games.open")}
            </Tag>
          )}
        </div>
        <div className="nb-grid nb-grid-140">{catalog.games.filter((g) => g.kind === "break").map(tile)}</div>
      </section>
    </main>
  );
}
