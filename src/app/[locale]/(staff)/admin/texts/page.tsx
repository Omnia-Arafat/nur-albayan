import { requireStaff } from "@/components/staff/access";
import { AdminTexts } from "@/components/staff/admin-texts";
import { messageTable } from "@/modules/admin/service";
import { getLocales } from "@/modules/i18n/service";

export default async function Page({ params }: PageProps<"/[locale]/admin/texts">) {
  const { db } = await requireStaff((await params).locale, "i18n.edit");
  const locales = await getLocales(db);
  return (
    <AdminTexts
      rows={await messageTable(db)}
      locales={locales.map((l) => ({ code: l.code, name: l.name, dir: l.dir, isDefault: l.isDefault }))}
    />
  );
}
