"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import { useT } from "@/components/app/app-data";
import { Stepper, Switch } from "@/components/book/controls";
import { Icon } from "@/components/book/icon";
import { paletteOf } from "@/components/screens/word-game";
import type { BadgeAdmin, LevelAdmin } from "@/modules/admin/service";

type LocaleView = { code: string; name: string; dir: "ltr" | "rtl"; isDefault: boolean };

/** Sends one change and reports how it went in the shared words. */
function useSave() {
  const t = useT();
  const router = useRouter();
  const [note, setNote] = useState<{ ok: boolean; text: string } | null>(null);
  const send = async (url: string, data: unknown, bad = "rewards.failed") => {
    setNote(null);
    const r = await fetch(url, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(data),
    }).catch(() => null);
    setNote(
      r?.ok ? { ok: true, text: t("texts.saved") } : { ok: false, text: t(r?.status === 400 ? bad : "rewards.failed") },
    );
    if (r?.ok) router.refresh();
    return Boolean(r?.ok);
  };
  const shown = note && (
    <span className={note.ok ? "nb-muted" : "nb-error"} role={note.ok ? "status" : "alert"}>
      {note.text}
    </span>
  );
  return { send, shown };
}

/** Badges a learner can earn and the levels their points climb, all editable data. */
export function AdminRewards({
  data,
  locales,
}: {
  data: { badges: BadgeAdmin[]; levels: LevelAdmin[] };
  locales: LocaleView[];
}) {
  const t = useT();
  return (
    <div className="nb-stack-lg">
      <section className="nb-card nb-anim-rise">
        <h1 className="nb-h1">{t("rewards.title")}</h1>
        <p className="nb-sub">{t("rewards.intro")}</p>
      </section>
      <section className="nb-card nb-anim-rise">
        <h2 className="nb-h2">{t("rewards.levels")}</h2>
        <p className="nb-muted nb-m0">{t("rewards.levelsIntro")}</p>
        <ul className="nb-plain nb-rewards">
          {data.levels.map((l, i) => (
            <LevelRow key={l.key} level={l} first={i === 0} locales={locales} />
          ))}
        </ul>
      </section>
      <section className="nb-card nb-anim-rise">
        <h2 className="nb-h2">{t("rewards.badges")}</h2>
        <ul className="nb-plain nb-rewards nb-grid nb-grid-320">
          {data.badges.map((b) => (
            <BadgeRow key={b.key} badge={b} locales={locales} />
          ))}
        </ul>
      </section>
    </div>
  );
}

function Names({
  locales,
  values,
  onChange,
  description,
}: {
  locales: LocaleView[];
  values: Record<string, { name: string; description?: string }>;
  onChange: (code: string, v: { name: string; description?: string }) => void;
  description?: boolean;
}) {
  const t = useT();
  return (
    <div className="nb-text-langs">
      {locales.map((l) => (
        <div key={l.code} className="nb-stack">
          <label className="nb-field">
            <span className="nb-label">{t("rewards.name", { lang: l.name })}</span>
            <input
              className="nb-input"
              dir={l.dir}
              lang={l.code}
              maxLength={60}
              value={values[l.code]?.name ?? ""}
              onChange={(e) => onChange(l.code, { ...values[l.code], name: e.target.value })}
            />
          </label>
          {description && (
            <label className="nb-field">
              <span className="nb-label">{t("rewards.description", { lang: l.name })}</span>
              <input
                className="nb-input"
                dir={l.dir}
                lang={l.code}
                maxLength={200}
                value={values[l.code]?.description ?? ""}
                onChange={(e) => onChange(l.code, { name: values[l.code]?.name ?? "", description: e.target.value })}
              />
            </label>
          )}
        </div>
      ))}
    </div>
  );
}

function LevelRow({ level, first, locales }: { level: LevelAdmin; first: boolean; locales: LocaleView[] }) {
  const t = useT();
  const { send, shown } = useSave();
  const start = Object.fromEntries(locales.map((l) => [l.code, { name: level.i18n[l.code] ?? "" }]));
  const [names, setNames] = useState(start);
  const [points, setPoints] = useState(String(level.xpThreshold));
  const dirty =
    points !== String(level.xpThreshold) || locales.some((l) => names[l.code].name !== (level.i18n[l.code] ?? ""));
  const save = async () => {
    const n = Number(points);
    if (
      n !== level.xpThreshold &&
      !(await send(`/api/v1/admin/levels/${level.key}`, { xpThreshold: n }, "rewards.order"))
    )
      return;
    for (const l of locales)
      if (names[l.code].name.trim() && names[l.code].name !== (level.i18n[l.code] ?? ""))
        if (!(await send(`/api/v1/admin/levels/${level.key}`, { locale: l.code, name: names[l.code].name.trim() })))
          return;
  };
  return (
    <li className="nb-reward-row">
      <span className="nb-reward-mark" aria-hidden="true">
        <Icon name={level.iconKey} size={28} tone="yellow" />
        <b>{t.num(level.position)}</b>
      </span>
      <div className="nb-stack nb-grow">
        <Names locales={locales} values={names} onChange={(c, v) => setNames({ ...names, [c]: { name: v.name } })} />
        <label className="nb-field nb-reward-points">
          <span className="nb-label">{t("rewards.points")}</span>
          <input
            className="nb-input"
            dir="ltr"
            inputMode="numeric"
            disabled={first}
            value={points}
            onChange={(e) => setPoints(e.target.value.replace(/\D/g, "").slice(0, 8))}
          />
        </label>
        {(dirty || shown) && (
          <div className="nb-row nb-center-y">
            {dirty && (
              <button type="button" className="nb-btn nb-btn-ok nb-w-auto" onClick={save}>
                {t("admin.save")}
              </button>
            )}
            {shown}
          </div>
        )}
      </div>
    </li>
  );
}

function BadgeRow({ badge, locales }: { badge: BadgeAdmin; locales: LocaleView[] }) {
  const t = useT();
  const { send, shown } = useSave();
  const start = Object.fromEntries(
    locales.map((l) => [
      l.code,
      { name: badge.i18n[l.code]?.name ?? "", description: badge.i18n[l.code]?.description ?? "" },
    ]),
  );
  const [names, setNames] = useState(start);
  const [count, setCount] = useState(badge.criteria.count ?? 1);
  const pal = paletteOf(badge.fillTokenKey);
  const dirty =
    count !== (badge.criteria.count ?? 1) ||
    locales.some(
      (l) => names[l.code].name !== start[l.code].name || names[l.code].description !== start[l.code].description,
    );
  const save = async () => {
    if (count !== (badge.criteria.count ?? 1) && !(await send(`/api/v1/admin/badges/${badge.key}`, { count }))) return;
    for (const l of locales) {
      const v = names[l.code];
      if (
        (v.name !== start[l.code].name || v.description !== start[l.code].description) &&
        v.name.trim() &&
        v.description.trim()
      )
        if (
          !(await send(`/api/v1/admin/badges/${badge.key}`, {
            locale: l.code,
            name: v.name.trim(),
            description: v.description.trim(),
          }))
        )
          return;
    }
  };
  return (
    <li className="nb-card nb-reward-badge">
      <div className="nb-spread">
        <span className="nb-row nb-center-y">
          <Icon name={badge.iconKey} size={34} tone={pal} />
          <b>{badge.i18n[locales.find((l) => l.isDefault)?.code ?? ""]?.name ?? badge.key}</b>
        </span>
        <Switch
          label={t("rewards.enabled")}
          checked={badge.enabled}
          onChange={(v) => void send(`/api/v1/admin/badges/${badge.key}`, { enabled: v })}
        />
      </div>
      <Names
        description
        locales={locales}
        values={names}
        onChange={(c, v) => setNames({ ...names, [c]: { name: v.name, description: v.description ?? "" } })}
      />
      {badge.criteria.count !== undefined && (
        <Stepper
          label={t(`rewards.rule.${badge.criteria.type}`)}
          value={count}
          min={1}
          max={10_000}
          format={t.num}
          onChange={setCount}
          lessLabel={t("stepper.less")}
          moreLabel={t("stepper.more")}
        />
      )}
      {(dirty || shown) && (
        <div className="nb-row nb-center-y">
          {dirty && (
            <button type="button" className="nb-btn nb-btn-ok nb-w-auto" onClick={save}>
              {t("admin.save")}
            </button>
          )}
          {shown}
        </div>
      )}
    </li>
  );
}
