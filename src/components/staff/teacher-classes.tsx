"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";

import { useT } from "@/components/app/app-data";
import { SearchField } from "@/components/book/controls";
import { Icon } from "@/components/book/icon";
import { Tag } from "@/components/book/parts";
import { matchesSearch } from "@/modules/i18n/search";

type Room = { id: string; name: string; joinCode: string; students: number };

/** A teacher's classes: open a new one, rename one, or archive one (its students and progress stay). */
export function TeacherClasses({ classes }: { classes: Room[] }) {
  const t = useT();
  const router = useRouter();
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const shown = classes.filter((c) => matchesSearch(`${c.name} ${c.joinCode}`, query));

  const create = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return setError(t("classes.needName"));
    setBusy(true);
    setError(null);
    const r = await fetch("/api/v1/classrooms", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ name }),
    }).catch(() => null);
    setBusy(false);
    if (!r?.ok) return setError(t("classes.failed"));
    setName("");
    router.refresh();
  };

  return (
    <div className="nb-cols nb-staff-cols">
      <section className="nb-card nb-col-main nb-anim-rise">
        <h1 className="nb-h1">{t("staff.classes")}</h1>
        <p className="nb-sub">{t("classes.intro")}</p>
        {classes.length > 0 && (
          <div className="nb-class-search">
            <SearchField
              label={t("classes.search")}
              clearLabel={t("classes.clearSearch")}
              value={query}
              onChange={setQuery}
            />
          </div>
        )}
        {!classes.length ? (
          <p className="nb-muted nb-m0">{t("teacher.noClass")}</p>
        ) : shown.length ? (
          <ul className="nb-plain nb-review-list">
            {shown.map((c) => (
              <ClassRow key={c.id} room={c} />
            ))}
          </ul>
        ) : (
          <p className="nb-muted nb-m0" role="status">
            {t("classes.noMatch", { query: query.trim() })}
          </p>
        )}
      </section>
      <aside className="nb-col-side">
        <form className="nb-card nb-anim-rise" onSubmit={create} noValidate>
          <h2 className="nb-h2">{t("classes.new")}</h2>
          <label className="nb-field">
            <span className="nb-label">{t("classes.name")}</span>
            <input className="nb-input" value={name} maxLength={60} onChange={(e) => setName(e.target.value)} />
          </label>
          {error && (
            <p className="nb-error nb-m0" role="alert">
              {error}
            </p>
          )}
          <button type="submit" className="nb-btn nb-btn-ok" disabled={busy}>
            {t("classes.create")}
          </button>
        </form>
      </aside>
    </div>
  );
}

function ClassRow({ room }: { room: Room }) {
  const t = useT();
  const router = useRouter();
  const [mode, setMode] = useState<"view" | "rename" | "archive">("view");
  const [name, setName] = useState(room.name);
  const [error, setError] = useState(false);
  const patch = async (data: { name?: string; archived?: boolean }) => {
    setError(false);
    const r = await fetch(`/api/v1/classrooms/${room.id}`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(data),
    }).catch(() => null);
    if (!r?.ok) return setError(true);
    setMode("view");
    router.refresh();
  };

  return (
    <li className="nb-class-row">
      <div className="nb-class-main">
        {mode === "rename" ? (
          <form
            className="nb-row nb-center-y nb-class-rename"
            onSubmit={(e) => {
              e.preventDefault();
              if (name.trim()) void patch({ name: name.trim() });
            }}
          >
            <label className="nb-field nb-grow">
              <span className="nb-label">{t("classes.name")}</span>
              <input className="nb-input" value={name} maxLength={60} onChange={(e) => setName(e.target.value)} />
            </label>
            <button type="submit" className="nb-btn nb-btn-ok nb-w-auto">
              {t("admin.save")}
            </button>
            <button
              type="button"
              className="nb-btn nb-btn-quiet"
              onClick={() => {
                setName(room.name);
                setMode("view");
              }}
            >
              {t("teacher.cancel")}
            </button>
          </form>
        ) : (
          <>
            <b className="nb-class-name">{name}</b>
            <span className="nb-row nb-center-y nb-class-meta">
              <span className="nb-muted">{t("classes.code")}</span>
              <code className="nb-class-code" dir="ltr">
                {room.joinCode}
              </code>
              <Tag palette="gray">{t("classes.students", { n: t.num(room.students) })}</Tag>
            </span>
          </>
        )}
        {error && (
          <p className="nb-error nb-m0" role="alert">
            {t("classes.failed")}
          </p>
        )}
      </div>
      {mode === "archive" ? (
        <div className="nb-report-confirm">
          <span className="nb-small">{t("classes.confirmArchive", { name: room.name })}</span>
          <span className="nb-row nb-nowrap">
            <button type="button" className="nb-btn nb-btn-again nb-w-auto" onClick={() => patch({ archived: true })}>
              {t("classes.archive")}
            </button>
            <button type="button" className="nb-btn nb-btn-quiet" onClick={() => setMode("view")}>
              {t("teacher.cancel")}
            </button>
          </span>
        </div>
      ) : (
        mode === "view" && (
          <div className="nb-row nb-class-actions">
            <Link href={t.href(`/teacher/students?class=${room.id}`)} className="nb-btn nb-btn-soft nb-w-auto">
              <Icon name="profile" size={20} /> {t("staff.students")}
            </Link>
            <button type="button" className="nb-btn nb-btn-quiet" onClick={() => setMode("rename")}>
              {t("classes.rename")}
            </button>
            <button type="button" className="nb-btn nb-btn-quiet" onClick={() => setMode("archive")}>
              {t("classes.archive")}
            </button>
          </div>
        )
      )}
    </li>
  );
}
