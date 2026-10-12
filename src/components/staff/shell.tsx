"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useRef } from "react";

import { useApp, useT } from "@/components/app/app-data";
import { Icon } from "@/components/book/icon";

/** Menu entries name message keys, so the server can pass them without translating. */
export type NavEntry = { group: string } | { path: string; label: string; icon: string };

/** Header and side menu shared by the teacher and admin areas (scrolls sideways on a phone). */
export function StaffShell({
  title,
  viewer,
  nav,
  children,
}: {
  title: string;
  viewer: { displayName: string; roleLabel: string };
  nav: NavEntry[];
  children: React.ReactNode;
}) {
  const { locale, locales } = useApp();
  const t = useT();
  const router = useRouter();
  const path = usePathname();
  const rest = path.replace(new RegExp(`^/${locale.code}`), "");
  const links = nav.filter((n): n is Extract<NavEntry, { path: string }> => "path" in n);
  const current = links
    .filter((n) => rest === n.path || rest.startsWith(`${n.path}/`))
    .sort((a, b) => b.path.length - a.path.length)[0];
  const menu = useRef<HTMLElement>(null);
  useEffect(() => {
    menu.current
      ?.querySelector('[aria-current="page"]')
      ?.scrollIntoView({ behavior: "smooth", inline: "center", block: "nearest" });
  }, [current?.path]);

  const signOut = async () => {
    await fetch("/api/v1/auth/local", { method: "DELETE" });
    router.push(t.href(""));
    router.refresh();
  };

  return (
    <>
      <header className="nb-header nb-staff-header" role="banner">
        <Link href={t.href("")} className="nb-brand" style={{ textDecoration: "none" }}>
          <span className="nb-logo">
            <Icon name="book" size={30} />
          </span>
          <span className="nb-brand-text">
            <span className="nb-brand-name">{t("brand.name")}</span>
            <span className="nb-brand-tag nb-staff-tag">{t(title)}</span>
          </span>
        </Link>
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
          <span className="nb-profile nb-staff-who">
            <span className="nb-avatar nb-staff-avatar" aria-hidden="true">
              <span className="nb-avatar-letter">{Array.from(viewer.displayName)[0]}</span>
            </span>
            <span className="nb-profile-text">
              <span className="nb-profile-name">{viewer.displayName}</span>
              <span className="nb-profile-sub">{viewer.roleLabel}</span>
            </span>
          </span>
          <button type="button" className="nb-btn nb-btn-quiet" onClick={signOut}>
            {t("staff.signOut")}
          </button>
        </div>
      </header>
      <main className="nb-page nb-staff-page">
        <div className="nb-dash">
          <nav className="nb-sidenav" aria-label={t("staff.menu")} ref={menu}>
            {nav.map((n, i) =>
              "group" in n ? (
                <span key={i} className="group">
                  {t(n.group)}
                </span>
              ) : (
                <Link
                  key={n.path}
                  href={t.href(n.path)}
                  aria-current={n === current ? "page" : undefined}
                  className="nb-tr-state"
                >
                  <Icon name={n.icon} size={24} tone={n === current ? undefined : "gray"} />
                  {t(n.label)}
                </Link>
              ),
            )}
          </nav>
          <div className="nb-col-main">{children}</div>
        </div>
      </main>
    </>
  );
}
