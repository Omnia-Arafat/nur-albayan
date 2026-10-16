"use client";

import { MyLeaderboards } from "@/components/app/leaderboard";
import { useApp, useT, xpRates } from "@/components/app/app-data";
import { Icon } from "@/components/book/icon";
import { Meter, Tag } from "@/components/book/parts";
import { pillVars } from "@/components/book/word";
import { active, levelOf, xpOf } from "@/modules/progress/local";
import { useDevice } from "@/modules/progress/store";

export function Badges() {
  const { catalog } = useApp();
  const t = useT();
  const me = active(useDevice());
  const xp = me && catalog.scoring ? xpOf(me, catalog.scoring, xpRates(catalog)) : 0;
  const levels = [...catalog.levels].sort((a, b) => a.xpThreshold - b.xpThreshold);
  const { current, next } = levelOf(levels, xp);
  const span = next ? next.xpThreshold - current.xpThreshold : 1;
  const earned = new Set(me?.badges ?? []);
  const got = catalog.badges.filter((b) => earned.has(b.key)).length;

  return (
    <main className="nb-page">
      <section className="nb-card nb-anim-rise">
        <div className="nb-spread nb-nowrap">
          <div>
            <h1 className="nb-h1">{t("badges.level", { name: current.name })}</h1>
            <p className="nb-sub">
              {next
                ? t("badges.toNext", { xp: t.num(xp), left: t.num(next.xpThreshold - xp), name: next.name })
                : t("badges.top", { xp: t.num(xp) })}
            </p>
          </div>
          <span className="nb-level nb-level-big">{t.num(current.position)}</span>
        </div>
        <Meter value={next ? (xp - current.xpThreshold) / span : 1} palette="lime" />
        <ol className="nb-levels">
          {levels.map((l) => {
            const state = l.key === current.key ? "here" : l.xpThreshold <= xp ? "done" : "next";
            return (
              <li key={l.key} className={`nb-lv ${state}`} aria-current={state === "here" ? "step" : undefined}>
                <span className="nb-lv-no">
                  {state === "done" ? <Icon name="check" size={20} tone="lime" /> : t.num(l.position)}
                </span>
                <b>{l.name}</b>
                <span className="nb-muted">{t("badges.xp", { n: t.num(l.xpThreshold) })}</span>
              </li>
            );
          })}
        </ol>
      </section>
      <section className="nb-card nb-anim-rise">
        <div className="nb-spread">
          <h2 className="nb-h2">{t("badges.title")}</h2>
          <Tag palette="yellow">
            <Icon name="crown" size={18} tone="yellow" />{" "}
            {t("badges.count", { n: t.num(got), total: t.num(catalog.badges.length) })}
          </Tag>
        </div>
        <ul className="nb-grid nb-grid-140 nb-plain">
          {catalog.badges.map((b) => {
            const pal = b.fillTokenKey.split(".")[2];
            const on = earned.has(b.key);
            return (
              <li key={b.key} className={`nb-tile${on ? "" : " locked"}`} style={pillVars(pal)}>
                <span className="big">
                  <Icon name={b.iconKey} size={40} tone={on ? pal : "gray"} />
                </span>
                <b>{b.name}</b>
                <span className="nb-muted nb-small">{b.description}</span>
                <span className="nb-tile-state">
                  <Icon
                    name={on ? "check" : "lock"}
                    size={18}
                    tone={on ? "lime" : "gray"}
                    title={on ? t("badges.earned") : t("badges.locked")}
                  />
                </span>
              </li>
            );
          })}
        </ul>
      </section>
      <MyLeaderboards />
    </main>
  );
}
