"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef } from "react";

import { Icon } from "@/components/book/icon";
import { tokenVar } from "@/components/book/word";
import { active, levelOf, streakOf, totalStars, xpOf } from "@/modules/progress/local";
import { useDevice } from "@/modules/progress/store";

import { useApp, useT, xpRates } from "./app-data";

/** Sections in the header's tab strip: route, label key and icon. */
const TABS = [
  { path: "", key: "nav.journey", icon: "journey" },
  { path: "/games", key: "nav.games", icon: "cards" },
  { path: "/review", key: "nav.review", icon: "review" },
  { path: "/mistakes", key: "nav.mistakes", icon: "box" },
  { path: "/badges", key: "nav.badges", icon: "crown" },
  { path: "/profile", key: "nav.profile", icon: "profile" },
];

export function Header() {
  const { locale, locales, catalog } = useApp();
  const t = useT();
  const path = usePathname();
  const rest = path.replace(new RegExp(`^/${locale.code}`), "");
  const current = TABS.filter((x) =>
    x.path === "" ? rest === "" || rest.startsWith("/lesson") : rest.startsWith(x.path),
  ).at(-1);
  const strip = useRef<HTMLElement>(null);
  const device = useDevice();
  const me = active(device);
  const rules = catalog.scoring;
  const level = me && rules ? levelOf(catalog.levels, xpOf(me, rules, xpRates(catalog))).current : catalog.levels[0];

  useEffect(() => {
    strip.current
      ?.querySelector('[aria-current="page"]')
      ?.scrollIntoView({ behavior: "smooth", inline: "center", block: "nearest" });
  }, [current?.path]);

  return (
    <header className="nb-header" role="banner">
      <Link href={t.href("")} className="nb-brand" style={{ textDecoration: "none" }}>
        <span className="nb-logo">
          <Icon name="book" size={30} />
        </span>
        <span className="nb-brand-text">
          <span className="nb-brand-name">{t("brand.name")}</span>
          <span className="nb-brand-tag">{t("brand.tagline")}</span>
        </span>
      </Link>
      <div className="nb-stats" role="list" aria-label={t("stats.label")}>
        <span role="listitem" className="nb-stat nb-stat-stars">
          <span className="nb-anim-twinkle nb-flex">
            <Icon name="star" size={22} />
          </span>
          <b>{t.num(me ? totalStars(me) : 0)}</b>
          <span className="nb-stat-label">{t("stats.stars")}</span>
        </span>
        <span role="listitem" className="nb-stat nb-stat-days">
          <span className="nb-anim-flicker nb-flex">
            <Icon name="candle" size={22} />
          </span>
          <b>{t.num(me ? streakOf(me) : 0)}</b>
          <span className="nb-stat-label">{t("stats.days")}</span>
        </span>
        <span role="listitem" className="nb-stat nb-stat-level">
          <span className="nb-level">{t.num(level?.position ?? 1)}</span>
          <span className="nb-stat-label">{t("stats.level")}</span>
        </span>
      </div>
      <div className="nb-tools">
        <div className="nb-lang" role="group" aria-label={t("lang.label")}>
          {locales.map((l) => (
            <Link
              key={l.code}
              href={`/${l.code}${rest}`}
              aria-pressed={l.code === locale.code}
              lang={l.code}
              hrefLang={l.code}
            >
              {l.name}
            </Link>
          ))}
        </div>
        <Link
          href={t.href("/profile")}
          className="nb-profile"
          aria-label={t("profile.aria", { name: me?.name ?? t("profile.chip") })}
        >
          <Avatar profile={me} level={level?.position ?? 1} />
          <span className="nb-profile-text">
            <span className="nb-profile-name">{me?.name ?? t("profile.chip")}</span>
            <span className="nb-profile-sub">{t("profile.noAccount")}</span>
          </span>
        </Link>
      </div>
      <nav className="nb-tabs" aria-label={t("nav.label")} ref={strip}>
        {TABS.map((x) => {
          const on = x === current;
          return (
            <Link
              key={x.key}
              href={t.href(x.path)}
              className="nb-tab nb-tr-state nb-tr-press"
              aria-current={on ? "page" : undefined}
            >
              <span className={`nb-tab-icon${on ? " nb-anim-select" : ""}`}>
                <Icon name={x.icon} size={24} tone={on ? undefined : "gray"} />
              </span>
              <span>{t(x.key)}</span>
            </Link>
          );
        })}
      </nav>
    </header>
  );
}

/** The learner's letter tile (or book icon) in their colour, with the level badge. */
export function Avatar({
  profile,
  level,
  big,
}: {
  profile: { avatar: { kind: string; value: string }; colorTokenKey: string } | null;
  level?: number;
  big?: boolean;
}) {
  const t = useT();
  const colour = profile ? tokenVar(profile.colorTokenKey) : undefined;
  return (
    <span
      className={big ? "nb-big-avatar" : "nb-avatar"}
      style={colour ? ({ "--c": colour } as React.CSSProperties) : undefined}
      data-filled={profile ? "" : undefined}
    >
      {profile?.avatar.kind === "icon" ? (
        <Icon name={profile.avatar.value} size={big ? 40 : 24} />
      ) : (
        <span className="nb-avatar-letter">{profile?.avatar.value ?? ""}</span>
      )}
      {level !== undefined && (
        <span className="nb-avatar-level" aria-hidden="true">
          {t.num(level)}
        </span>
      )}
    </span>
  );
}
