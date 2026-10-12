"use client";

import { useState } from "react";

import { useT } from "@/components/app/app-data";
import { Select, Stepper, Switch } from "@/components/book/controls";

export type SettingView = {
  key: string;
  type: string;
  options: string[] | null;
  min: number | null;
  max: number | null;
  step: number | null;
  value: unknown;
  group: string;
};

/**
 * One setting drawn from its definition: a switch, a stepper or a dropdown. Saves on change and
 * rolls back if the server refuses. JSON settings have no control here yet.
 */
export function SettingControl({ setting, endpoint }: { setting: SettingView; endpoint: string }) {
  const t = useT();
  const [value, setValue] = useState(setting.value);
  const [error, setError] = useState<string | null>(null);
  const label = t(`setting.${setting.key}`);
  const save = async (v: unknown) => {
    const before = value;
    setValue(v);
    setError(null);
    const r = await fetch(endpoint, {
      method: "PUT",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ key: setting.key, value: v }),
    });
    if (!r.ok) {
      setValue(before);
      setError(
        t("admin.saveFailed", { error: ((await r.json().catch(() => ({}))) as { title?: string }).title ?? r.status }),
      );
    }
  };
  const control =
    setting.type === "boolean" ? (
      <Switch label={label} checked={value === true} onChange={save} />
    ) : setting.type === "integer" ? (
      <Stepper
        label={label}
        value={Number(value)}
        min={setting.min}
        max={setting.max}
        step={setting.step}
        format={t.num}
        lessLabel={t("stepper.less")}
        moreLabel={t("stepper.more")}
        onChange={save}
      />
    ) : setting.type === "enum" ? (
      <Select
        label={label}
        value={String(value)}
        options={(setting.options ?? []).map((o) => ({ value: o, label: t(`option.${o}`) }))}
        onChange={save}
      />
    ) : null;
  if (!control) return null;
  return (
    <div className="nb-setting">
      {control}
      {error && (
        <p className="nb-error nb-m0" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}
