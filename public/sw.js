/*
 * Nur Al-Bayan offline support. Progress already lives on the device; this keeps the pages and book
 * content a learner opened (or saved with "Save the book on this device") so reading works offline.
 *
 * - Built files, fonts and icons: from the cache first (their names change when they change).
 * - Learner pages and public book data: from the network first, the cache when offline.
 * - Anything personal (sign-in, staff dashboards, /api/v1/me, admin APIs) is never stored.
 */
const VERSION = "nb-1";
const STATIC = `${VERSION}-static`;
const PAGES = `${VERSION}-pages`;
const DATA = `${VERSION}-data`;
const FONT_HOSTS = ["fonts.googleapis.com", "fonts.gstatic.com"];
const PRIVATE_PAGE = /^\/[a-z]{2}(-[A-Za-z]+)?\/(teacher|admin|sign-in)(\/|$)|^\/auth\//;

self.addEventListener("install", () => self.skipWaiting());

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      for (const key of await caches.keys()) if (!key.startsWith(`${VERSION}-`)) await caches.delete(key);
      await self.clients.claim();
    })(),
  );
});

const isStatic = (url) =>
  FONT_HOSTS.includes(url.hostname) ||
  (url.origin === self.location.origin &&
    (url.pathname.startsWith("/_next/static/") ||
      url.pathname.startsWith("/app-icon/") ||
      url.pathname.startsWith("/brand/")));

async function cacheFirst(request) {
  const cache = await caches.open(STATIC);
  const hit = await cache.match(request);
  if (hit) return hit;
  const res = await fetch(request);
  if (res.ok || res.type === "opaque") cache.put(request, res.clone());
  return res;
}

/** Network first; keeps a copy of good public answers, and answers from that copy when offline. */
async function networkFirst(request, name, keep) {
  const cache = await caches.open(name);
  try {
    const res = await fetch(request);
    if (res.ok && keep(res)) cache.put(request, res.clone());
    return res;
  } catch (err) {
    const hit = await cache.match(request, { ignoreVary: true });
    if (hit) return hit;
    throw err;
  }
}

const publicAnswer = (res) => !/private|no-store/.test(res.headers.get("cache-control") || "");

async function page(request) {
  try {
    return await networkFirst(request, PAGES, () => true);
  } catch {
    // The same screen for another page of the book (a game reads its words on the device), or else the
    // locale's home page, which links to everything saved.
    const cache = await caches.open(PAGES);
    const same = await cache.match(request, { ignoreSearch: true, ignoreVary: true });
    if (same) return same;
    const locale = new URL(request.url).pathname.split("/")[1];
    return (await cache.match(`/${locale}`)) || new Response("", { status: 503 });
  }
}

self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET") return;
  const url = new URL(request.url);
  if (isStatic(url)) return event.respondWith(cacheFirst(request));
  if (url.origin !== self.location.origin) return;
  if (url.pathname.startsWith("/api/")) {
    if (url.pathname.startsWith("/api/v1/me") || url.pathname.startsWith("/api/v1/admin")) return;
    return event.respondWith(networkFirst(request, DATA, publicAnswer));
  }
  // Router data for a soft navigation is tied to what the page already shows, so it is never replayed:
  // offline, it fails and the router loads the whole page, which comes from the cache below.
  if (request.headers.get("RSC")) return;
  if (request.mode === "navigate" && !PRIVATE_PAGE.test(url.pathname)) event.respondWith(page(request));
});

/** Saves a list of pages and data for offline use, with the built files each page needs; reports progress. */
async function saveAll(urls, port) {
  const pages = await caches.open(PAGES);
  const data = await caches.open(DATA);
  const files = new Set();
  let done = 0;
  for (const u of urls) {
    try {
      const res = await fetch(u, { credentials: "same-origin" });
      if (res.ok) {
        if (u.startsWith("/api/")) {
          if (publicAnswer(res)) await data.put(u, res);
        } else {
          const html = await res.clone().text();
          for (const m of html.matchAll(/\/_next\/static\/[^"'\s)]+/g)) files.add(m[0]);
          await pages.put(u, res);
        }
      }
    } catch {
      // Offline or a page that failed: the rest still saves.
    }
    done++;
    port.postMessage({ done, total: urls.length });
  }
  const statics = await caches.open(STATIC);
  for (const f of files) if (!(await statics.match(f))) await statics.add(f).catch(() => undefined);
  port.postMessage({ done, total: urls.length, finished: true });
}

self.addEventListener("message", (event) => {
  if (event.data?.type === "save" && Array.isArray(event.data.urls) && event.ports[0])
    event.waitUntil(
      saveAll(
        event.data.urls.filter((u) => typeof u === "string" && u.startsWith("/")),
        event.ports[0],
      ),
    );
});
