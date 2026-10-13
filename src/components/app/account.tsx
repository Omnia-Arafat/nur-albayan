"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

import { useApp, useT } from "@/components/app/app-data";
import { Icon } from "@/components/book/icon";
import { tokenVar } from "@/components/book/word";
import { active } from "@/modules/progress/local";
import { useDevice } from "@/modules/progress/store";

type Me = {
  viewer: { name: string; roleKey: string; staff: boolean } | null;
  student: { id: string; claimedAt: string | null } | null;
  methods: { email: boolean; local: boolean };
};

export function useMe() {
  const [me, setMe] = useState<Me | null>(null);
  const [tick, setTick] = useState(0);
  useEffect(() => {
    let live = true;
    fetch("/api/v1/me")
      .then((r) => r.json())
      .then((d: Me) => live && setMe(d))
      .catch(() => live && setMe(null));
    return () => {
      live = false;
    };
  }, [tick]);
  return { me, reload: () => setTick((n) => n + 1) };
}

/** Email field that sends a one-time sign-in link (no password). */
export function EmailSignIn({ next }: { next?: string }) {
  const { locale } = useApp();
  const t = useT();
  const [email, setEmail] = useState("");
  const [state, setState] = useState<"idle" | "sending" | "sent" | "failed">("idle");
  const send = async (e: React.FormEvent) => {
    e.preventDefault();
    setState("sending");
    const r = await fetch("/api/v1/auth/email", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ email, locale: locale.code, next }),
    });
    setState(r.ok ? "sent" : "failed");
  };
  if (state === "sent")
    return (
      <p className="nb-band nb-m0" role="status">
        {t("account.sent", { email })}
      </p>
    );
  return (
    <form className="nb-stack nb-email-form" onSubmit={send}>
      <p className="nb-muted nb-m0">{t("account.emailIntro")}</p>
      <label className="nb-field">
        <span className="nb-label">{t("account.email")}</span>
        <input
          className="nb-input"
          type="email"
          dir="ltr"
          autoComplete="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />
      </label>
      {state === "failed" && (
        <p className="nb-error nb-m0" role="alert">
          {t("account.sendFailed")}
        </p>
      )}
      <button type="submit" className="nb-btn nb-btn-soft" disabled={state === "sending"}>
        {state === "sending" ? t("account.sending") : t("account.send")}
      </button>
    </form>
  );
}

/** The profile page's account card: sign in by email, then copy this device's progress into the account. */
export function AccountCard() {
  const t = useT();
  const { me, reload } = useMe();
  const profile = active(useDevice());
  const [upload, setUpload] = useState<{ state: "idle" | "busy" | "done" | "failed"; pages?: number; words?: number }>({
    state: "idle",
  });
  const save = async () => {
    if (!profile) return;
    setUpload({ state: "busy" });
    const r = await fetch("/api/v1/me/progress", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(profile),
    });
    const d = (await r.json().catch(() => ({}))) as { records?: number; words?: number };
    setUpload(r.ok ? { state: "done", pages: d.records, words: d.words } : { state: "failed" });
    reload();
  };
  const signOut = async () => {
    await fetch("/api/v1/auth/session", { method: "DELETE" });
    reload();
  };
  const sky = {
    "--fill": tokenVar("color.pill.sky.fill"),
    "--line": tokenVar("color.pill.sky.line"),
  } as React.CSSProperties;

  return (
    <section className="nb-band nb-anim-rise nb-account" style={sky}>
      <div className="nb-row">
        <Icon name="profile" size={36} tone="sky" />
        <b>{me?.viewer ? t("account.signedIn", { name: me.viewer.name }) : t("profile.account")}</b>
      </div>
      {me?.viewer ? (
        <>
          {profile ? (
            <button type="button" className="nb-btn nb-btn-ok" disabled={upload.state === "busy"} onClick={save}>
              {upload.state === "busy" ? t("account.uploading") : t("account.upload", { name: profile.name })}
            </button>
          ) : (
            <p className="nb-muted nb-m0">{t("account.noProfile")}</p>
          )}
          {upload.state === "done" && (
            <p className="nb-m0" role="status">
              {t("account.uploaded", { pages: t.num(upload.pages ?? 0), words: t.num(upload.words ?? 0) })}
            </p>
          )}
          {upload.state === "failed" && (
            <p className="nb-error nb-m0" role="alert">
              {t("account.uploadFailed")}
            </p>
          )}
          <div className="nb-row nb-row-btns">
            {me.viewer.staff && (
              <Link
                href={t.href(me.viewer.roleKey === "admin" ? "/admin" : "/teacher")}
                className="nb-btn nb-btn-soft nb-w-auto"
              >
                {t("account.toDashboard")}
              </Link>
            )}
            <button type="button" className="nb-btn nb-btn-quiet" onClick={signOut}>
              {t("account.signOut")}
            </button>
          </div>
        </>
      ) : (
        <>
          <p className="nb-muted nb-m0">{t("profile.accountText")}</p>
          {me?.methods.email ? (
            <EmailSignIn />
          ) : (
            <span className="nb-btn nb-btn-quiet" aria-disabled="true">
              {t("profile.accountSoon")}
            </span>
          )}
        </>
      )}
    </section>
  );
}
