import { z } from "zod";

import { getDb } from "@/db/client";
import { body, privateJson, problem } from "@/lib/api";
import { supabaseConfigured, supabaseServer } from "@/lib/supabase/server";
import { ensureAccount } from "@/modules/auth/account";
import { callbackUrl } from "@/modules/auth/redirect";

const input = z.object({
  mode: z.enum(["signIn", "signUp"]),
  email: z.email().max(200),
  password: z.string().min(8).max(72),
  locale: z.string().max(10),
  next: z.string().max(200).optional(),
});

/**
 * Email and password. Signing in sets the session cookies; signing up either signs in straight away or,
 * when the project asks for confirmation, emails a link that lands on /auth/callback.
 * Problems carry a `detail.reason` the page turns into a message: wrong, unconfirmed, taken, weak.
 */
export async function POST(req: Request) {
  if (!supabaseConfigured()) return problem(503, "Email sign-in is not set up yet");
  const b = await body(req, input);
  if (b.error) return b.error;
  const { mode, email, password, locale, next } = b.data;
  const auth = (await supabaseServer()).auth;

  if (mode === "signIn") {
    const { data, error } = await auth.signInWithPassword({ email, password });
    if (error) {
      const reason = error.code === "email_not_confirmed" ? "unconfirmed" : "wrong";
      return problem(error.code === "email_not_confirmed" ? 403 : 401, error.message, { reason });
    }
    await ensureAccount(await getDb(), data.user, locale);
    return privateJson({ ok: true, signedIn: true });
  }

  const { data, error } = await auth.signUp({
    email,
    password,
    options: { emailRedirectTo: callbackUrl(req, locale, next) },
  });
  if (error) {
    const reason = error.code === "weak_password" ? "weak" : error.code === "user_already_exists" ? "taken" : "failed";
    return problem(error.status ?? 400, error.message, { reason });
  }
  // With confirmation on, an address that already has an account comes back with no identities.
  if (data.user && data.user.identities?.length === 0) return problem(409, "Already registered", { reason: "taken" });
  if (data.session && data.user) {
    await ensureAccount(await getDb(), data.user, locale);
    return privateJson({ ok: true, signedIn: true });
  }
  return privateJson({ ok: true, signedIn: false });
}
