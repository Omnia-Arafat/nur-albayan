"use client";

import { useEffect, useId, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";

/** Segmented pill: one choice of a few, the book's pill with grey dividers. */
export function Seg<T extends string>({
  label,
  options,
  value,
  onChange,
  wide,
}: {
  label: string;
  options: { value: T; label: string }[];
  value: T;
  onChange: (v: T) => void;
  wide?: boolean;
}) {
  return (
    <div className={`nb-seg${wide ? " nb-seg-wide" : ""}`} role="group" aria-label={label}>
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          className="nb-tr-state"
          aria-pressed={o.value === value}
          onClick={() => onChange(o.value)}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

/** On/off switch drawn by the design system (no browser checkbox). */
export function Switch({
  label,
  checked,
  onChange,
}: {
  label: string;
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      className="nb-switch nb-tr-state"
      onClick={() => onChange(!checked)}
    >
      <span>{label}</span>
      <span className="track nb-tr-state" aria-hidden="true" />
    </button>
  );
}

/** Dropdown: a button and the book's own list, with arrow keys, Enter and Escape. */
export function Select<T extends string>({
  label,
  options,
  value,
  onChange,
}: {
  label: string;
  options: { value: T; label: string }[];
  value: T;
  onChange: (v: T) => void;
}) {
  const [open, setOpen] = useState(false);
  const [focus, setFocus] = useState(0);
  const id = useId();
  const box = useRef<HTMLDivElement>(null);
  const list = useRef<HTMLDivElement>(null);
  const current = options.find((o) => o.value === value) ?? options[0];

  const button = useRef<HTMLButtonElement>(null);
  const [place, setPlace] = useState<React.CSSProperties>({});

  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent) => {
      const at = e.target as Node;
      if (!box.current?.contains(at) && !list.current?.contains(at)) setOpen(false);
    };
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, [open]);
  // The list lives on the page's top layer (a portal), so no card or scroll box below can cover or clip it.
  // It follows the button while the page scrolls and opens upwards when there is no room below.
  useLayoutEffect(() => {
    if (!open) return;
    const follow = () => {
      const r = button.current?.getBoundingClientRect();
      if (!r) return;
      const gap = 6;
      const below = window.innerHeight - r.bottom - gap;
      const up = below < 160 && r.top > below;
      setPlace({
        left: r.left,
        width: r.width,
        maxHeight: Math.min(220, (up ? r.top : below) - gap * 2),
        ...(up ? { bottom: window.innerHeight - r.top + gap } : { top: r.bottom + gap }),
      });
    };
    follow();
    window.addEventListener("scroll", follow, true);
    window.addEventListener("resize", follow);
    return () => {
      window.removeEventListener("scroll", follow, true);
      window.removeEventListener("resize", follow);
    };
  }, [open]);
  useEffect(() => {
    if (open) (list.current?.children[focus] as HTMLElement | undefined)?.focus();
  }, [open, focus]);

  const choose = (v: T) => {
    onChange(v);
    setOpen(false);
  };
  const keys = (e: React.KeyboardEvent) => {
    if (e.key === "Escape") setOpen(false);
    if (e.key === "ArrowDown" || e.key === "ArrowUp") {
      e.preventDefault();
      if (!open) {
        setFocus(Math.max(0, options.indexOf(current)));
        setOpen(true);
      } else setFocus((f) => (f + (e.key === "ArrowDown" ? 1 : -1) + options.length) % options.length);
    }
  };

  return (
    <div className="nb-field nb-select-box" ref={box} onKeyDown={keys}>
      <span className="nb-label" id={`${id}-label`}>
        {label}
      </span>
      <button
        type="button"
        ref={button}
        className="nb-select nb-tr-state"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-labelledby={`${id}-label ${id}-value`}
        onClick={() => {
          setFocus(Math.max(0, options.indexOf(current)));
          setOpen(!open);
        }}
      >
        <span id={`${id}-value`}>{current?.label}</span>
        <span className="chev" aria-hidden="true" />
      </button>
      {open &&
        createPortal(
          <div
            className="nb-menu nb-menu-float nb-scroll nb-anim-pop"
            role="listbox"
            aria-labelledby={`${id}-label`}
            ref={list}
            style={place}
          >
            {options.map((o) => (
              <button
                key={o.value}
                type="button"
                role="option"
                aria-selected={o.value === value}
                onClick={() => choose(o.value)}
              >
                {o.label}
              </button>
            ))}
          </div>,
          document.body,
        )}
    </div>
  );
}

/** Number with minus and plus buttons in the book's pill (no browser number input). */
export function Stepper({
  label,
  value,
  onChange,
  min,
  max,
  step = 1,
  format = String,
  lessLabel,
  moreLabel,
}: {
  label: string;
  value: number;
  onChange: (v: number) => void;
  min?: number | null;
  max?: number | null;
  step?: number | null;
  format?: (n: number) => string;
  lessLabel: string;
  moreLabel: string;
}) {
  const by = step || 1;
  const clamp = (n: number) => Math.min(max ?? Infinity, Math.max(min ?? -Infinity, n));
  return (
    <div className="nb-stepper-row">
      <span className="nb-stepper-label">{label}</span>
      <div className="nb-stepper" role="group" aria-label={label}>
        <button
          type="button"
          className="nb-tr-press"
          aria-label={`${lessLabel}: ${label}`}
          disabled={min != null && value <= min}
          onClick={() => onChange(clamp(value - by))}
        >
          <span className="nb-stepper-minus" aria-hidden="true" />
        </button>
        <output aria-live="polite">{format(value)}</output>
        <button
          type="button"
          className="nb-tr-press"
          aria-label={`${moreLabel}: ${label}`}
          disabled={max != null && value >= max}
          onClick={() => onChange(clamp(value + by))}
        >
          <span className="nb-stepper-plus" aria-hidden="true" />
        </button>
      </div>
    </div>
  );
}

/**
 * The search box: filters as each letter is typed, with the book's own clear button in place of the
 * browser's. Matching itself is the caller's (see matchesSearch), so every list searches the same way.
 */
export function SearchField({
  label,
  clearLabel,
  value,
  onChange,
}: {
  label: string;
  clearLabel: string;
  value: string;
  onChange: (v: string) => void;
}) {
  const input = useRef<HTMLInputElement>(null);
  return (
    <label className="nb-field nb-search">
      <span className="nb-label">{label}</span>
      <span className="nb-search-box">
        <input
          ref={input}
          className="nb-input"
          type="text"
          inputMode="search"
          enterKeyHint="search"
          autoComplete="off"
          spellCheck={false}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onKeyDown={(e) => e.key === "Escape" && value && onChange("")}
        />
        {value && (
          <button
            type="button"
            className="nb-search-clear nb-tr-press"
            aria-label={clearLabel}
            onClick={() => {
              onChange("");
              input.current?.focus();
            }}
          >
            <span aria-hidden="true" />
          </button>
        )}
      </span>
    </label>
  );
}
