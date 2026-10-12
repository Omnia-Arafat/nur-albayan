import { requireStaff } from "@/components/staff/access";
import { AdminSettings } from "@/components/staff/admin-settings";
import { settingsAt } from "@/modules/settings/service";

export default async function Page({ params }: PageProps<"/[locale]/admin/settings">) {
  const { db } = await requireStaff((await params).locale, "settings.platform");
  return <AdminSettings settings={await settingsAt(db, "platform", null)} />;
}
