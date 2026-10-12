"use client";

import { useMemo, useState } from "react";

import { useApp, useT } from "@/components/app/app-data";
import { Select } from "@/components/book/controls";
import { Icon } from "@/components/book/icon";
import { Meter, Ring } from "@/components/book/parts";
import { pillVars, Word } from "@/components/book/word";
import { paletteOf } from "@/components/screens/page-view";
import { useLesson } from "@/components/screens/use-lesson";

import { ClassPicker } from "./class-picker";

type Read = { itemId: string; result: "correct" | "wrong" };

/** The teacher grades a student's reading card by card; the session is saved under the teacher's name. */
export function TeacherGrade({
  classes,
  current,
  students,
}: {
  classes: { id: string; name: string; students: number }[];
  current: string | null;
  students: { id: string; name: string; reachedPage: number | null }[];
}) {
  const { lessons, locale, catalog } = useApp();
  const t = useT();
  const [studentId, setStudentId] = useState(students[0]?.id ?? "");
  const student = students.find((s) => s.id === studentId);
  const firstPage = lessons[0]?.bookPage ?? 1;
  const [page, setPage] = useState(String(student?.reachedPage ?? firstPage));
  const [started, setStarted] = useState(false);
  const [reads, setReads] = useState<Read[]>([]);
  const [state, setState] = useState<"idle" | "saving" | "saved" | "failed">("idle");
  const [sessionId, setSessionId] = useState(() => crypto.randomUUID());
  const lesson = useLesson(started ? Number(page) : null, locale.code);
  const cards = useMemo(
    () =>
      (lesson?.sections ?? []).flatMap((s) =>
        s.items
          .map((it, idx) => ({ it, palette: paletteOf(s, it, idx, catalog.palette) }))
          .filter(({ it }) => it.isDrillable && s.kind !== "rule_definition" && s.kind !== "story"),
      ),
    [lesson, catalog.palette],
  );

  const save = async (all: Read[]) => {
    setState("saving");
    const r = await fetch(`/api/v1/classrooms/${current}/sessions`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ studentId, bookPage: Number(page), clientSessionId: sessionId, reads: all }),
    });
    setState(r.ok ? "saved" : "failed");
  };
  const grade = (result: Read["result"]) => {
    const next = [...reads, { itemId: cards[reads.length].it.id, result }];
    setReads(next);
    if (next.length === cards.length) save(next);
  };
  const restart = () => {
    setStarted(false);
    setReads([]);
    setState("idle");
    setSessionId(crypto.randomUUID());
  };

  if (!current)
    return (
      <section className="nb-card">
        <h1 className="nb-h1">{t("grade.title")}</h1>
        <p className="nb-muted nb-m0">{t("teacher.noClass")}</p>
      </section>
    );

  if (!started)
    return (
      <section className="nb-card nb-anim-rise nb-overflow-visible nb-grade-setup">
        <h1 className="nb-h1">{t("grade.title")}</h1>
        <p className="nb-sub">{t("grade.intro")}</p>
        <div className="nb-grid nb-grid-220">
          <ClassPicker classes={classes} current={current} />
          {students.length ? (
            <Select
              label={t("grade.student")}
              value={studentId}
              options={students.map((s) => ({ value: s.id, label: s.name }))}
              onChange={(id) => {
                setStudentId(id);
                setPage(String(students.find((s) => s.id === id)?.reachedPage ?? firstPage));
              }}
            />
          ) : (
            <p className="nb-muted nb-m0">{t("teacher.noStudents")}</p>
          )}
          <Select
            label={t("grade.page")}
            value={page}
            options={lessons.map((l) => ({
              value: String(l.bookPage),
              label: t("games.sourcePage", { page: l.bookPage, title: l.title }),
            }))}
            onChange={setPage}
          />
        </div>
        <button
          type="button"
          className="nb-btn nb-btn-ok nb-btn-big nb-self-start"
          disabled={!student}
          onClick={() => setStarted(true)}
        >
          {t("grade.start")} <Icon name="next" size={22} className="nb-dir-flip" />
        </button>
      </section>
    );

  const done = cards.length > 0 && reads.length === cards.length;
  const correct = reads.filter((r) => r.result === "correct").length;
  const card = cards[reads.length];
  return (
    <section className="nb-card nb-anim-rise nb-cards" aria-label={t("grade.title")}>
      <div className="nb-spread nb-full">
        <b>{student?.name}</b>
        <span className="nb-muted">
          {lesson ? t("lesson.cardOf", { n: Math.min(reads.length + 1, cards.length), total: cards.length }) : ""}
        </span>
      </div>
      <Meter value={cards.length ? reads.length / cards.length : 0} />
      {done ? (
        <>
          <Ring
            value={correct / cards.length}
            size={132}
            label={t("result.accuracy")}
            text={t.pct(correct / cards.length)}
          />
          <p className="nb-center nb-m0" role="status">
            {state === "saving"
              ? t("grade.saving")
              : state === "saved"
                ? t("grade.saved", { name: student?.name ?? "" })
                : t("grade.failed")}
          </p>
          <div className="nb-row nb-row-btns nb-center">
            {state === "failed" && (
              <button type="button" className="nb-btn nb-btn-ok" onClick={() => save(reads)}>
                {t("admin.save")}
              </button>
            )}
            <button type="button" className="nb-btn nb-btn-soft" onClick={restart} disabled={state === "saving"}>
              {t("grade.again")}
            </button>
          </div>
        </>
      ) : card ? (
        <>
          <div
            key={card.it.id}
            className="nb-bigcard nb-anim-pop"
            style={{
              ...pillVars(card.palette),
              fontFamily: card.it.script === "uthmani" ? "var(--nb-font-quran)" : undefined,
            }}
          >
            <Word segments={card.it.segments} />
          </div>
          <div className="nb-row nb-row-btns nb-center">
            <button type="button" className="nb-btn nb-btn-ok nb-btn-big" onClick={() => grade("correct")}>
              <Icon name="check" size={26} colours={{ fill: "color.surface", line: "color.surface" }} />{" "}
              {t("lesson.right")}
            </button>
            <button type="button" className="nb-btn nb-btn-again nb-btn-big" onClick={() => grade("wrong")}>
              {t("lesson.again")}
            </button>
          </div>
        </>
      ) : null}
    </section>
  );
}
