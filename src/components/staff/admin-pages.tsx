"use client";

import Link from "next/link";

import { useT } from "@/components/app/app-data";
import { Tag } from "@/components/book/parts";
import { tokenVar } from "@/components/book/word";
import type { LessonListItem } from "@/modules/content/service";

/** Pill palette for each content status tag. */
const STATUS_PALETTE: Record<string, string> = { draft: "yellow", review: "sky", published: "lime", archived: "gray" };

export function AdminPages({ lessons }: { lessons: LessonListItem[] }) {
  const t = useT();
  const stages = [...new Set(lessons.map((l) => l.stagePosition))];
  return (
    <div className="nb-stack-lg">
      <section className="nb-card nb-anim-rise">
        <h1 className="nb-h1">{t("admin.pagesTitle")}</h1>
        <p className="nb-sub">{t("admin.pagesIntro")}</p>
      </section>
      {stages.map((sp) => {
        const pages = lessons.filter((l) => l.stagePosition === sp);
        return (
          <section key={sp} className="nb-card nb-anim-rise">
            <h2 className="nb-h2 nb-book-text">{pages[0]?.stageTitle}</h2>
            <ul className="nb-plain nb-review-list">
              {pages.map((l) => (
                <li key={l.slug}>
                  <Link href={t.href(`/admin/pages/${l.bookPage}`)} className="nb-review-row nb-tr-press">
                    <span
                      className="nb-review-page"
                      style={
                        { "--fill": tokenVar("color.paper"), "--line": tokenVar("color.border") } as React.CSSProperties
                      }
                    >
                      {t.num(l.bookPage)}
                    </span>
                    <span className="nb-review-text">
                      <b className="nb-book-text" lang="ar">
                        {l.title}
                      </b>
                      {l.subtitle && (
                        <span className="nb-muted nb-small" lang="ar">
                          {l.subtitle}
                        </span>
                      )}
                    </span>
                    <Tag palette={STATUS_PALETTE[l.status] ?? "gray"}>{t(`admin.status.${l.status}`)}</Tag>
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        );
      })}
    </div>
  );
}
