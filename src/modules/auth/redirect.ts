/** Paths on this site only, so a sign-in link or provider can't send anyone elsewhere. */
export const safePath = (next: string | null | undefined) =>
  next?.startsWith("/") && !next.startsWith("//") && !next.startsWith("/\\") ? next : undefined;

/** Where Supabase sends people back after an emailed link or a provider such as Google. */
export function callbackUrl(req: Request, locale: string, next?: string) {
  const site = process.env.NEXT_PUBLIC_SITE_URL ?? new URL(req.url).origin;
  const back = new URL("/auth/callback", site);
  back.searchParams.set("locale", locale);
  const path = safePath(next);
  if (path) back.searchParams.set("next", path);
  return back.toString();
}

/** Social sign-in providers switched on for this site (AUTH_PROVIDERS, comma separated, e.g. "google"). */
export const SOCIAL = ["google"] as const;
export type Social = (typeof SOCIAL)[number];
export const socialProviders = (): Social[] =>
  (process.env.AUTH_PROVIDERS ?? "")
    .split(",")
    .map((p) => p.trim().toLowerCase())
    .filter((p): p is Social => (SOCIAL as readonly string[]).includes(p));
