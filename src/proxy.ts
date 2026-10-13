import { createServerClient } from "@supabase/ssr";
import { type NextRequest, NextResponse } from "next/server";

/**
 * Keeps a Supabase session fresh: when the access token has expired, the refreshed cookies are written here,
 * because pages (Server Components) can read cookies but not set them. Does nothing until Supabase is configured,
 * and only runs where a signed-in person can be (staff areas, the profile page, sign-in and the API).
 */
export async function proxy(request: NextRequest) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  let response = NextResponse.next({ request });
  if (!url || !key || !request.cookies.getAll().some((c) => c.name.startsWith("sb-"))) return response;
  const supabase = createServerClient(url, key, {
    cookies: {
      getAll: () => request.cookies.getAll(),
      setAll: (list) => {
        list.forEach(({ name, value }) => request.cookies.set(name, value));
        response = NextResponse.next({ request });
        list.forEach(({ name, value, options }) => response.cookies.set(name, value, options));
      },
    },
  });
  await supabase.auth.getUser();
  return response;
}

export const config = {
  matcher: [
    "/:locale/teacher/:path*",
    "/:locale/admin/:path*",
    "/:locale/profile",
    "/:locale/sign-in",
    "/api/v1/:path*",
  ],
};
