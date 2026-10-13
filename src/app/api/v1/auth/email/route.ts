import { z } from "zod";

import { body, privateJson, problem } from "@/lib/api";
import { supabaseConfigured, supabaseServer } from "@/lib/supabase/server";

/** Sends a one-time sign-in link. The same link signs up a new address. */
export async function POST(req: Request) {
  if (!supabaseConfigured()) return problem(503, "Email sign-in is not set up yet");
  const b = await body(
    req,
    z.object({ email: z.email().max(200), locale: z.string().max(10), next: z.string().max(200).optional() }),
  );
  if (b.error) return b.error;
  const site = process.env.NEXT_PUBLIC_SITE_URL ?? new URL(req.url).origin;
  const back = new URL("/auth/callback", site);
  back.searchParams.set("locale", b.data.locale);
  // Only paths on this site, so the link can't send anyone elsewhere.
  if (b.data.next?.startsWith("/") && !b.data.next.startsWith("//")) back.searchParams.set("next", b.data.next);
  const { error } = await (
    await supabaseServer()
  ).auth.signInWithOtp({
    email: b.data.email,
    options: { emailRedirectTo: back.toString() },
  });
  return error ? problem(error.status ?? 400, error.message) : privateJson({ ok: true });
}
