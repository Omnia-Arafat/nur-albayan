"use client";

import Link from "next/link";

import { useT } from "@/components/app/app-data";
import { Icon } from "@/components/book/icon";
import { Meter } from "@/components/book/parts";
import { pillVars } from "@/components/book/word";
import type { PlatformOverview } from "@/modules/admin/service";

/** The admin's first screen: how many people use the platform, how much of the book is live, recent reading. */
export function AdminOverview({ data }: { data: PlatformOverview }) {
  const t = useT();
  const people = [
    { icon: "profile", pal: "sky", value: t.num(data.learners), label: "adminHome.learners" },
    { icon: "check", pal: "lime", value: t.num(data.withAccount), label: "adminHome.withAccount" },
    { icon: "crown", pal: "lavender", value: t.num(data.teachers), label: "adminHome.teachers" },
    { icon: "grid-3", pal: "peach", value: t.num(data.classrooms), label: "adminHome.classes" },
  ];
  const reading = [
    { icon: "candle", pal: "salmon", value: t.num(data.activeLearners), label: "adminHome.active" },
    { icon: "book", pal: "sky", value: t.num(data.sessions), label: "adminHome.sessions" },
    { icon: "cards", pal: "yellow", value: t.num(data.reads), label: "adminHome.reads" },
    {
      icon: "check",
      pal: "lime",
      value: data.accuracy == null ? "–" : t.pct(data.accuracy),
      label: "adminHome.accuracy",
    },
    { icon: "trophy", pal: "pink", value: t.num(data.badgesEarned), label: "adminHome.badges" },
  ];
  const tiles = (list: typeof people) => (
    <div className="nb-grid nb-kpis nb-kpis-6">
      {list.map((k) => (
        <div key={k.label} className="nb-kpi" style={pillVars(k.pal)}>
          <Icon name={k.icon} size={30} tone={k.pal} />
          <b>{k.value}</b>
          <span>{t(k.label)}</span>
        </div>
      ))}
    </div>
  );
  const share = data.pages.total ? data.pages.published / data.pages.total : 0;
  return (
    <div className="nb-stack-lg">
      <section className="nb-card nb-anim-rise">
        <h1 className="nb-h1">{t("adminHome.title")}</h1>
        <p className="nb-sub">{t("adminHome.people")}</p>
        {tiles(people)}
      </section>
      <section className="nb-card nb-anim-rise">
        <div className="nb-spread">
          <h2 className="nb-h2">{t("adminHome.book")}</h2>
          <Link href={t.href("/admin")} className="nb-btn nb-btn-soft nb-w-auto">
            {t("staff.pages")}
          </Link>
        </div>
        <p className="nb-m0">
          {t("adminHome.published", { n: t.num(data.pages.published), total: t.num(data.pages.total) })}
        </p>
        <Meter value={share} palette="lime" label={t.pct(share)} />
      </section>
      <section className="nb-card nb-anim-rise">
        <h2 className="nb-h2">{t("teacher.lastDays", { n: t.num(data.days) })}</h2>
        {tiles(reading)}
      </section>
      <section className="nb-card nb-anim-rise">
        <h2 className="nb-h2">{t("export.title")}</h2>
        <p className="nb-muted nb-m0">{t("export.text")}</p>
        <a href="/api/v1/admin/export" className="nb-btn nb-btn-soft nb-self-start nb-w-auto" download>
          <Icon name="box" size={22} tone="sky" /> {t("export.download")}
        </a>
      </section>
    </div>
  );
}
