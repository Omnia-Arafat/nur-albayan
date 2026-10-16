"use client";

import { useEffect } from "react";

/**
 * Boxes whose text must stay inside them: the book's word pills, the home page words and game cells.
 * A joined word cannot wrap without breaking its letters apart, so when it is wider than its box on a
 * small screen, its letters are made smaller just enough to fit.
 */
const FIT = ".nb-pill,.nb-word,.nb-fit";
/** Never smaller than this share of the design size, so a word stays readable. */
const MIN_SCALE = 0.55;

function fit(el: HTMLElement) {
  el.style.removeProperty("font-size");
  const cs = getComputedStyle(el);
  const room = el.clientWidth - parseFloat(cs.paddingInlineStart) - parseFloat(cs.paddingInlineEnd);
  if (room <= 0) return;
  const range = document.createRange();
  range.selectNodeContents(el);
  const need = range.getBoundingClientRect().width;
  if (need <= room + 0.5) return;
  const base = parseFloat(cs.fontSize);
  el.style.fontSize = `${Math.max(base * MIN_SCALE, Math.floor(((base * room) / need) * 0.97 * 10) / 10)}px`;
}

/** Watches the page for those boxes and keeps their text fitted as the screen, fonts or content change. */
export function FitText() {
  useEffect(() => {
    const seen = new WeakSet<Element>();
    const resize = new ResizeObserver((entries) => {
      for (const e of entries) fit(e.target as HTMLElement);
    });
    const scan = (root: ParentNode) => {
      for (const el of root.querySelectorAll<HTMLElement>(FIT)) {
        if (seen.has(el)) continue;
        seen.add(el);
        resize.observe(el);
      }
    };
    let queued = 0;
    const changes = new MutationObserver((records) => {
      // Text replaced inside a box already watched (a new round in a game) needs a fresh fit too.
      for (const r of records) {
        const box = (r.target instanceof Element ? r.target : r.target.parentElement)?.closest<HTMLElement>(FIT);
        if (box && seen.has(box)) fit(box);
      }
      cancelAnimationFrame(queued);
      queued = requestAnimationFrame(() => scan(document.body));
    });
    scan(document.body);
    changes.observe(document.body, { childList: true, subtree: true, characterData: true });
    const refit = () => document.querySelectorAll<HTMLElement>(FIT).forEach(fit);
    void document.fonts?.ready.then(refit);
    return () => {
      resize.disconnect();
      changes.disconnect();
      cancelAnimationFrame(queued);
    };
  }, []);
  return null;
}
