"use client";

import { useEffect, useId, useRef, useState } from "react";

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

  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent) => !box.current?.contains(e.target as Node) && setOpen(false);
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
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
      {open && (
        <div className="nb-menu nb-scroll nb-anim-pop" role="listbox" aria-labelledby={`${id}-label`} ref={list}>
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
        </div>
      )}
    </div>
  );
}
