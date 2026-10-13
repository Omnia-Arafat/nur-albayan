"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";

import { useApp, useT, xpRates } from "@/components/app/app-data";
import { Avatar } from "@/components/app/header";
import { Icon } from "@/components/book/icon";
import { Meter, Tag } from "@/components/book/parts";
import { Pill, pillVars } from "@/components/book/word";
import type { StudentReport } from "@/modules/classroom/report";
import { effectiveScore } from "@/modules/scoring/engine";

/** Accuracy at or above this reads as on track (the same display threshold as the overview). */
const ON_TRACK = 0.8;

export function StudentDetail({ report }: { report: StudentReport }) {
  const t = useT();
  const { locale, catalog } = useApp();
  const router = useRouter();
  const { student, classroom } = report;
  const base = `/api/v1/classrooms/${classroom.id}/students/${student.id}`;
  const [confirm, setConfirm] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pin, setPin] = useState("");
  const [pinNote, setPinNote] = useState<string | null>(null);

  const date = new Intl.DateTimeFormat(`${locale.code}-u-nu-${locale.numberingSystem}`, {
    day: "numeric",
    month: "short",
  });
  const fullDate = new Intl.DateTimeFormat(`${locale.code}-u-nu-${locale.numberingSystem}`, { dateStyle: "long" });
  // The same total the learner sees in their header: lessons by the repeat policy, stars, and game points.
  const rules = catalog.scoring;
  const rates = xpRates(catalog);
  const points = report.lessons
    .filter((l) => l.completedCount > 0)
    .reduce(
      (n, l) => n + rates.perLesson + l.stars * rates.perStar + (rules ? effectiveScore(rules.repeatPolicy, l) : 0),
      report.gamePoints,
    );
  const maxStars = Math.max(0, ...(catalog.scoring?.stars ?? []).map((s) => s.stars));

  const act = async (url: string, init: RequestInit) => {
    setBusy(true);
    setError(null);
    const r = await fetch(url, init).catch(() => null);
    setBusy(false);
    setConfirm(null);
    if (!r?.ok) return setError(t("report.failed"));
    router.refresh();
  };
  const post = (url: string, data: unknown) =>
    act(url, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(data) });

  const savePin = async (e: React.FormEvent) => {
    e.preventDefault();
    setPinNote(null);
    if (!/^\d{4,6}$/.test(pin)) return setPinNote(t("teacher.pinRule"));
    const r = await fetch(base, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ pin }),
    }).catch(() => null);
    setPinNote(t(r?.ok ? "report.pinSaved" : "report.failed"));
    if (r?.ok) setPin("");
  };

  const kpi = [
    {
      icon: "journey",
      pal: "sky",
      value: student.reachedPage ? t("lesson.pageTag", { page: student.reachedPage }) : t("teacher.noReading"),
      label: "report.reached",
    },
    {
      icon: "check",
      pal: "lime",
      value: student.accuracy == null ? "–" : t.pct(student.accuracy),
      label: "report.accuracy",
    },
    { icon: "star", pal: "yellow", value: t.num(points), label: "report.points" },
    { icon: "candle", pal: "salmon", value: t.num(student.streak), label: "report.streak" },
    { icon: "box", pal: "pink", value: t.num(report.bank.length), label: "report.bank" },
    { icon: "crown", pal: "lavender", value: t.num(report.mastered), label: "report.mastered" },
  ];

  return (
    <div className="nb-report">
      <p className="nb-print-only nb-muted nb-m0">
        {t("report.printedOn", { name: student.name, class: classroom.name, date: fullDate.format(new Date()) })}
      </p>
      <div className="nb-cols nb-staff-cols">
        <div className="nb-col-main">
          <section className="nb-card nb-anim-rise">
            <div className="nb-spread nb-no-print">
              <Link href={t.href(`/teacher/students?class=${classroom.id}`)} className="nb-btn nb-btn-quiet">
                <Icon name="next" size={20} tone="lavender" className="nb-flip nb-dir-flip" /> {t("report.back")}
              </Link>
              <button type="button" className="nb-btn nb-btn-soft nb-w-auto" onClick={() => window.print()}>
                <Icon name="book" size={22} /> {t("report.print")}
              </button>
            </div>
            <div className="nb-row nb-center-y nb-report-who">
              <Avatar profile={{ avatar: student.avatar, colorTokenKey: student.colorTokenKey }} />
              <div>
                <h1 className="nb-h1 nb-m0">{student.name}</h1>
                <p className="nb-muted nb-m0">
                  {classroom.name}
                  {student.username && (
                    <>
                      {" · "}
                      <span dir="ltr">{student.username}</span>
                    </>
                  )}
                </p>
              </div>
            </div>
            <div className="nb-grid nb-kpis nb-kpis-6">
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
            <h2 className="nb-h2">{t("report.lessons")}</h2>
            {error && (
              <p className="nb-error nb-m0" role="alert">
                {error}
              </p>
            )}
            {report.lessons.length ? (
              <table className="nb-table nb-table-wide nb-table-stack">
                <thead>
                  <tr>
                    <th>{t("report.colPage")}</th>
                    <th>{t("report.colStars")}</th>
                    <th>{t("report.accuracy")}</th>
                    <th>{t("report.colTimes")}</th>
                    <th>{t("report.colLast")}</th>
                    <th className="nb-no-print">
                      <span className="nb-sr">{t("report.reset")}</span>
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {report.lessons.map((l) => (
                    <tr key={l.lessonId}>
                      <td>
                        <span className="nb-report-page">
                          <b>{t("lesson.pageTag", { page: l.bookPage })}</b>
                          {l.title && <span className="nb-muted nb-small">{l.title}</span>}
                        </span>
                      </td>
                      <td data-label={t("report.colStars")}>
                        <span className="nb-row nb-nowrap" aria-label={`${t.num(l.stars)} / ${t.num(maxStars)}`}>
                          {Array.from({ length: maxStars }, (_, i) => (
                            <Icon key={i} name="star" size={18} tone={i < l.stars ? undefined : "gray"} />
                          ))}
                        </span>
                      </td>
                      <td data-label={t("report.accuracy")}>
                        <span className="nb-row nb-nowrap nb-center-y nb-meter-cell">
                          <Meter value={l.accuracy} palette={l.accuracy >= ON_TRACK ? "lime" : "salmon"} />
                          {t.pct(l.accuracy)}
                        </span>
                      </td>
                      <td data-label={t("report.colTimes")}>{t.num(l.completedCount)}</td>
                      <td data-label={t("report.colLast")}>
                        {l.lastStudiedAt ? date.format(new Date(l.lastStudiedAt)) : "–"}
                      </td>
                      <td className="nb-no-print nb-report-act">
                        {confirm === l.lessonId ? (
                          <span className="nb-report-confirm">
                            <span className="nb-small">
                              {t("report.confirmReset", { page: l.bookPage, name: student.name })}
                            </span>
                            <span className="nb-row nb-nowrap">
                              <button
                                type="button"
                                className="nb-btn nb-btn-again nb-w-auto"
                                disabled={busy}
                                onClick={() => act(`${base}/lessons/${l.lessonId}`, { method: "DELETE" })}
                              >
                                {t("report.yes")}
                              </button>
                              <button type="button" className="nb-btn nb-btn-quiet" onClick={() => setConfirm(null)}>
                                {t("teacher.cancel")}
                              </button>
                            </span>
                          </span>
                        ) : (
                          <button type="button" className="nb-btn nb-btn-quiet" onClick={() => setConfirm(l.lessonId)}>
                            {t("report.reset")}
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : (
              <p className="nb-muted nb-m0">{t("report.noLessons")}</p>
            )}
          </section>
        </div>

        <aside className="nb-col-side">
          <section className="nb-card nb-anim-rise">
            <div className="nb-spread">
              <h2 className="nb-h2">{t("report.bank")}</h2>
              <Tag palette={report.bank.length > 8 ? "salmon" : "gray"}>{t.num(report.bank.length)}</Tag>
            </div>
            {report.bank.length ? (
              <>
                <ul className="nb-plain nb-report-bank">
                  {report.bank.map((w) => (
                    <li key={w.itemId}>
                      <Pill segments={w.segments} script={w.script} palette="pink" size={24} />
                      <span className="nb-muted nb-small">
                        {t("lesson.pageTag", { page: w.bookPage })} · {t("report.missN", { n: w.missCount })}
                      </span>
                      <button
                        type="button"
                        className="nb-btn nb-btn-quiet nb-no-print"
                        disabled={busy}
                        aria-label={t("report.learnedFor", { name: student.name })}
                        onClick={() => post(`${base}/mistakes`, { itemId: w.itemId })}
                      >
                        <Icon name="check" size={20} tone="lime" /> {t("report.learned")}
                      </button>
                    </li>
                  ))}
                </ul>
                <div className="nb-no-print">
                  {confirm === "bank" ? (
                    <div className="nb-report-confirm">
                      <span className="nb-small">{t("report.confirmAll", { n: report.bank.length })}</span>
                      <span className="nb-row nb-nowrap">
                        <button
                          type="button"
                          className="nb-btn nb-btn-ok nb-w-auto"
                          disabled={busy}
                          onClick={() => post(`${base}/mistakes`, {})}
                        >
                          {t("report.yes")}
                        </button>
                        <button type="button" className="nb-btn nb-btn-quiet" onClick={() => setConfirm(null)}>
                          {t("teacher.cancel")}
                        </button>
                      </span>
                    </div>
                  ) : (
                    <button type="button" className="nb-btn nb-btn-soft" onClick={() => setConfirm("bank")}>
                      {t("report.allLearned")}
                    </button>
                  )}
                </div>
              </>
            ) : (
              <p className="nb-muted nb-m0">{t("report.noBank")}</p>
            )}
          </section>

          <section className="nb-card nb-anim-rise">
            <h2 className="nb-h2">{t("report.days", { n: 14 })}</h2>
            {report.days.length ? (
              <ul className="nb-plain nb-report-days">
                {report.days.map((d) => (
                  <li key={d.day}>
                    <b>{date.format(new Date(`${d.day}T12:00:00`))}</b>
                    <span className="nb-muted nb-small">
                      {t("report.dayLine", { reads: d.reads, pct: t.pct(d.reads ? d.correct / d.reads : 0) })}
                      {d.byTeacher > 0 && ` · ${t("report.byTeacher", { n: d.byTeacher })}`}
                    </span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="nb-muted nb-m0">{t("report.noDays", { n: 14 })}</p>
            )}
          </section>

          {student.username && (
            <form className="nb-card nb-anim-rise nb-no-print" onSubmit={savePin} noValidate>
              <h2 className="nb-h2">{t("report.newPin")}</h2>
              <p className="nb-muted nb-small nb-m0">{t("report.pinHelp")}</p>
              <label className="nb-field">
                <span className="nb-label">{t("teacher.pin")}</span>
                <input
                  className="nb-input nb-input-code"
                  dir="ltr"
                  inputMode="numeric"
                  autoComplete="off"
                  value={pin}
                  maxLength={6}
                  onChange={(e) => setPin(e.target.value.replace(/\D/g, ""))}
                />
              </label>
              {pinNote && (
                <p className="nb-muted nb-m0" role="status">
                  {pinNote}
                </p>
              )}
              <button type="submit" className="nb-btn nb-btn-ok">
                {t("report.savePin")}
              </button>
            </form>
          )}
        </aside>
      </div>
    </div>
  );
}
