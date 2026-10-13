import { ImageResponse } from "next/og";

import { getDb } from "@/db/client";
import { logoSvg } from "@/modules/theme/logo";
import { icons, tokenValues } from "@/modules/theme/service";

/** Sizes the manifest and the home-screen link ask for. */
const VARIANTS: Record<string, { size: number; maskable?: boolean }> = {
  "icon-192.png": { size: 192 },
  "icon-512.png": { size: 512 },
  "maskable-512.png": { size: 512, maskable: true },
  "apple-180.png": { size: 180, maskable: true },
};

/** The app's install icons, drawn from the book's icon set and the theme's colours (nothing stored as a file). */
export async function GET(_req: Request, ctx: RouteContext<"/app-icon/[variant]">) {
  const v = VARIANTS[(await ctx.params).variant];
  if (!v) return new Response(null, { status: 404 });
  const tokens = await tokenValues(await getDb());
  const svg = logoSvg(icons, (k) => tokens.get(k) ?? "currentColor", { maskable: v.maskable });
  const src = `data:image/svg+xml;base64,${Buffer.from(svg).toString("base64")}`;
  return new ImageResponse(
    // eslint-disable-next-line @next/next/no-img-element
    <img src={src} width={v.size} height={v.size} alt="" />,
    { width: v.size, height: v.size, headers: { "cache-control": "public, max-age=86400" } },
  );
}
