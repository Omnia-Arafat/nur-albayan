"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import { useT } from "@/components/app/app-data";
import { Seg } from "@/components/book/controls";
import { Icon } from "@/components/book/icon";
import { Ribbon, Tag } from "@/components/book/parts";
import { Pill } from "@/components/book/word";
import { cssVar } from "@/modules/theme/css";
import type { ThemeColours } from "@/modules/admin/service";

type Run = { text: string; role: string };
const HEX = /^#[0-9A-Fa-f]{6}$/;

/** The book's colours for day and night, each editable, with a sample page painted in the colours as typed. */
export function AdminDesign({ themes, sample }: { themes: ThemeColours[]; sample: Run[][] }) {
  const t = useT();
  const [slug, setSlug] = useState(themes[0]?.slug ?? "");
  const [draft, setDraft] = useState<Record<string, string>>({});
  const theme = themes.find((x) => x.slug === slug) ?? themes[0];
  if (!theme) return null;
  const valueOf = (key: string) =>
    draft[`${theme.slug}:${key}`] ?? theme.tokens.find((x) => x.key === key)?.value ?? "";
  const vars = Object.fromEntries(
    theme.tokens.map((x) => {
      const v = valueOf(x.key);
      return [cssVar(x.key), HEX.test(v) ? v : x.value];
    }),
  ) as React.CSSProperties;
  const pills = [
    ...new Set(theme.tokens.map((x) => x.key.match(/^color\.pill\.([a-z]+)\./)?.[1]).filter(Boolean)),
  ] as string[];
  const base = theme.tokens.filter((x) => !x.key.startsWith("color.pill."));
  // Every colour the theme already uses, to pick from instead of typing.
  const swatches = [...new Set(theme.tokens.map((x) => x.value.toUpperCase()))];
  // A colour's name from the texts when it has one, else the note the theme file gives it.
  const nameOf = (key: string, note: string | null) => {
    const pill = key.match(/^color\.pill\.([a-z]+)\.(fill|line)$/);
    if (pill) {
      const name = t.has(`palette.${pill[1]}`) ? t(`palette.${pill[1]}`) : pill[1];
      return t(`colour.${pill[2]}`, { name });
    }
    const id = `colour.${key.replace(/^color\./, "")}`;
    return t.has(id) ? t(id) : (note ?? key);
  };

  return (
    <div className="nb-cols nb-staff-cols nb-design-cols">
      <div className="nb-col-main nb-stack-lg">
        <section className="nb-card nb-anim-rise">
          <h1 className="nb-h1">{t("design.title")}</h1>
          <p className="nb-sub">{t("design.intro")}</p>
          <Seg
            label={t("design.theme")}
            wide
            value={theme.slug}
            onChange={setSlug}
            options={themes.map((x) => ({
              value: x.slug,
              label: t(x.mode === "dark" ? "design.night" : "design.day"),
            }))}
          />
        </section>
        <section className="nb-card nb-anim-rise">
          <h2 className="nb-h2">{t("design.base")}</h2>
          <ul className="nb-plain nb-colours">
            {base.map((x) => (
              <ColourRow
                key={`${theme.slug}:${x.key}`}
                theme={theme.slug}
                tokenKey={x.key}
                label={nameOf(x.key, x.description)}
                saved={x.value}
                value={valueOf(x.key)}
                swatches={swatches}
                onDraft={(v) => setDraft({ ...draft, [`${theme.slug}:${x.key}`]: v })}
              />
            ))}
          </ul>
        </section>
        <section className="nb-card nb-anim-rise">
          <h2 className="nb-h2">{t("design.pills")}</h2>
          <ul className="nb-plain nb-colours">
            {pills.flatMap((p) =>
              ["fill", "line"].map((part) => {
                const key = `color.pill.${p}.${part}`;
                const tok = theme.tokens.find((x) => x.key === key);
                if (!tok) return null;
                return (
                  <ColourRow
                    key={`${theme.slug}:${key}`}
                    theme={theme.slug}
                    tokenKey={key}
                    label={nameOf(key, tok.description)}
                    saved={tok.value}
                    value={valueOf(key)}
                    swatches={swatches}
                    onDraft={(v) => setDraft({ ...draft, [`${theme.slug}:${key}`]: v })}
                  />
                );
              }),
            )}
          </ul>
        </section>
      </div>
      <aside className="nb-col-side">
        <section className="nb-card nb-design-preview" style={vars} aria-label={t("design.preview")}>
          <h2 className="nb-h2">{t("design.preview")}</h2>
          <div className="nb-design-sample">
            <Ribbon colour="color.teal.deep">{t("design.sampleTag")}</Ribbon>
            <p className="nb-m0 nb-muted nb-design-text">{t("design.sampleText")}</p>
            <div className="nb-row nb-design-pills">
              {sample.map((segments, i) => (
                <Pill key={i} segments={segments} palette={pills[i % pills.length] ?? "yellow"} size={28} />
              ))}
            </div>
            <div className="nb-row nb-design-tags">
              <Tag palette="lime">
                <Icon name="star" size={18} tone="yellow" /> {t.num(3)}
              </Tag>
              <Tag palette="salmon">{t("design.sampleMiss")}</Tag>
            </div>
            <button type="button" className="nb-btn nb-btn-ok" tabIndex={-1}>
              {t("design.sampleButton")}
            </button>
          </div>
        </section>
      </aside>
    </div>
  );
}

function ColourRow({
  theme,
  tokenKey,
  label,
  saved,
  value,
  swatches,
  onDraft,
}: {
  theme: string;
  tokenKey: string;
  label: string;
  saved: string;
  value: string;
  swatches: string[];
  onDraft: (v: string) => void;
}) {
  const t = useT();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [note, setNote] = useState<{ ok: boolean; text: string } | null>(null);
  const valid = HEX.test(value);
  const changed = value.toUpperCase() !== saved.toUpperCase();
  const save = async () => {
    setNote(null);
    const r = await fetch("/api/v1/admin/colours", {
      method: "PUT",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ theme, key: tokenKey, value }),
    }).catch(() => null);
    if (!r?.ok) return setNote({ ok: false, text: t("design.failed") });
    setNote({ ok: true, text: t("design.saved") });
    router.refresh();
  };
  return (
    <li className="nb-colour">
      <button
        type="button"
        className="nb-colour-chip nb-tr-press"
        style={{ background: valid ? value : saved }}
        aria-label={t("design.pick", { name: label })}
        aria-expanded={open}
        onClick={() => setOpen(!open)}
      />
      <span className="nb-colour-text">
        <b>{label}</b>
        <code dir="ltr">{tokenKey}</code>
      </span>
      <input
        className="nb-input nb-colour-hex"
        dir="ltr"
        value={value}
        maxLength={7}
        spellCheck={false}
        aria-label={t("design.hex", { name: label })}
        aria-invalid={!valid || undefined}
        onChange={(e) => onDraft(e.target.value.trim().replace(/^([0-9A-Fa-f])/, "#$1"))}
      />
      {open && (
        <div className="nb-colour-swatches" role="group" aria-label={t("design.swatches")}>
          {swatches.map((c) => (
            <button
              key={c}
              type="button"
              className={`nb-colour-swatch${c === value.toUpperCase() ? " on" : ""}`}
              style={{ background: c }}
              aria-label={c}
              aria-pressed={c === value.toUpperCase()}
              onClick={() => onDraft(c)}
            />
          ))}
        </div>
      )}
      {(changed || note) && (
        <div className="nb-row nb-center-y nb-colour-act">
          {changed && (
            <>
              <button type="button" className="nb-btn nb-btn-ok nb-w-auto" disabled={!valid} onClick={save}>
                {t("admin.save")}
              </button>
              <button type="button" className="nb-btn nb-btn-quiet" onClick={() => onDraft(saved)}>
                {t("design.undo")}
              </button>
            </>
          )}
          {!valid && <span className="nb-error">{t("design.bad")}</span>}
          {note && !changed && (
            <span className={note.ok ? "nb-muted" : "nb-error"} role={note.ok ? "status" : "alert"}>
              {note.text}
            </span>
          )}
        </div>
      )}
    </li>
  );
}
