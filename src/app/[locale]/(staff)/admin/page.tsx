import { requireStaff } from "@/components/staff/access";
import { AdminPages } from "@/components/staff/admin-pages";
import { listLessons } from "@/modules/content/service";

export default async function Page({ params }: PageProps<"/[locale]/admin">) {
  const { locale } = await params;
  const { db } = await requireStaff(locale, "content.edit");
  return <AdminPages lessons={await listLessons(db, locale)} />;
}
