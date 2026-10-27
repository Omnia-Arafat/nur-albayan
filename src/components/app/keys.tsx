"use client";

import { useEffect, useEffectEvent, useRef, useState } from "react";
import { createPortal } from "react-dom";

import { Icon } from "@/components/book/icon";
import { type Action, actionOf, capsFor, type Dir, ownsKey, SHORTCUT_GROUPS } from "@/modules/keyboard/keys";

import { useApp, useT } from "./app-data";

/** Opens the shortcut sheet from a button anywhere (the sheet itself also listens for "?"). */
export const openShortcuts = () => window.dispatchEvent(new Event("nb:shortcuts"));

export const useDir = () => useApp().locale.dir as Dir;

/**
 * Runs a screen's handlers for its shortcuts. Keys a focused control needs (typing, choosing, pressing)
 * stay with that control, and nothing fires while a modal sheet is open. `when` can hold the keys back,
 * for example while the reader is scrolled out of sight.
 */
export function useShortcuts(handlers: Partial<Record<Action, () => void>>, when?: () => boolean) {
  const dir = useDir();
  const onKey = useEffectEvent((e: KeyboardEvent) => {
    if (e.defaultPrevented || document.querySelector("[data-nb-modal]")) return;
    const action = actionOf(e, dir, Object.keys(handlers) as Action[]);
    if (!action || ownsKey(e.target, e.key) || (when && !when())) return;
    e.preventDefault();
    handlers[action]?.();
  });
  useEffect(() => {
    const listen = (e: KeyboardEvent) => onKey(e);
    window.addEventListener("keydown", listen);
    return () => window.removeEventListener("keydown", listen);
  }, []);
}

/** A key cap, as printed in the shortcut sheet and hints. */
export function Kbd({ children }: { children: React.ReactNode }) {
  return <kbd className="nb-kbd">{children}</kbd>;
}

/** The caps for an action in the current reading direction. */
export function Caps({ action }: { action: Action }) {
  const dir = useDir();
  return (
    <>
      {capsFor(action, dir).map((c) => (
        <Kbd key={c}>{c}</Kbd>
      ))}
    </>
  );
}

/** The sheet listing every shortcut: "?" opens it, Escape or the close button closes it. */
export function ShortcutsHelp() {
  const t = useT();
  const [open, setOpen] = useState(false);
  const close = useRef<HTMLButtonElement>(null);
  const back = useRef<Element | null>(null);

  useShortcuts({ help: () => setOpen(true) });
  useEffect(() => {
    const show = () => setOpen(true);
    window.addEventListener("nb:shortcuts", show);
    return () => window.removeEventListener("nb:shortcuts", show);
  }, []);
  useEffect(() => {
    if (!open) return;
    back.current = document.activeElement;
    close.current?.focus();
    return () => (back.current as HTMLElement | null)?.focus?.();
  }, [open]);

  if (!open) return null;
  const keys = (e: React.KeyboardEvent) => {
    if (e.key === "Escape" || e.key === "?") {
      e.preventDefault();
      setOpen(false);
    }
    // The close button is the sheet's only control, so Tab stays on it.
    if (e.key === "Tab") {
      e.preventDefault();
      close.current?.focus();
    }
  };
  return createPortal(
    <div className="nb-overlay" data-nb-modal="" onClick={(e) => e.target === e.currentTarget && setOpen(false)}>
      <div
        className="nb-card nb-dialog nb-anim-pop"
        role="dialog"
        aria-modal="true"
        aria-labelledby="nb-keys-title"
        onKeyDown={keys}
      >
        <div className="nb-spread">
          <h2 className="nb-h2 nb-row" id="nb-keys-title">
            <Icon name="keys" size={30} />
            {t("keys.title")}
          </h2>
          <button type="button" className="nb-btn nb-btn-quiet" ref={close} onClick={() => setOpen(false)}>
            <Kbd>Esc</Kbd> {t("keys.close")}
          </button>
        </div>
        <p className="nb-muted nb-m0">{t("keys.direction")}</p>
        {SHORTCUT_GROUPS.map((g) => (
          <section key={g.title} className="nb-stack" aria-label={t(g.title)}>
            <h3 className="nb-keygroup">{t(g.title)}</h3>
            <ul className="nb-keylist">
              {g.rows.map((r) => (
                <li key={r.label}>
                  <span>{t(r.label)}</span>
                  <span className="nb-keycaps">
                    {r.actions.map((a) => (
                      <Caps key={a} action={a} />
                    ))}
                  </span>
                </li>
              ))}
            </ul>
          </section>
        ))}
      </div>
    </div>,
    document.body,
  );
}
