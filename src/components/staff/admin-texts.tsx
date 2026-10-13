"use client";

import { useMemo, useState } from "react";

import { useT } from "@/components/app/app-data";
import { Seg } from "@/components/book/controls";
import { Tag } from "@/components/book/parts";
import type { MessageRow } from "@/modules/admin/service";
import { placeholders } from "@/modules/i18n/placeholders";

type LocaleView = { code: string; name: string; dir: "ltr" | "rtl"; isDefault: boolean };
type Show = "all" | "missing" | "check";

/** Rows shown at a time; "show more" adds another page. */
const PAGE = 30;

/** Every interface text in every language, with the missing and mismatched ones a filter away. */
export function AdminTexts({ rows, locales }: { rows: MessageRow[]; locales: LocaleView[] }) {
  const t = useT();
  const [query, setQuery] = useState("");
  const [show, setShow] = useState<Show>("all");
  const [limit, setLimit] = useState(PAGE);
  const [saved, setSaved] = useState<Record<string, string>>({});
  const source = locales.find((l) => l.isDefault) ?? locales[0];

  const valueOf = (r: MessageRow, code: string) => saved[`${r.namespace}.${r.key}.${code}`] ?? r.values[code] ?? "";
  const missing = (r: MessageRow) => locales.some((l) => !valueOf(r, l.code).trim());
  const mismatch = (r: MessageRow) => {
    const want = placeholders(valueOf(r, source.code)).join();
    return locales.some((l) => valueOf(r, l.code) && placeholders(valueOf(r, l.code)).join() !== want);
  };
  const counts = { missing: rows.filter(missing).length, check: rows.filter(mismatch).length };
  const q = query.trim().toLowerCase();
  const shown = useMemo(
    () =>
      rows.filter(
        (r) =>
          (show === "all" || (show === "missing" ? missing(r) : mismatch(r))) &&
          (!q || r.key.toLowerCase().includes(q) || Object.values(r.values).some((v) => v.toLowerCase().includes(q))),
      ),
    // The counts above read the same values; recomputing on save keeps a fixed row from vanishing mid-edit.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [rows, show, q],
  );

  return (
    <div className="nb-stack-lg">
      <section className="nb-card nb-anim-rise">
        <h1 className="nb-h1">{t("texts.title")}</h1>
        <p className="nb-sub">{t("texts.intro")}</p>
        <div className="nb-texts-tools">
          <label className="nb-field">
            <span className="nb-label">{t("texts.search")}</span>
            <input
              className="nb-input"
              value={query}
              onChange={(e) => {
                setQuery(e.target.value);
                setLimit(PAGE);
              }}
            />
          </label>
          <Seg
            label={t("texts.show")}
            wide
            value={show}
            onChange={(v) => {
              setShow(v);
              setLimit(PAGE);
            }}
            options={[
              { value: "all", label: t("texts.all", { n: t.num(rows.length) }) },
              { value: "missing", label: t("texts.missing", { n: t.num(counts.missing) }) },
              { value: "check", label: t("texts.check", { n: t.num(counts.check) }) },
            ]}
          />
        </div>
      </section>
      {shown.length ? (
        <ul className="nb-plain nb-texts">
          {shown.slice(0, limit).map((r) => (
            <TextRow
              key={`${r.namespace}.${r.key}`}
              row={r}
              locales={locales}
              source={source.code}
              valueOf={(code) => valueOf(r, code)}
              onSaved={(code, value) => setSaved((m) => ({ ...m, [`${r.namespace}.${r.key}.${code}`]: value }))}
            />
          ))}
        </ul>
      ) : (
        <p className="nb-card nb-muted nb-m0">{t("texts.none")}</p>
      )}
      {shown.length > limit && (
        <button
          type="button"
          className="nb-btn nb-btn-soft nb-self-center nb-w-auto"
          onClick={() => setLimit(limit + PAGE)}
        >
          {t("texts.more", { n: t.num(shown.length - limit) })}
        </button>
      )}
    </div>
  );
}

function TextRow({
  row,
  locales,
  source,
  valueOf,
  onSaved,
}: {
  row: MessageRow;
  locales: LocaleView[];
  source: string;
  valueOf: (code: string) => string;
  onSaved: (code: string, value: string) => void;
}) {
  const t = useT();
  const [draft, setDraft] = useState<Record<string, string>>({});
  const [note, setNote] = useState<{ ok: boolean; text: string } | null>(null);
  const changed = locales.filter((l) => draft[l.code] !== undefined && draft[l.code] !== valueOf(l.code));
  const want = placeholders(valueOf(source)).join();

  const save = async () => {
    setNote(null);
    for (const l of changed) {
      const value = draft[l.code].trim();
      if (!value) return setNote({ ok: false, text: t("texts.empty") });
      const r = await fetch("/api/v1/admin/messages", {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ namespace: row.namespace, key: row.key, locale: l.code, value }),
      }).catch(() => null);
      if (!r?.ok) return setNote({ ok: false, text: t(r?.status === 400 ? "texts.badPlaceholders" : "texts.failed") });
      onSaved(l.code, value);
    }
    setDraft({});
    setNote({ ok: true, text: t("texts.saved") });
  };

  return (
    <li className="nb-card nb-text-row">
      <div className="nb-spread">
        <code className="nb-text-key" dir="ltr">
          {row.key}
        </code>
        {want && (
          <span className="nb-row nb-text-holes" dir="ltr">
            {placeholders(valueOf(source)).map((p) => (
              <Tag key={p} palette="gray">
                {p}
              </Tag>
            ))}
          </span>
        )}
      </div>
      <div className="nb-text-langs">
        {locales.map((l) => {
          const value = draft[l.code] ?? valueOf(l.code);
          const off = !value.trim() || (value && placeholders(value).join() !== want);
          return (
            <label key={l.code} className="nb-field">
              <span className="nb-label">
                {l.name}
                {!valueOf(l.code).trim() && (
                  <>
                    {" "}
                    <Tag palette="salmon">{t("texts.missingTag")}</Tag>
                  </>
                )}
              </span>
              <textarea
                className="nb-input"
                dir={l.dir}
                lang={l.code}
                rows={Math.min(5, Math.max(1, Math.ceil(value.length / 48)))}
                value={value}
                aria-invalid={off || undefined}
                onChange={(e) => setDraft({ ...draft, [l.code]: e.target.value })}
              />
            </label>
          );
        })}
      </div>
      {(changed.length > 0 || note) && (
        <div className="nb-row nb-center-y">
          {changed.length > 0 && (
            <button type="button" className="nb-btn nb-btn-ok nb-w-auto" onClick={save}>
              {t("admin.save")}
            </button>
          )}
          {note && (
            <span className={note.ok ? "nb-muted" : "nb-error"} role={note.ok ? "status" : "alert"}>
              {note.text}
            </span>
          )}
        </div>
      )}
    </li>
  );
}
