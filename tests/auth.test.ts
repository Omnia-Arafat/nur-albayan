import { afterEach, describe, expect, it } from "vitest";

import { callbackUrl, safePath, socialProviders } from "@/modules/auth/redirect";

afterEach(() => {
  delete process.env.AUTH_PROVIDERS;
  delete process.env.NEXT_PUBLIC_SITE_URL;
});

describe("sign-in redirects", () => {
  it("only keeps paths on this site", () => {
    expect(safePath("/ar/teacher")).toBe("/ar/teacher");
    for (const bad of ["//evil.example", "/\\evil.example", "https://evil.example", "", null, undefined])
      expect(safePath(bad)).toBeUndefined();
  });

  it("builds the callback on the public site address", () => {
    process.env.NEXT_PUBLIC_SITE_URL = "https://site.example";
    const url = new URL(callbackUrl(new Request("http://internal/api"), "en", "//evil.example"));
    expect(url.origin + url.pathname).toBe("https://site.example/auth/callback");
    expect(url.searchParams.get("locale")).toBe("en");
    expect(url.searchParams.has("next")).toBe(false);
  });

  it("offers only known social providers that are switched on", () => {
    expect(socialProviders()).toEqual([]);
    process.env.AUTH_PROVIDERS = " Google, myspace ";
    expect(socialProviders()).toEqual(["google"]);
  });
});
