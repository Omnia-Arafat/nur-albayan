"use client";

import { useEffect, useRef } from "react";

/**
 * For the fixed header: publishes its height as --nb-header-h (so side columns stick just below it)
 * and marks it data-scrolled once the page has moved, which tightens it.
 */
export function useStickyHeader<T extends HTMLElement>() {
  const ref = useRef<T>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const root = document.documentElement;
    const size = new ResizeObserver(() => root.style.setProperty("--nb-header-h", `${el.offsetHeight}px`));
    size.observe(el);
    const scroll = () => el.toggleAttribute("data-scrolled", window.scrollY > 8);
    scroll();
    window.addEventListener("scroll", scroll, { passive: true });
    return () => {
      size.disconnect();
      window.removeEventListener("scroll", scroll);
      root.style.removeProperty("--nb-header-h");
    };
  }, []);
  return ref;
}
