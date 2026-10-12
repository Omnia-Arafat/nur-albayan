"use client";

import { useT } from "@/components/app/app-data";

import { SettingControl, type SettingView } from "./setting-control";

export function AdminSettings({ settings }: { settings: SettingView[] }) {
  const t = useT();
  const groups = [...new Set(settings.map((s) => s.group))];
  return (
    <div className="nb-stack-lg">
      <section className="nb-card nb-anim-rise">
        <h1 className="nb-h1">{t("admin.settingsTitle")}</h1>
        <p className="nb-sub">{t("admin.settingsIntro")}</p>
      </section>
      <div className="nb-grid nb-grid-320">
        {groups.map((g) => {
          const shown = settings.filter((s) => s.group === g && s.type !== "json");
          if (!shown.length) return null;
          return (
            <section key={g} className="nb-card nb-anim-rise nb-overflow-visible">
              <h2 className="nb-h2">{t(`setting.group.${g}`)}</h2>
              {shown.map((s) => (
                <SettingControl key={s.key} setting={s} endpoint="/api/v1/admin/settings" />
              ))}
            </section>
          );
        })}
      </div>
    </div>
  );
}
