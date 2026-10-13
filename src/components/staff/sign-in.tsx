"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";

import { type Methods, SignInForm } from "@/components/app/account";
import { useT } from "@/components/app/app-data";
import { Icon } from "@/components/book/icon";

/** Staff sign-in. On the local database it lists the sample accounts; with Supabase it offers email (password or link) and any social providers. */
export function SignIn({
  local,
  methods,
  people,
  denied,
  failed,
}: {
  local: boolean;
  methods: Methods;
  failed: boolean;
  people: { id: string; name: string; roleKey: string }[];
  denied: boolean;
}) {
  const t = useT();
  const router = useRouter();
  const [busy, setBusy] = useState<string | null>(null);
  const go = async (p: (typeof people)[number]) => {
    setBusy(p.id);
    const r = await fetch("/api/v1/auth/local", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ profileId: p.id }),
    });
    setBusy(null);
    if (r.ok) {
      router.push(t.href(p.roleKey === "admin" ? "/admin" : "/teacher"));
      router.refresh();
    }
  };
  return (
    <main className="nb-page nb-narrow nb-sign-in">
      <Link href={t.href("")} className="nb-brand nb-self-start" style={{ textDecoration: "none" }}>
        <span className="nb-logo">
          <Icon name="book" size={30} />
        </span>
        <span className="nb-brand-name">{t("brand.name")}</span>
      </Link>
      <section className="nb-card nb-anim-rise">
        <h1 className="nb-h1">{t("signIn.title")}</h1>
        <p className="nb-sub">{t("signIn.intro")}</p>
        {denied && <p className="nb-band nb-band-danger nb-m0">{t("signIn.denied")}</p>}
        {failed && <p className="nb-band nb-band-danger nb-m0">{t("account.failed")}</p>}
        <SignInForm
          methods={methods}
          next={t.href("/teacher")}
          onSignedIn={() => {
            router.push(t.href("/teacher"));
            router.refresh();
          }}
        />
        {local ? (
          <>
            <p className="nb-muted nb-m0">{t("signIn.local")}</p>
            <div className="nb-people">
              {people.map((p) => (
                <button
                  key={p.id}
                  type="button"
                  className="nb-person nb-tr-press"
                  disabled={busy !== null}
                  aria-label={t("signIn.as", { name: p.name })}
                  onClick={() => go(p)}
                >
                  <span className="nb-big-avatar nb-staff-avatar" aria-hidden="true">
                    <span className="nb-avatar-letter">{Array.from(p.name)[0]}</span>
                  </span>
                  <b>{p.name}</b>
                  <span className="nb-muted">{t(p.roleKey === "admin" ? "staff.admin" : "staff.teacher")}</span>
                </button>
              ))}
            </div>
          </>
        ) : (
          !methods.email && <p className="nb-muted nb-m0">{t("signIn.soon")}</p>
        )}
        <Link href={t.href("")} className="nb-btn nb-btn-quiet nb-self-start">
          {t("staff.toApp")}
        </Link>
      </section>
    </main>
  );
}
