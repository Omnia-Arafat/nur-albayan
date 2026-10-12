import { inArray } from "drizzle-orm";

import { SignIn } from "@/components/staff/sign-in";
import { getDb } from "@/db/client";
import * as s from "@/db/schema";
import { localSignIn } from "@/modules/auth/viewer";

export default async function Page({ searchParams }: PageProps<"/[locale]/sign-in">) {
  const { denied } = await searchParams;
  const local = localSignIn();
  const db = await getDb();
  const people = local
    ? await db
        .select({ id: s.profiles.id, name: s.profiles.displayName, roleKey: s.profiles.roleKey })
        .from(s.profiles)
        .where(inArray(s.profiles.roleKey, ["admin", "teacher"]))
    : [];
  return <SignIn local={local} people={people} denied={Boolean(denied)} />;
}
