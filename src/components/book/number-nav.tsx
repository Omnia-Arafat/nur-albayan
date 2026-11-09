"use client";

import { useState } from "react";

import { useT } from "@/components/app/app-data";
import { Icon } from "@/components/book/icon";

/** Digits typed in any of the locale scripts (Arabic-Indic, Persian, Latin) as a number: each of those
 * digit blocks starts at a code point that is a multiple of 16. */
export const typedNumber = (s: string) =>
  parseInt(
    s.replace(/\p{Nd}/gu, (c) => String(c.codePointAt(0)! % 16)),
    10,
  );

/**
 * One box to move through numbered things (the book's pages, a deck's cards): an arrow either side and the
 * number in the middle, which you can type over and confirm with Enter.
 */
export function NumberNav({
  id,
  label,
  value,
  total,
  onGo,
  onPrev,
  onNext,
  prevLabel,
  nextLabel,
  prevKeys,
  nextKeys,
}: {
  id: string;
  /** What is counted, before the number: "page", "card". */
  label: string;
  value: number;
  /** Shown after the number: "of 95". */
  total: string;
  onGo: (n: number) => void;
  onPrev: (() => void) | null;
  onNext: (() => void) | null;
  prevLabel: string;
  nextLabel: string;
  prevKeys?: string;
  nextKeys?: string;
}) {
  const t = useT();
  const [typed, setTyped] = useState<string | null>(null);
  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const n = typedNumber(typed ?? "");
    setTyped(null);
    if (Number.isFinite(n) && n !== value) onGo(n);
    (document.getElementById(id) as HTMLInputElement | null)?.blur();
  };
  return (
    <form className="nb-numnav" onSubmit={submit}>
      <button
        type="button"
        className="nb-numnav-arrow nb-tr-press"
        aria-label={prevLabel}
        aria-keyshortcuts={prevKeys}
        disabled={!onPrev}
        onClick={() => onPrev?.()}
      >
        <Icon name="next" size={24} tone="lavender" className="nb-flip nb-dir-flip" />
      </button>
      <label className="nb-numnav-mid" htmlFor={id}>
        <span>{label}</span>
        <input
          id={id}
          className="nb-numnav-input"
          inputMode="numeric"
          autoComplete="off"
          enterKeyHint="go"
          value={typed ?? t.num(value)}
          size={3}
          placeholder={t.num(value)}
          // Focusing empties the box (the number stays as its hint), so what you type replaces it.
          onFocus={() => setTyped("")}
          onBlur={() => setTyped(null)}
          onKeyDown={(e) => {
            // While typing, the arrows and digits belong to the box, not to the page's shortcuts.
            e.stopPropagation();
            if (e.key === "Escape") (e.target as HTMLInputElement).blur();
          }}
          onChange={(e) => setTyped(e.target.value)}
        />
        <span>{total}</span>
      </label>
      <button
        type="button"
        className="nb-numnav-arrow nb-tr-press"
        aria-label={nextLabel}
        aria-keyshortcuts={nextKeys}
        disabled={!onNext}
        onClick={() => onNext?.()}
      >
        <Icon name="next" size={24} tone="lavender" className="nb-dir-flip" />
      </button>
    </form>
  );
}
