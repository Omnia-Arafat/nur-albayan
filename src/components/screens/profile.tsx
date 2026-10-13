"use client";

import { useState } from "react";

import { AccountCard } from "@/components/app/account";
import { SaveBook } from "@/components/app/offline";
import { useApp, useT, xpRates } from "@/components/app/app-data";
import { Avatar } from "@/components/app/header";
import { addProfile } from "@/components/app/profiles";
import { Switch } from "@/components/book/controls";
import { Icon } from "@/components/book/icon";
import { tokenVar } from "@/components/book/word";
import { levelOf, type LocalProfile, xpOf } from "@/modules/progress/local";
import { updateProfile, useDevice, writeDevice } from "@/modules/progress/store";

/** Device settings a learner can switch; read by DeviceSettings. Defaults are on unless listed here. */
export const SETTINGS = [
  { key: "colours", label: "profile.colours", fallback: true },
  { key: "lessMotion", label: "profile.lessMotion", fallback: false },
] as const;

export function Profile() {
  const { catalog } = useApp();
  const t = useT();
  const device = useDevice();
  const me = device.profiles.find((p) => p.id === device.activeId) ?? device.profiles[0] ?? null;
  const [confirm, setConfirm] = useState(false);
  const levelNo = (p: LocalProfile) =>
    catalog.scoring ? levelOf(catalog.levels, xpOf(p, catalog.scoring, xpRates(catalog))).current.position : 1;
  const letters = catalog.avatars.filter((a) => a.kind === "letter" && a.value);
  const pictures = catalog.avatars.filter(
    (a) => a.kind === "icon" && a.value && (!a.unlockBadgeKey || me?.badges.includes(a.unlockBadgeKey)),
  );
  const edit = (fn: (p: LocalProfile) => LocalProfile) => me && updateProfile(me.id, fn);
  const remove = () => {
    if (!me) return;
    const profiles = device.profiles.filter((p) => p.id !== me.id);
    writeDevice({ ...device, profiles, activeId: profiles[0]?.id ?? null });
    setConfirm(false);
  };

  return (
    <main className="nb-page">
      <section className="nb-card nb-anim-rise">
        <h1 className="nb-h1">{t("profile.who")}</h1>
        <p className="nb-muted nb-m0">{t("profile.local")}</p>
        <div className="nb-people">
          {device.profiles.map((p) => (
            <button
              key={p.id}
              type="button"
              className="nb-person nb-tr-press"
              aria-pressed={p.id === me?.id}
              aria-label={t("profile.choose", { name: p.name })}
              onClick={() => writeDevice({ ...device, activeId: p.id })}
            >
              <Avatar profile={p} level={levelNo(p)} big />
              <b>{p.name}</b>
              <span className="nb-muted">{t("profile.levelN", { n: t.num(levelNo(p)) })}</span>
            </button>
          ))}
          <button
            type="button"
            className="nb-person nb-person-add nb-tr-press"
            onClick={() =>
              addProfile(
                device,
                catalog,
                t("profile.defaultName"),
                undefined,
                catalog.avatarColors[device.profiles.length % catalog.avatarColors.length],
              )
            }
          >
            <span className="nb-big-avatar nb-big-avatar-add" aria-hidden="true">
              <Icon name="profile" size={36} tone="lavender" />
            </span>
            <b>{t("profile.add")}</b>
            <span className="nb-muted">{t("profile.noAccount")}</span>
          </button>
        </div>
      </section>
      <div className="nb-cols">
        {me && (
          <section className="nb-card nb-col-main nb-anim-rise">
            <h2 className="nb-h2">{t("profile.edit", { name: me.name })}</h2>
            <label className="nb-field">
              <span className="nb-label">{t("profile.name")}</span>
              <input
                className="nb-input"
                value={me.name}
                maxLength={24}
                onChange={(e) => edit((p) => ({ ...p, name: e.target.value }))}
                onBlur={(e) => !e.target.value.trim() && edit((p) => ({ ...p, name: t("profile.defaultName") }))}
              />
            </label>
            <div className="nb-field" role="radiogroup" aria-label={t("profile.letter")}>
              <span className="nb-label">{t("profile.letter")}</span>
              <div className="nb-letters">
                {letters.map((a) => (
                  <button
                    key={a.id}
                    type="button"
                    role="radio"
                    lang="ar"
                    className="nb-pick-letter nb-tr-state"
                    aria-checked={me.avatar.kind === "letter" && me.avatar.value === a.value}
                    onClick={() => edit((p) => ({ ...p, avatar: { kind: "letter", value: a.value ?? "" } }))}
                  >
                    {a.value}
                  </button>
                ))}
                {pictures.map((a) => (
                  <button
                    key={a.id}
                    type="button"
                    role="radio"
                    className="nb-pick-letter nb-tr-state"
                    aria-label={`${t("profile.icons")} ${a.value}`}
                    aria-checked={me.avatar.kind === "icon" && me.avatar.value === a.value}
                    onClick={() => edit((p) => ({ ...p, avatar: { kind: "icon", value: a.value ?? "" } }))}
                  >
                    <Icon name={a.value ?? ""} size={28} />
                  </button>
                ))}
              </div>
            </div>
            <div className="nb-field" role="radiogroup" aria-label={t("profile.color")}>
              <span className="nb-label">{t("profile.color")}</span>
              <div className="nb-swatches">
                {catalog.avatarColors.map((c, i) => (
                  <button
                    key={c}
                    type="button"
                    role="radio"
                    className="nb-swatch nb-tr-state"
                    aria-label={t("profile.colorN", { n: t.num(i + 1) })}
                    aria-checked={me.colorTokenKey === c}
                    style={{ "--c": tokenVar(c) } as React.CSSProperties}
                    onClick={() => edit((p) => ({ ...p, colorTokenKey: c }))}
                  />
                ))}
              </div>
            </div>
            {confirm ? (
              <div className="nb-band nb-band-danger">
                <b>{t("profile.confirmRemove")}</b>
                <div className="nb-row nb-row-btns">
                  <button type="button" className="nb-btn nb-btn-again" onClick={remove}>
                    {t("profile.remove")}
                  </button>
                  <button type="button" className="nb-btn nb-btn-quiet" onClick={() => setConfirm(false)}>
                    {t("profile.cancel")}
                  </button>
                </div>
              </div>
            ) : (
              <button type="button" className="nb-btn nb-btn-quiet nb-self-start" onClick={() => setConfirm(true)}>
                {t("profile.remove")}
              </button>
            )}
          </section>
        )}
        <aside className="nb-col-side">
          {me && (
            <section className="nb-card nb-anim-rise">
              <h2 className="nb-h2">{t("profile.settings")}</h2>
              {SETTINGS.map((s) => (
                <Switch
                  key={s.key}
                  label={t(s.label)}
                  checked={(me.settings[s.key] as boolean | undefined) ?? s.fallback}
                  onChange={(v) => edit((p) => ({ ...p, settings: { ...p.settings, [s.key]: v } }))}
                />
              ))}
            </section>
          )}
          <AccountCard />
          <SaveBook />
        </aside>
      </div>
    </main>
  );
}
