"use client";

import { useEffect, useState } from "react";

import { studentPoints, useApp, useT } from "@/components/app/app-data";
import { Avatar } from "@/components/app/header";
import { Icon } from "@/components/book/icon";
import type { LeaderRow } from "@/modules/classroom/leaderboard";

/** Places that get a crown, in the book's medal tones. */
const PODIUM = ["yellow", "gray", "peach"] as const;

/** A class ranked by points (the ones each learner sees in their own header); `me` is highlighted. */
export function Leaderboard({ title, rows, me }: { title: string; rows: LeaderRow[]; me?: string | null }) {
  const { catalog } = useApp();
  const t = useT();
  const ranked = rows
    .map((r) => ({ ...r, points: studentPoints(catalog, r.lessons, r.gamePoints) }))
    .sort((a, b) => b.points - a.points || a.name.localeCompare(b.name));
  // Equal points share a place (1, 2, 2, 4).
  const place = (i: number) => ranked.findIndex((r) => r.points === ranked[i].points) + 1;
  return (
    <section className="nb-card nb-anim-rise">
      <h2 className="nb-h2">
        <Icon name="trophy" size={26} tone="yellow" /> {title}
      </h2>
      {ranked.length ? (
        <ol className="nb-plain nb-leaders">
          {ranked.map((r, i) => {
            const n = place(i);
            return (
              <li key={r.id} className={`nb-leader${r.id === me ? " me" : ""}`} aria-current={r.id === me || undefined}>
                <span className="nb-leader-place">
                  {n <= PODIUM.length ? <Icon name="crown" size={24} tone={PODIUM[n - 1]} /> : null}
                  <b>{t.num(n)}</b>
                </span>
                <Avatar profile={{ avatar: r.avatar, colorTokenKey: r.colorTokenKey }} />
                <span className="nb-leader-name">{r.name}</span>
                <span className="nb-leader-points">
                  <Icon name="star" size={20} tone="yellow" /> {t.num(r.points)}
                </span>
              </li>
            );
          })}
        </ol>
      ) : (
        <p className="nb-muted nb-m0">{t("teacher.noStudents")}</p>
      )}
    </section>
  );
}

/** For a signed-in learner: the leaderboards of their classes that have one switched on. Nothing otherwise. */
export function MyLeaderboards() {
  const t = useT();
  const [data, setData] = useState<{ studentId: string; classes: { id: string; name: string; rows: LeaderRow[] }[] }>();
  useEffect(() => {
    let live = true;
    void fetch("/api/v1/me/leaderboard", { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => live && d && setData(d))
      .catch(() => undefined);
    return () => {
      live = false;
    };
  }, []);
  if (!data?.classes.length) return null;
  return (
    <>
      {data.classes.map((c) => (
        <Leaderboard key={c.id} title={t("leaders.titleOf", { name: c.name })} rows={c.rows} me={data.studentId} />
      ))}
    </>
  );
}
