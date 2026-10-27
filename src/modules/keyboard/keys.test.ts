import { describe, expect, it } from "vitest";

import { actionOf, capsFor, keysFor, SHORTCUT_GROUPS } from "./keys";

const press = (key: string, mods: Partial<{ ctrlKey: boolean; metaKey: boolean; altKey: boolean }> = {}) => ({
  key,
  ctrlKey: false,
  metaKey: false,
  altKey: false,
  ...mods,
});

describe("keyboard shortcuts", () => {
  it("turns pages in reading direction", () => {
    expect(keysFor("book.next", "rtl")).toEqual(["ArrowLeft"]);
    expect(keysFor("book.prev", "rtl")).toEqual(["ArrowRight"]);
    expect(keysFor("book.next", "ltr")).toEqual(["ArrowRight"]);
    expect(keysFor("book.prev", "ltr")).toEqual(["ArrowLeft"]);
  });

  it("finds the action a key stands for among the ones listened to", () => {
    const listening = ["book.next", "book.prev", "book.goto"] as const;
    expect(actionOf(press("ArrowLeft"), "rtl", [...listening])).toBe("book.next");
    expect(actionOf(press("ArrowLeft"), "ltr", [...listening])).toBe("book.prev");
    expect(actionOf(press("G"), "rtl", [...listening])).toBe("book.goto");
    expect(actionOf(press("Home"), "rtl", [...listening])).toBeNull();
  });

  it("leaves modifier chords to the browser", () => {
    expect(actionOf(press("ArrowLeft", { altKey: true }), "rtl", ["book.next"])).toBeNull();
    expect(actionOf(press("g", { ctrlKey: true }), "rtl", ["book.goto"])).toBeNull();
  });

  it("prints each key once on its cap", () => {
    expect(capsFor("book.goto", "rtl")).toEqual(["G"]);
    expect(capsFor("book.next", "rtl")).toEqual(["←"]);
    expect(capsFor("cards.back", "ltr")).toEqual(["Esc"]);
  });

  it("lists every row with at least one action", () => {
    for (const g of SHORTCUT_GROUPS) for (const r of g.rows) expect(r.actions.length).toBeGreaterThan(0);
  });
});
