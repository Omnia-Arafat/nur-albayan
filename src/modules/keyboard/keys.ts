/**
 * The keyboard shortcuts, by action. Page turning follows the reading direction: in a right-to-left
 * language the left arrow turns forward (the next page lies to the left, as in the printed book), in a
 * left-to-right one the right arrow does. Labels live in ui_messages (keys.*); only key names live here.
 */
export type Action =
  | "book.next"
  | "book.prev"
  | "book.first"
  | "book.last"
  | "book.nextUnit"
  | "book.prevUnit"
  | "book.goto"
  | "book.open"
  | "cards.right"
  | "cards.again"
  | "cards.back"
  | "help";

export type Dir = "rtl" | "ltr";

const FIXED: Record<Exclude<Action, "book.next" | "book.prev">, string[]> = {
  "book.first": ["Home"],
  "book.last": ["End"],
  "book.nextUnit": ["PageDown"],
  "book.prevUnit": ["PageUp"],
  "book.goto": ["g", "G"],
  "book.open": ["Enter"],
  "cards.right": ["1"],
  "cards.again": ["2"],
  "cards.back": ["Escape"],
  help: ["?"],
};

/** The keys (KeyboardEvent.key values) that trigger an action in a reading direction. */
export function keysFor(action: Action, dir: Dir): string[] {
  const forward = dir === "rtl" ? "ArrowLeft" : "ArrowRight";
  const back = dir === "rtl" ? "ArrowRight" : "ArrowLeft";
  if (action === "book.next") return [forward];
  if (action === "book.prev") return [back];
  return FIXED[action];
}

/** How a key is printed on its key cap. */
const CAP: Record<string, string> = {
  ArrowLeft: "←",
  ArrowRight: "→",
  PageDown: "PgDn",
  PageUp: "PgUp",
  Escape: "Esc",
  g: "G",
};

export const capOf = (key: string) => CAP[key] ?? key;

/** The caps to show for an action (one per distinct key, so G is not listed twice). */
export const capsFor = (action: Action, dir: Dir) => [...new Set(keysFor(action, dir).map(capOf))];

/** aria-keyshortcuts value for a control that does the same as an action. */
export const ariaKeys = (action: Action, dir: Dir) => keysFor(action, dir)[0];

/** The action a key press stands for, among the ones a screen listens to; modifier chords are left to the browser. */
export function actionOf(
  e: { key: string; ctrlKey: boolean; metaKey: boolean; altKey: boolean },
  dir: Dir,
  listening: Action[],
): Action | null {
  if (e.ctrlKey || e.metaKey || e.altKey) return null;
  return listening.find((a) => keysFor(a, dir).includes(e.key)) ?? null;
}

/** Keys that controls handle themselves while they have focus (typing, choosing, pressing). */
export function ownsKey(target: EventTarget | null, key: string): boolean {
  const el = target as HTMLElement | null;
  if (!el || typeof el.closest !== "function") return false;
  if (el.isContentEditable || el.closest("input, textarea, select, [role='listbox'], [role='menu']")) return true;
  // Enter and space press the focused button or link; leave them to it.
  if ((key === "Enter" || key === " ") && el.closest("button, a, [role='button'], [role='switch']")) return true;
  return false;
}

/** The shortcut list on the help sheet: groups of rows, each a label key and the actions it shows. */
export const SHORTCUT_GROUPS: { title: string; rows: { label: string; actions: Action[] }[] }[] = [
  {
    title: "keys.group.book",
    rows: [
      { label: "keys.next", actions: ["book.next"] },
      { label: "keys.prev", actions: ["book.prev"] },
      { label: "keys.firstLast", actions: ["book.first", "book.last"] },
      { label: "keys.units", actions: ["book.nextUnit", "book.prevUnit"] },
      { label: "keys.goto", actions: ["book.goto"] },
      { label: "keys.open", actions: ["book.open"] },
    ],
  },
  {
    title: "keys.group.cards",
    rows: [
      { label: "keys.right", actions: ["cards.right"] },
      { label: "keys.again", actions: ["cards.again"] },
      { label: "keys.back", actions: ["cards.back"] },
    ],
  },
  {
    title: "keys.group.everywhere",
    rows: [{ label: "keys.help", actions: ["help"] }],
  },
];
