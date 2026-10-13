"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";

import { useT } from "@/components/app/app-data";
import { Avatar } from "@/components/app/header";
import type { StudentRow } from "@/modules/classroom/service";

import { ClassPicker } from "./class-picker";

export function TeacherStudents({
  classes,
  current,
  students,
}: {
  classes: { id: string; name: string; students: number }[];
  current: string | null;
  students: StudentRow[];
}) {
  const t = useT();
  const router = useRouter();
  const [name, setName] = useState("");
  const [username, setUsername] = useState("");
  const [pin, setPin] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [confirm, setConfirm] = useState<string | null>(null);

  if (!current)
    return (
      <section className="nb-card">
        <h1 className="nb-h1">{t("staff.students")}</h1>
        <p className="nb-muted nb-m0">{t("teacher.noClass")}</p>
      </section>
    );

  const add = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return setError(t("teacher.needName"));
    if (pin && !/^\d{4,6}$/.test(pin)) return setError(t("teacher.pinRule"));
    setBusy(true);
    setError(null);
    const r = await fetch(`/api/v1/classrooms/${current}/students`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ displayName: name, username, pin }),
    });
    setBusy(false);
    if (r.status === 409) return setError(t("teacher.usernameTaken"));
    if (!r.ok) return setError(t("admin.saveFailed", { error: r.status }));
    setName("");
    setUsername("");
    setPin("");
    router.refresh();
  };
  const remove = async (id: string) => {
    await fetch(`/api/v1/classrooms/${current}/students/${id}`, { method: "DELETE" });
    setConfirm(null);
    router.refresh();
  };

  return (
    <div className="nb-cols nb-staff-cols">
      <section className="nb-card nb-col-main nb-anim-rise nb-overflow-visible">
        <div className="nb-teacher-top">
          <h1 className="nb-h1">{t("staff.students")}</h1>
          <ClassPicker classes={classes} current={current} />
        </div>
        {!students.length && <p className="nb-muted nb-m0">{t("teacher.noStudents")}</p>}
        <ul className="nb-plain nb-review-list">
          {students.map((st) => (
            <li key={st.id} className="nb-student-row">
              <Avatar profile={{ avatar: st.avatar, colorTokenKey: st.colorTokenKey }} />
              <span className="nb-review-text">
                <Link
                  href={t.href(`/teacher/students/${st.id}?class=${current}`)}
                  className="nb-link-strong"
                  aria-label={t("report.open", { name: st.name })}
                >
                  {st.name}
                </Link>
                <span className="nb-muted nb-small" dir="ltr">
                  {st.username ?? ""}
                </span>
              </span>
              {confirm === st.id ? (
                <span className="nb-row nb-nowrap">
                  <button type="button" className="nb-btn nb-btn-again nb-w-auto" onClick={() => remove(st.id)}>
                    {t("teacher.remove")}
                  </button>
                  <button type="button" className="nb-btn nb-btn-quiet" onClick={() => setConfirm(null)}>
                    {t("teacher.cancel")}
                  </button>
                </span>
              ) : (
                <button
                  type="button"
                  className="nb-btn nb-btn-quiet"
                  aria-label={t("teacher.confirmRemove", { name: st.name })}
                  onClick={() => setConfirm(st.id)}
                >
                  {t("teacher.remove")}
                </button>
              )}
            </li>
          ))}
        </ul>
      </section>
      <aside className="nb-col-side">
        <form className="nb-card nb-anim-rise" onSubmit={add} noValidate>
          <h2 className="nb-h2">{t("teacher.addStudent")}</h2>
          <label className="nb-field">
            <span className="nb-label">{t("teacher.studentName")}</span>
            <input className="nb-input" value={name} maxLength={40} onChange={(e) => setName(e.target.value)} />
          </label>
          <label className="nb-field">
            <span className="nb-label">{t("teacher.username")}</span>
            <input
              className="nb-input"
              dir="ltr"
              autoComplete="off"
              value={username}
              maxLength={24}
              onChange={(e) => setUsername(e.target.value.replace(/[^a-z0-9._-]/gi, ""))}
            />
          </label>
          <label className="nb-field">
            <span className="nb-label">{t("teacher.pin")}</span>
            <input
              className="nb-input"
              dir="ltr"
              inputMode="numeric"
              autoComplete="off"
              value={pin}
              maxLength={6}
              onChange={(e) => setPin(e.target.value.replace(/\D/g, ""))}
            />
          </label>
          {error && (
            <p className="nb-error nb-m0" role="alert">
              {error}
            </p>
          )}
          <button type="submit" className="nb-btn nb-btn-ok" disabled={busy}>
            {t("teacher.add")}
          </button>
        </form>
      </aside>
    </div>
  );
}
