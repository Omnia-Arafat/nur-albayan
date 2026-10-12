import { notFound } from "next/navigation";

import { requireStaff } from "@/components/staff/access";
import { PageEditor } from "@/components/staff/page-editor";
import { pageParam } from "@/lib/api";
import { pageForEdit } from "@/modules/content/editor";

export default async function Page({ params }: PageProps<"/[locale]/admin/pages/[page]">) {
  const { locale, page } = await params;
  const { db } = await requireStaff(locale, "content.edit");
  const n = pageParam.safeParse(page);
  if (!n.success) notFound();
  const data = await pageForEdit(db, n.data, locale);
  if (!data) notFound();
  return <PageEditor key={`${data.bookPage}:${data.version}`} page={data} />;
}
