"use client";

import { useEffect, useState, useSyncExternalStore } from "react";

import { useApp, useT } from "@/components/app/app-data";
import { Icon } from "@/components/book/icon";
import { Meter } from "@/components/book/parts";
import { PLAYABLE } from "@/modules/games/screens";

const subscribe = (l: () => void) => {
  window.addEventListener("online", l);
  window.addEventListener("offline", l);
  return () => {
    window.removeEventListener("online", l);
    window.removeEventListener("offline", l);
  };
};

/** Whether the browser is online. The server render and first paint assume online. */
export const useOnline = () =>
  useSyncExternalStore(
    subscribe,
    () => navigator.onLine,
    () => true,
  );

/**
 * Registers the offline worker (public/sw.js) in production builds, and says so when the connection
 * drops: reading still works, and progress saves once the connection is back.
 */
export function OfflineSupport() {
  const t = useT();
  const online = useOnline();
  useEffect(() => {
    if (process.env.NODE_ENV !== "production" || !("serviceWorker" in navigator)) return;
    navigator.serviceWorker.register("/sw.js", { scope: "/", updateViaCache: "none" }).catch(() => undefined);
  }, []);
  useEffect(() => {
    // Room at the bottom of the page so the notice never covers the last buttons.
    document.documentElement.toggleAttribute("data-offline", !online);
  }, [online]);
  if (online) return null;
  return (
    <p className="nb-offline nb-anim-rise" role="status">
      <Icon name="warning" size={22} tone="yellow" /> {t("offline.banner")}
    </p>
  );
}

const SAVED_KEY = "nur-albayan.offline-saved";

/** The pages and book data a learner needs offline, in this locale. */
function bookUrls(locale: string, pages: number[]) {
  const tabs = ["", "/games", "/review", "/mistakes", "/badges", "/profile"];
  return [
    ...tabs.map((p) => `/${locale}${p}`),
    ...[...PLAYABLE].map((g) => `/${locale}/games/${g}`),
    ...pages.flatMap((p) => [`/${locale}/lesson/${p}`, `/api/v1/lessons/${p}?locale=${locale}`]),
  ];
}

/** The profile's card for keeping the whole book on this device, so it opens with no connection. */
export function SaveBook() {
  const t = useT();
  const { locale, lessons } = useApp();
  const online = useOnline();
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(null);
  const [savedAt, setSavedAt] = useState<string | null>(null);
  const [ready, setReady] = useState(false);
  useEffect(() => {
    // Read after mount: the server render has no storage.
    let at: string | null = null;
    try {
      at = window.localStorage.getItem(`${SAVED_KEY}.${locale.code}`);
    } catch {
      at = null;
    }
    const supported = "serviceWorker" in navigator && process.env.NODE_ENV === "production";
    queueMicrotask(() => {
      setSavedAt(at);
      setReady(supported);
    });
  }, [locale.code]);

  const save = async () => {
    const reg = await navigator.serviceWorker.ready;
    if (!reg.active) return;
    const urls = bookUrls(
      locale.code,
      lessons.map((l) => l.bookPage),
    );
    const channel = new MessageChannel();
    setProgress({ done: 0, total: urls.length });
    channel.port1.onmessage = (e: MessageEvent<{ done: number; total: number; finished?: boolean }>) => {
      setProgress({ done: e.data.done, total: e.data.total });
      if (e.data.finished) {
        const at = new Date().toISOString();
        try {
          window.localStorage.setItem(`${SAVED_KEY}.${locale.code}`, at);
        } catch {
          // Storage blocked: the book is still saved, only the date isn't remembered.
        }
        setSavedAt(at);
        setProgress(null);
      }
    };
    reg.active.postMessage({ type: "save", urls }, [channel.port2]);
  };

  if (!ready) return null;
  const date = new Intl.DateTimeFormat(`${locale.code}-u-nu-${locale.numberingSystem}`, { dateStyle: "medium" });
  return (
    <section className="nb-card nb-anim-rise">
      <h2 className="nb-h2">{t("offline.title")}</h2>
      <p className="nb-muted nb-m0">{t("offline.text")}</p>
      {progress ? (
        <div className="nb-stack" role="status">
          <span className="nb-muted nb-small">
            {t("offline.saving", { n: t.num(progress.done), total: t.num(progress.total) })}
          </span>
          <Meter value={progress.total ? progress.done / progress.total : 0} palette="sky" />
        </div>
      ) : (
        <>
          {savedAt && (
            <p className="nb-row nb-m0" role="status">
              <Icon name="check" size={22} tone="lime" />{" "}
              {t("offline.savedOn", { date: date.format(new Date(savedAt)) })}
            </p>
          )}
          <button
            type="button"
            className="nb-btn nb-btn-soft nb-self-start nb-w-auto"
            disabled={!online}
            onClick={save}
          >
            {t(savedAt ? "offline.update" : "offline.save")}
          </button>
        </>
      )}
    </section>
  );
}
