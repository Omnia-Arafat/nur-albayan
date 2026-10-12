"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";

import { useApp, useT } from "@/components/app/app-data";
import { Icon } from "@/components/book/icon";
import { Tag } from "@/components/book/parts";
import { Pill } from "@/components/book/word";
import { paletteOf } from "@/components/screens/page-view";
import { parseItem } from "@/modules/book/item-dsl";

type EditPage = NonNullable<Awaited<ReturnType<typeof import("@/modules/content/editor").pageForEdit>>>;

/** The book is Arabic: its titles and notes are edited in Arabic, whatever the editor's UI language. */
const BOOK_LOCALE = "ar";
const STATUS_PALETTE: Record<string, string> = { draft: "yellow", review: "sky", published: "lime", archived: "gray" };

const tryParse = (source: string) => {
  try {
    return parseItem(source);
  } catch {
    return null;
  }
};

export function PageEditor({ page }: { page: EditPage }) {
  const t = useT();
  const { catalog } = useApp();
  const router = useRouter();
  const book = page.i18n[BOOK_LOCALE] ?? { title: "", subtitle: null, teacherNote: null };
  const [title, setTitle] = useState(book.title);
  const [subtitle, setSubtitle] = useState(book.subtitle ?? "");
  const [note, setNote] = useState(book.teacherNote ?? "");
  const original = useMemo(
    () => new Map(page.sections.flatMap((s) => s.items.map((i) => [i.id, i.source] as const))),
    [page],
  );
  const [sources, setSources] = useState<Map<string, string>>(original);
  const [message, setMessage] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const changedItems = [...sources].filter(([id, src]) => original.get(id) !== src);
  const invalid = changedItems.filter(([, src]) => !tryParse(src)).map(([id]) => id);

  const save = async (status?: string) => {
    setBusy(true);
    setMessage(null);
    const r = await fetch(`/api/v1/admin/lessons/${page.bookPage}`, {
      method: "PUT",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        ...(status ? { status } : {}),
        i18n: { [BOOK_LOCALE]: { title, subtitle: subtitle || null, teacherNote: note || null } },
        items: changedItems.map(([id, source]) => ({ id, source })),
      }),
    });
    setBusy(false);
    const out = (await r.json().catch(() => ({}))) as { changed?: boolean; version?: number; title?: string };
    if (!r.ok) return setMessage(t("admin.saveFailed", { error: out.title ?? r.status }));
    setMessage(out.changed ? t("admin.saved", { n: t.num(out.version ?? page.version) }) : t("admin.noChange"));
    router.refresh();
  };

  return (
    <div className="nb-cols nb-staff-cols">
      <div className="nb-col-main">
        <section className="nb-card nb-anim-rise">
          <div className="nb-spread">
            <div className="nb-grow">
              <h1 className="nb-h1 nb-book-text" lang="ar">
                {t("admin.pageTitle", { page: page.bookPage, title })}
              </h1>
              <p className="nb-muted nb-m0">{t("admin.howTo")}</p>
            </div>
            <div className="nb-row">
              <Tag palette={STATUS_PALETTE[page.status] ?? "gray"}>{t(`admin.status.${page.status}`)}</Tag>
              <span className="nb-muted nb-small">{t("admin.version", { n: t.num(page.version) })}</span>
            </div>
          </div>
          <div className="nb-grid nb-grid-220">
            <label className="nb-field">
              <span className="nb-label">{t("admin.title")}</span>
              <input
                className="nb-input nb-input-book"
                lang="ar"
                dir="rtl"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
              />
            </label>
            <label className="nb-field">
              <span className="nb-label">{t("admin.subtitle")}</span>
              <input
                className="nb-input nb-input-book"
                lang="ar"
                dir="rtl"
                value={subtitle}
                onChange={(e) => setSubtitle(e.target.value)}
              />
            </label>
          </div>
          <label className="nb-field">
            <span className="nb-label">{t("admin.note")}</span>
            <textarea
              className="nb-input nb-scroll"
              lang="ar"
              dir="rtl"
              rows={4}
              value={note}
              onChange={(e) => setNote(e.target.value)}
            />
          </label>
          <div className="nb-row nb-row-btns">
            <button
              type="button"
              className="nb-btn nb-btn-soft nb-w-auto"
              disabled={busy || invalid.length > 0}
              onClick={() => save()}
            >
              {t("admin.save")}
            </button>
            {page.status !== "review" && (
              <button
                type="button"
                className="nb-btn nb-btn-soft nb-w-auto"
                disabled={busy || invalid.length > 0}
                onClick={() => save("review")}
              >
                {t("admin.toReview")}
              </button>
            )}
            {page.status !== "published" && (
              <button
                type="button"
                className="nb-btn nb-btn-ok nb-w-auto"
                disabled={busy || invalid.length > 0}
                onClick={() => save("published")}
              >
                {t("admin.publish")}
              </button>
            )}
            <Link href={t.href(`/lesson/${page.bookPage}`)} className="nb-btn nb-btn-quiet" target="_blank">
              {t("admin.preview")}
            </Link>
          </div>
          {message && (
            <p className="nb-muted nb-m0" role="status">
              {message}
            </p>
          )}
        </section>
        {page.sections
          .filter((s) => s.items.length)
          .map((s) => {
            const bands = [...new Set(s.items.map((i) => i.rowBand))];
            return (
              <section key={s.id} className="nb-card nb-anim-rise">
                <div className="nb-spread">
                  <h2 className="nb-h2">{t("admin.words")}</h2>
                  {s.label && (
                    <span className="nb-muted nb-book-text" lang="ar">
                      {s.label}
                    </span>
                  )}
                </div>
                {bands.map((band, ri) => (
                  <div key={band} className="nb-erow">
                    <span className="nb-label">{t("admin.row", { n: t.num(ri + 1) })}</span>
                    <div
                      className="nb-edit-grid"
                      style={
                        { "--cols": Number((s.config as { columns?: number }).columns ?? 4) } as React.CSSProperties
                      }
                    >
                      {s.items
                        .map((it, idx) => ({ it, idx }))
                        .filter(({ it }) => it.rowBand === band)
                        .map(({ it, idx }) => {
                          const src = sources.get(it.id) ?? "";
                          const parsed = tryParse(src);
                          return (
                            <div key={it.id} className="nb-ecell">
                              {parsed ? (
                                <Pill
                                  segments={parsed.segments}
                                  script={it.script}
                                  palette={paletteOf(s, it, idx, catalog.palette)}
                                  size={24}
                                />
                              ) : (
                                <span className="nb-pill nb-pill-invalid" role="alert">
                                  {t("admin.invalid")}
                                </span>
                              )}
                              <input
                                className="nb-input nb-input-book"
                                dir="rtl"
                                lang="ar"
                                aria-label={t("admin.itemLabel")}
                                aria-invalid={!parsed}
                                value={src}
                                onChange={(e) => setSources(new Map(sources).set(it.id, e.target.value))}
                              />
                            </div>
                          );
                        })}
                    </div>
                  </div>
                ))}
              </section>
            );
          })}
      </div>
      <aside className="nb-col-side">
        <section className="nb-card nb-scan">
          <h2 className="nb-h2">{t("admin.scan")}</h2>
          <div className="nb-scan-empty">
            <Icon name="book" size={48} tone="gray" />
            <p className="nb-muted nb-m0 nb-center">{t("admin.noScan")}</p>
          </div>
          <p className="nb-muted nb-m0">{t("admin.compare")}</p>
        </section>
      </aside>
    </div>
  );
}
