"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

import { useApp, useT } from "@/components/app/app-data";
import { Seg } from "@/components/book/controls";
import { Icon } from "@/components/book/icon";
import { tokenVar } from "@/components/book/word";
import { active } from "@/modules/progress/local";
import { useDevice } from "@/modules/progress/store";

import { bringToDevice, syncProfile } from "./sync";

export type Methods = { email: boolean; local: boolean; social: string[]; student: boolean };

type Me = {
  viewer: { name: string; roleKey: string; staff: boolean } | null;
  student: { id: string; claimedAt: string | null } | null;
  methods: Methods;
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

type Reason = "wrong" | "unconfirmed" | "taken" | "weak" | "failed";
const REASON_KEY: Record<Reason, string> = {
  wrong: "account.wrongPassword",
  unconfirmed: "account.unconfirmed",
  taken: "account.taken",
  weak: "account.weakPassword",
  failed: "account.sendFailed",
};

/** Email and password, to sign in or to create an account. */
function PasswordSignIn({ next, onSignedIn }: { next?: string; onSignedIn: () => void }) {
  const { locale } = useApp();
  const t = useT();
  const [mode, setMode] = useState<"signIn" | "signUp">("signIn");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [state, setState] = useState<{ busy?: boolean; reason?: Reason; confirm?: boolean }>({});
  const send = async (e: React.FormEvent) => {
    e.preventDefault();
    setState({ busy: true });
    const r = await fetch("/api/v1/auth/password", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ mode, email, password, locale: locale.code, next }),
    });
    const d = (await r.json().catch(() => ({}))) as { signedIn?: boolean; detail?: { reason?: Reason } };
    if (r.ok && d.signedIn) return onSignedIn();
    setState(r.ok ? { confirm: true } : { reason: d.detail?.reason ?? (r.status === 400 ? "weak" : "failed") });
  };
  if (state.confirm)
    return (
      <p className="nb-band nb-m0" role="status">
        {t("account.confirm", { email })}
      </p>
    );
  return (
    <form className="nb-stack nb-email-form" onSubmit={send}>
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
      <label className="nb-field">
        <span className="nb-label">{t("account.password")}</span>
        <input
          className="nb-input"
          type="password"
          dir="ltr"
          autoComplete={mode === "signIn" ? "current-password" : "new-password"}
          minLength={8}
          maxLength={72}
          required
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />
        {mode === "signUp" && <span className="nb-muted nb-small">{t("account.passwordHint")}</span>}
      </label>
      {state.reason && (
        <p className="nb-error nb-m0" role="alert">
          {t(REASON_KEY[state.reason])}
        </p>
      )}
      <button type="submit" className="nb-btn nb-btn-ok" disabled={state.busy}>
        {state.busy ? t("account.busy") : t(mode === "signIn" ? "account.signInAction" : "account.signUpAction")}
      </button>
      <button
        type="button"
        className="nb-btn nb-btn-quiet"
        onClick={() => {
          setMode(mode === "signIn" ? "signUp" : "signIn");
          setState({});
        }}
      >
        {t(mode === "signIn" ? "account.newAccount" : "account.haveAccount")}
      </button>
    </form>
  );
}

/** Buttons for providers such as Google; the provider's page opens in this tab and returns to /auth/callback. */
function SocialSignIn({ providers, next }: { providers: string[]; next?: string }) {
  const { locale } = useApp();
  const t = useT();
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);
  const go = async (provider: string) => {
    setBusy(true);
    setFailed(false);
    const r = await fetch("/api/v1/auth/oauth", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ provider, locale: locale.code, next }),
    });
    const d = (await r.json().catch(() => ({}))) as { url?: string };
    if (r.ok && d.url) window.location.assign(d.url);
    else {
      setBusy(false);
      setFailed(true);
    }
  };
  return (
    <div className="nb-stack">
      {providers.map((p) => (
        <button
          key={p}
          type="button"
          className={`nb-social nb-social-${p} nb-tr-state nb-tr-press`}
          disabled={busy}
          onClick={() => go(p)}
        >
          {/* The provider's own mark, as its brand rules require; the only logo outside the book's icon set. */}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={`/brand/${p}-g.svg`} alt="" width={20} height={20} />
          <span>{t(`account.with.${p}`)}</span>
        </button>
      ))}
      {failed && (
        <p className="nb-error nb-m0" role="alert">
          {t("account.failed")}
        </p>
      )}
    </div>
  );
}

/** A class student: the class code from the teacher, their username and PIN. */
export function StudentSignIn({ onSignedIn }: { onSignedIn: () => void }) {
  const t = useT();
  const [form, setForm] = useState({ joinCode: "", username: "", pin: "" });
  const [state, setState] = useState<{ busy?: boolean; error?: "wrong" | "locked" }>({});
  const field = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm({ ...form, [k]: k === "pin" ? e.target.value.replace(/\D/g, "") : e.target.value });
  const send = async (e: React.FormEvent) => {
    e.preventDefault();
    setState({ busy: true });
    const r = await fetch("/api/v1/auth/student", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(form),
    });
    if (r.ok) return onSignedIn();
    setState({ error: r.status === 429 ? "locked" : "wrong" });
  };
  return (
    <form className="nb-stack nb-email-form" onSubmit={send}>
      <p className="nb-muted nb-m0">{t("student.intro")}</p>
      <label className="nb-field">
        <span className="nb-label">{t("student.code")}</span>
        <input
          className="nb-input nb-input-code"
          dir="ltr"
          autoComplete="off"
          autoCapitalize="characters"
          required
          minLength={4}
          maxLength={12}
          value={form.joinCode}
          onChange={field("joinCode")}
        />
      </label>
      <label className="nb-field">
        <span className="nb-label">{t("student.username")}</span>
        <input
          className="nb-input"
          dir="ltr"
          autoComplete="username"
          autoCapitalize="none"
          required
          maxLength={40}
          value={form.username}
          onChange={field("username")}
        />
      </label>
      <label className="nb-field">
        <span className="nb-label">{t("student.pin")}</span>
        <input
          className="nb-input nb-input-code"
          type="password"
          inputMode="numeric"
          dir="ltr"
          autoComplete="current-password"
          required
          minLength={4}
          maxLength={6}
          value={form.pin}
          onChange={field("pin")}
        />
      </label>
      {state.error && (
        <p className="nb-error nb-m0" role="alert">
          {t(state.error === "locked" ? "student.locked" : "student.wrong")}
        </p>
      )}
      <button type="submit" className="nb-btn nb-btn-ok" disabled={state.busy}>
        {state.busy ? t("account.busy") : t("account.signInAction")}
      </button>
    </form>
  );
}

/** Every sign-in this site offers: providers first, then email with a password or with a one-time link. */
export function SignInForm({ methods, next, onSignedIn }: { methods: Methods; next?: string; onSignedIn: () => void }) {
  const t = useT();
  const [way, setWay] = useState<"password" | "link">("password");
  if (!methods.email) return null;
  return (
    <div className="nb-stack nb-sign-in-form">
      {methods.social.length > 0 && (
        <>
          <SocialSignIn providers={methods.social} next={next} />
          <p className="nb-or nb-m0" aria-hidden="true">
            <span>{t("account.or")}</span>
          </p>
        </>
      )}
      <Seg
        label={t("account.way")}
        wide
        value={way}
        onChange={setWay}
        options={[
          { value: "password", label: t("account.way.password") },
          { value: "link", label: t("account.way.link") },
        ]}
      />
      {way === "password" ? <PasswordSignIn next={next} onSignedIn={onSignedIn} /> : <EmailSignIn next={next} />}
    </div>
  );
}

/** The profile page's account card: sign in, then keep this device's profile saved in the account. */
export function AccountCard() {
  const t = useT();
  const { locale } = useApp();
  const { me, reload } = useMe();
  const device = useDevice();
  const profile = active(device);
  const [state, setState] = useState<"idle" | "busy" | "failed">("idle");
  const mine = Boolean(profile?.link && me?.student && profile.link.studentId === me.student.id);
  const elsewhere = Boolean(profile?.link && me?.student && profile.link.studentId !== me.student.id);
  const run = async (job: () => Promise<boolean>) => {
    setState("busy");
    const ok = await job();
    setState(ok ? "idle" : "failed");
    reload();
  };
  const time = new Intl.DateTimeFormat(`${locale.code}-u-nu-${locale.numberingSystem}`, {
    dateStyle: "medium",
    timeStyle: "short",
  });
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
          {mine && profile?.link ? (
            <div className="nb-stack">
              <p className="nb-row nb-m0" role="status">
                <Icon name="check" size={22} tone="lime" /> {t("account.autoOn", { name: profile.name })}
              </p>
              <p className="nb-muted nb-small nb-m0">
                {t("account.lastSaved", { time: time.format(new Date(profile.link.at)) })}
              </p>
              <button
                type="button"
                className="nb-btn nb-btn-soft nb-self-start nb-w-auto"
                disabled={state === "busy"}
                onClick={() => run(() => syncProfile(profile))}
              >
                {state === "busy" ? t("account.uploading") : t("account.syncNow")}
              </button>
            </div>
          ) : elsewhere ? (
            <p className="nb-muted nb-m0">{t("account.linkedElse", { name: profile?.name ?? "" })}</p>
          ) : profile ? (
            <>
              <p className="nb-muted nb-m0">{t("account.keepText")}</p>
              <button
                type="button"
                className="nb-btn nb-btn-ok"
                disabled={state === "busy"}
                onClick={() => run(() => syncProfile(profile))}
              >
                {state === "busy" ? t("account.uploading") : t("account.keep", { name: profile.name })}
              </button>
            </>
          ) : me.student ? (
            <button
              type="button"
              className="nb-btn nb-btn-ok"
              disabled={state === "busy"}
              onClick={() => run(() => bringToDevice(device))}
            >
              {state === "busy" ? t("account.uploading") : t("account.bring")}
            </button>
          ) : (
            <p className="nb-muted nb-m0">{t("account.noProfile")}</p>
          )}
          {state === "failed" && (
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
          {me?.methods.student && (
            <Link href={t.href("/sign-in?as=student")} className="nb-btn nb-btn-quiet nb-self-start">
              {t("student.link")}
            </Link>
          )}
          {me?.methods.email ? (
            <SignInForm methods={me.methods} onSignedIn={reload} />
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
