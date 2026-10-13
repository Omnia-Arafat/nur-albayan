import { requireStaff } from "@/components/staff/access";
import { AdminOverview } from "@/components/staff/admin-overview";
import { platformOverview } from "@/modules/admin/service";

export default async function Page({ params }: PageProps<"/[locale]/admin/overview">) {
  const { db } = await requireStaff((await params).locale, "settings.platform");
  return <AdminOverview data={await platformOverview(db)} />;
}
