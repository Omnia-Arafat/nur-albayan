"use client";

import { usePathname, useRouter } from "next/navigation";

import { useT } from "@/components/app/app-data";
import { Select } from "@/components/book/controls";

/** The classroom dropdown on teacher pages; the choice lives in ?class= so pages stay shareable. */
export function ClassPicker({
  classes,
  current,
}: {
  classes: { id: string; name: string; students: number }[];
  current: string;
}) {
  const t = useT();
  const router = useRouter();
  const path = usePathname();
  return (
    <Select
      label={t("teacher.class")}
      value={current}
      options={classes.map((c) => ({
        value: c.id,
        label: t("teacher.classN", { name: c.name, n: t.num(c.students) }),
      }))}
      onChange={(id) => router.push(`${path}?class=${id}`)}
    />
  );
}
