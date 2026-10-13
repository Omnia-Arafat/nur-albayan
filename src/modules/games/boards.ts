/**
 * Board logic and the computer player for the break games (tic-tac-toe and Connect 4).
 * "easy" plays any free move; "smart" wins when it can, blocks the other side's win, then prefers
 * the middle. Pure functions over plain arrays, so the screens stay thin and the rules are tested.
 */
export type Player = "x" | "o";
export type Cell = Player | null;
export type Difficulty = "easy" | "smart";

const other = (p: Player): Player => (p === "x" ? "o" : "x");
const pickAny = <T>(xs: T[], rand: () => number) => xs[Math.floor(rand() * xs.length)];

// ---------- tic-tac-toe: 9 cells, row by row ----------

const LINES = [
  [0, 1, 2],
  [3, 4, 5],
  [6, 7, 8],
  [0, 3, 6],
  [1, 4, 7],
  [2, 5, 8],
  [0, 4, 8],
  [2, 4, 6],
];

/** The winner and the winning line, "draw" on a full board, or null while the game goes on. */
export function xoResult(b: Cell[]): { winner: Player; line: number[] } | "draw" | null {
  for (const line of LINES) {
    const [a, c, d] = line;
    if (b[a] && b[a] === b[c] && b[a] === b[d]) return { winner: b[a] as Player, line };
  }
  return b.every(Boolean) ? "draw" : null;
}

const free = (b: Cell[]) => b.flatMap((c, i) => (c ? [] : [i]));

export function xoMove(b: Cell[], me: Player, level: Difficulty, rand = Math.random): number {
  const open = free(b);
  if (level === "easy") return pickAny(open, rand);
  const winsWith = (p: Player) =>
    open.find((i) => {
      const r = xoResult(b.map((c, k) => (k === i ? p : c)));
      return r !== null && r !== "draw" && r.winner === p;
    });
  const win = winsWith(me) ?? winsWith(other(me));
  if (win !== undefined) return win;
  if (!b[4]) return 4;
  const corners = [0, 2, 6, 8].filter((i) => !b[i]);
  return corners.length ? pickAny(corners, rand) : pickAny(open, rand);
}

// ---------- Connect 4: cols x rows, cell index = row * cols + col, row 0 at the top ----------

export type Grid = { rows: number; cols: number; cells: Cell[] };

export const emptyGrid = (rows: number, cols: number): Grid => ({ rows, cols, cells: Array(rows * cols).fill(null) });

/** The row a disc dropped in `col` lands on, or -1 when the column is full. */
export function landing(g: Grid, col: number) {
  for (let row = g.rows - 1; row >= 0; row--) if (!g.cells[row * g.cols + col]) return row;
  return -1;
}

export function drop(g: Grid, col: number, p: Player): Grid {
  const row = landing(g, col);
  if (row < 0) return g;
  const cells = g.cells.slice();
  cells[row * g.cols + col] = p;
  return { ...g, cells };
}

export function c4Result(g: Grid): { winner: Player; line: number[] } | "draw" | null {
  const at = (r: number, c: number) => (r >= 0 && r < g.rows && c >= 0 && c < g.cols ? g.cells[r * g.cols + c] : null);
  for (let r = 0; r < g.rows; r++)
    for (let c = 0; c < g.cols; c++) {
      const p = at(r, c);
      if (!p) continue;
      for (const [dr, dc] of [
        [0, 1],
        [1, 0],
        [1, 1],
        [1, -1],
      ]) {
        const line = [0, 1, 2, 3].map((k) => [r + dr * k, c + dc * k] as const);
        if (line.every(([y, x]) => at(y, x) === p)) return { winner: p, line: line.map(([y, x]) => y * g.cols + x) };
      }
    }
  return g.cells.every(Boolean) ? "draw" : null;
}

const openCols = (g: Grid) => Array.from({ length: g.cols }, (_, c) => c).filter((c) => landing(g, c) >= 0);
const winsAt = (g: Grid, c: number, p: Player) => {
  const r = c4Result(drop(g, c, p));
  return r !== null && r !== "draw" && r.winner === p;
};

export function c4Move(g: Grid, me: Player, level: Difficulty, rand = Math.random): number {
  const cols = openCols(g);
  if (level === "easy") return pickAny(cols, rand);
  const win = cols.find((c) => winsAt(g, c, me)) ?? cols.find((c) => winsAt(g, c, other(me)));
  if (win !== undefined) return win;
  // Avoid a move that lets the other side win on the disc above it.
  const safe = cols.filter((c) => !openCols(drop(g, c, me)).some((k) => winsAt(drop(g, c, me), k, other(me))));
  const choices = safe.length ? safe : cols;
  const mid = (g.cols - 1) / 2;
  const best = Math.min(...choices.map((c) => Math.abs(c - mid)));
  return pickAny(
    choices.filter((c) => Math.abs(c - mid) === best),
    rand,
  );
}
