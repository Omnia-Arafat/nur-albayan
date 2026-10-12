"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import { useT } from "@/components/app/app-data";
import { Select, Switch } from "@/components/book/controls";
import { Tag } from "@/components/book/parts";

type Data = {
  roles: { key: string; label: string }[];
  studentCount: number;
  people: { id: string; name: string; roleKey: string; status: string; classrooms: number }[];
};

export function AdminPeople({ data, me }: { data: Data; me: string }) {
  const t = useT();
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const change = async (id: string, patch: { roleKey?: string; status?: string }) => {
    setError(null);
    const r = await fetch(`/api/v1/admin/people/${id}`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(patch),
    });
    if (!r.ok)
      setError(
        t("admin.saveFailed", { error: ((await r.json().catch(() => ({}))) as { title?: string }).title ?? r.status }),
      );
    router.refresh();
  };
  return (
    <div className="nb-stack-lg">
      <section className="nb-card nb-anim-rise">
        <div className="nb-spread">
          <div>
            <h1 className="nb-h1">{t("admin.peopleTitle")}</h1>
            <p className="nb-sub">{t("admin.peopleIntro")}</p>
          </div>
          <Tag palette="sky">{t("admin.studentsTotal", { n: t.num(data.studentCount) })}</Tag>
        </div>
        {error && (
          <p className="nb-error nb-m0" role="alert">
            {error}
          </p>
        )}
      </section>
      <section className="nb-card nb-anim-rise nb-overflow-visible">
        <ul className="nb-plain nb-people-list">
          {data.people.map((p) => (
            <li key={p.id} className="nb-person-row">
              <span className="nb-avatar nb-staff-avatar" aria-hidden="true">
                <span className="nb-avatar-letter">{Array.from(p.name)[0]}</span>
              </span>
              <span className="nb-review-text">
                <b>{p.name}</b>
                <span className="nb-muted nb-small">
                  {p.id === me ? t("admin.you") : t("admin.classes", { n: t.num(p.classrooms) })}
                </span>
              </span>
              {p.id === me ? (
                <Tag palette="lavender">{data.roles.find((r) => r.key === p.roleKey)?.label}</Tag>
              ) : (
                <div className="nb-person-tools">
                  <Select
                    label={t("admin.role")}
                    value={p.roleKey}
                    options={data.roles.map((r) => ({ value: r.key, label: r.label }))}
                    onChange={(roleKey) => change(p.id, { roleKey })}
                  />
                  <Switch
                    label={t("admin.active")}
                    checked={p.status === "active"}
                    onChange={(on) => change(p.id, { status: on ? "active" : "disabled" })}
                  />
                </div>
              )}
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
