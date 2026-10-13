import { NextResponse } from "next/server";

import { getDb } from "@/db/client";
import { supabaseConfigured, supabaseServer } from "@/lib/supabase/server";
import { ensureAccount } from "@/modules/auth/account";
import { getLocales } from "@/modules/i18n/service";

/** Where the emailed sign-in link lands: turns the code into a session and creates the profile on first sign-in. */
export async function GET(req: Request) {
  const url = new URL(req.url);
  const db = await getDb();
  const locales = await getLocales(db);
  const asked = url.searchParams.get("locale");
  const locale = locales.find((l) => l.code === asked)?.code ?? locales.find((l) => l.isDefault)?.code ?? "ar";
  const next = url.searchParams.get("next");
  const safeNext = next?.startsWith("/") && !next.startsWith("//") ? next : `/${locale}/profile`;
  const code = url.searchParams.get("code");
  if (!supabaseConfigured() || !code) return NextResponse.redirect(new URL(`/${locale}/sign-in?failed=1`, url));
  const supabase = await supabaseServer();
  const { data, error } = await supabase.auth.exchangeCodeForSession(code);
  if (error || !data.user) return NextResponse.redirect(new URL(`/${locale}/sign-in?failed=1`, url));
  await ensureAccount(db, data.user, locale);
  return NextResponse.redirect(new URL(safeNext, url));
}
