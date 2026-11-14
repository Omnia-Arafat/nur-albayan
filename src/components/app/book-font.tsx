"use client";

import { useSyncExternalStore } from "react";

import { useT } from "@/components/app/app-data";
import { Icon } from "@/components/book/icon";

const subscribe = (l: () => void) => {
  window.addEventListener("nb-book-font", l);
  return () => window.removeEventListener("nb-book-font", l);
};

/** The book-font state the layout's boot script sets on <html>: "ready", "failed", or unset while loading. */
const useBookFont = () =>
  useSyncExternalStore(
    subscribe,
    () => document.documentElement.dataset.bookFont ?? "",
    () => "",
  );

/**
 * Book and Qur'anic words are hidden until their font is ready, so a missing mark never shows as a broken
 * word. When the font cannot load, this says so in place of the words and offers to try again.
 */
export function BookFontNotice() {
  const t = useT();
  if (useBookFont() !== "failed") return null;
  return (
    <div className="nb-font-failed" role="alert">
      <Icon name="warning" size={22} tone="yellow" />
      <span>{t("font.failed")}</span>
      <button type="button" className="nb-btn nb-btn-soft" onClick={() => window.location.reload()}>
        {t("font.retry")}
      </button>
    </div>
  );
}
