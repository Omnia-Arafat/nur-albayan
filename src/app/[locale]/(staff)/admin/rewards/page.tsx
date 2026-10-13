import { requireStaff } from "@/components/staff/access";
import { AdminRewards } from "@/components/staff/admin-rewards";
import { gamification } from "@/modules/admin/service";
import { getLocales } from "@/modules/i18n/service";

export default async function Page({ params }: PageProps<"/[locale]/admin/rewards">) {
  const { db } = await requireStaff((await params).locale, "scoring.edit");
  const locales = await getLocales(db);
  return (
    <AdminRewards
      data={await gamification(db)}
      locales={locales.map((l) => ({ code: l.code, name: l.name, dir: l.dir, isDefault: l.isDefault }))}
    />
  );
}
