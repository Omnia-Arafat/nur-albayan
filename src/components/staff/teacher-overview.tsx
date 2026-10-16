"use client";

import Link from "next/link";

import { useT } from "@/components/app/app-data";
import { Avatar } from "@/components/app/header";
import { Icon } from "@/components/book/icon";
import { Meter, Tag } from "@/components/book/parts";
import { Pill, pillVars } from "@/components/book/word";
import type { Overview } from "@/modules/classroom/service";

import { ClassPicker } from "./class-picker";
import { SettingControl, type SettingView } from "./setting-control";

/** Students whose accuracy is at or above this read as on track (a display threshold, not scoring). */
const ON_TRACK = 0.8;

export function TeacherOverview({
  classes,
  overview,
  settings,
}: {
  classes: { id: string; name: string; students: number }[];
  overview: Overview | null;
  settings: SettingView[];
}) {
  const t = useT();
  if (!overview)
    return (
      <section className="nb-card">
        <h1 className="nb-h1">{t("staff.overview")}</h1>
        <p className="nb-muted nb-m0">{t("teacher.noClass")}</p>
        <Link href={t.href("/teacher/classes")} className="nb-btn nb-btn-ok nb-w-auto nb-self-start">
          <Icon name="grid-3" size={22} /> {t("classes.manage")}
        </Link>
      </section>
    );
  const { kpis, students, hardest, classroom } = overview;
  const kpi = [
    {
      icon: "check",
      pal: "lime",
      value: kpis.accuracy == null ? "–" : t.pct(kpis.accuracy),
      label: "teacher.kpiAccuracy",
    },
    { icon: "book", pal: "sky", value: t.num(kpis.lessonsDone), label: "teacher.kpiLessons" },
    { icon: "box", pal: "salmon", value: t.num(kpis.bankWords), label: "teacher.kpiBank" },
    { icon: "candle", pal: "yellow", value: t.num(kpis.readToday), label: "teacher.kpiToday" },
  ];
  return (
    <div className="nb-cols nb-staff-cols">
      <div className="nb-col-main">
        <section className="nb-card nb-anim-rise nb-overflow-visible">
          <div className="nb-teacher-top">
            <div>
              <h1 className="nb-h1">{t("staff.overview")}</h1>
              <p className="nb-muted nb-m0">
                {t("teacher.lastDays", { n: t.num(overview.days) })} ·{" "}
                {t("teacher.joinCode", { code: classroom.joinCode })}
              </p>
            </div>
            <span className="nb-row nb-center-y nb-no-print">
              <ClassPicker classes={classes} current={classroom.id} />
              <button type="button" className="nb-btn nb-btn-soft nb-w-auto" onClick={() => window.print()}>
                <Icon name="book" size={22} /> {t("teacher.print")}
              </button>
            </span>
          </div>
          <div className="nb-grid nb-kpis">
            {kpi.map((k) => (
              <div key={k.label} className="nb-kpi" style={pillVars(k.pal)}>
                <Icon name={k.icon} size={30} tone={k.pal} />
                <b>{k.value}</b>
                <span>{t(k.label)}</span>
              </div>
            ))}
          </div>
        </section>
        <section className="nb-card nb-anim-rise">
          <div className="nb-spread">
            <h2 className="nb-h2">{t("staff.students")}</h2>
            <Link
              href={t.href(`/teacher/grade?class=${classroom.id}`)}
              className="nb-btn nb-btn-soft nb-w-auto nb-no-print"
            >
              <Icon name="check" size={22} /> {t("teacher.startGrading")}
            </Link>
          </div>
          {students.length ? (
            <div className="nb-scroll-x">
              <table className="nb-table nb-table-wide nb-table-stack">
                <thead>
                  <tr>
                    <th>{t("teacher.colStudent")}</th>
                    <th>{t("teacher.colReached")}</th>
                    <th>{t("teacher.colAccuracy")}</th>
                    <th>{t("teacher.colStreak")}</th>
                    <th>{t("teacher.colBank")}</th>
                  </tr>
                </thead>
                <tbody>
                  {students.map((st) => (
                    <tr key={st.id}>
                      <td>
                        <span className="nb-row nb-nowrap nb-center-y">
                          <Avatar profile={{ avatar: st.avatar, colorTokenKey: st.colorTokenKey }} />
                          <Link
                            href={t.href(`/teacher/students/${st.id}?class=${classroom.id}`)}
                            className="nb-link-strong"
                            aria-label={t("report.open", { name: st.name })}
                          >
                            {st.name}
                          </Link>
                        </span>
                      </td>
                      <td data-label={t("teacher.colReached")}>
                        {st.reachedPage ? t("lesson.pageTag", { page: st.reachedPage }) : t("teacher.noReading")}
                      </td>
                      <td data-label={t("teacher.colAccuracy")}>
                        {st.accuracy == null ? (
                          "–"
                        ) : (
                          <span className="nb-row nb-nowrap nb-center-y nb-meter-cell">
                            <Meter value={st.accuracy} palette={st.accuracy >= ON_TRACK ? "lime" : "salmon"} />
                            {t.pct(st.accuracy)}
                          </span>
                        )}
                      </td>
                      <td data-label={t("teacher.colStreak")}>{t.num(st.streak)}</td>
                      <td data-label={t("teacher.colBank")}>
                        <Tag palette={st.bankCount > 8 ? "salmon" : "gray"}>{t.num(st.bankCount)}</Tag>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="nb-muted nb-m0">{t("teacher.noStudents")}</p>
          )}
        </section>
      </div>
      <aside className="nb-col-side">
        <section className="nb-card">
          <h2 className="nb-h2">{t("teacher.hardest")}</h2>
          {hardest.length ? (
            <div className="nb-hard">
              {hardest.map((h) => (
                <div key={h.itemId} className="nb-spread nb-nowrap">
                  <Pill segments={h.segments} script={h.script} palette="pink" size={24} />
                  <span className="nb-muted nb-nowrap-text">{t("teacher.nStudents", { n: t.num(h.students) })}</span>
                </div>
              ))}
            </div>
          ) : (
            <p className="nb-muted nb-m0">{t("teacher.noHard")}</p>
          )}
        </section>
        <section className="nb-card nb-no-print">
          <h2 className="nb-h2">{t("teacher.classSettings")}</h2>
          {settings.map((s) => (
            <SettingControl
              key={`${classroom.id}:${s.key}`}
              setting={s}
              endpoint={`/api/v1/classrooms/${classroom.id}/settings`}
            />
          ))}
        </section>
      </aside>
    </div>
  );
}
