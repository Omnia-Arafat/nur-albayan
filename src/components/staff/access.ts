import "server-only";

import { and, eq } from "drizzle-orm";
import { redirect } from "next/navigation";

import { getDb } from "@/db/client";
import * as s from "@/db/schema";
import { can, getViewer } from "@/modules/auth/viewer";

/** The signed-in staff member for a page that needs `permission`; anyone else goes to the sign-in page. */
export async function requireStaff(locale: string, permission: string) {
  const db = await getDb();
  const viewer = await getViewer(db);
  if (!viewer) redirect(`/${locale}/sign-in`);
  if (!can(viewer, permission)) redirect(`/${locale}/sign-in?denied=1`);
  const [label] = await db
    .select({ label: s.rolesI18n.label })
    .from(s.rolesI18n)
    .where(and(eq(s.rolesI18n.entityKey, viewer.roleKey), eq(s.rolesI18n.locale, locale)));
  return { db, viewer, roleLabel: label?.label ?? viewer.roleKey };
}
