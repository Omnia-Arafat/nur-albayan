import { z } from "zod";

import { body, privateJson, problem } from "@/lib/api";
import { supabaseConfigured, supabaseServer } from "@/lib/supabase/server";
import { callbackUrl, SOCIAL, socialProviders } from "@/modules/auth/redirect";

/** Starts sign-in with a provider such as Google: returns the provider's page to open. */
export async function POST(req: Request) {
  const b = await body(
    req,
    z.object({ provider: z.enum(SOCIAL), locale: z.string().max(10), next: z.string().max(200).optional() }),
  );
  if (b.error) return b.error;
  if (!supabaseConfigured() || !socialProviders().includes(b.data.provider))
    return problem(503, "This sign-in is not set up yet");
  const { data, error } = await (
    await supabaseServer()
  ).auth.signInWithOAuth({
    provider: b.data.provider,
    options: { redirectTo: callbackUrl(req, b.data.locale, b.data.next), skipBrowserRedirect: true },
  });
  return error || !data.url ? problem(400, error?.message ?? "No provider address") : privateJson({ url: data.url });
}
