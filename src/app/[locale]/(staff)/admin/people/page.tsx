import { requireStaff } from "@/components/staff/access";
import { AdminPeople } from "@/components/staff/admin-people";
import { listPeople } from "@/modules/people/service";

export default async function Page({ params }: PageProps<"/[locale]/admin/people">) {
  const { locale } = await params;
  const { db, viewer } = await requireStaff(locale, "users.manage");
  return <AdminPeople data={await listPeople(db, locale)} me={viewer.profileId} />;
}
