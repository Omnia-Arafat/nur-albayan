import { describe, expect, it } from "vitest";

import { c4Move, c4Result, type Cell, drop, emptyGrid, landing, xoMove, xoResult } from "@/modules/games/boards";

const xo = (s: string): Cell[] => [...s].map((c) => (c === "x" ? "x" : c === "o" ? "o" : null));

describe("tic-tac-toe", () => {
  it("finds the winner, a draw, or a game still going", () => {
    expect(xoResult(xo("xxxoo...."))).toMatchObject({ winner: "x", line: [0, 1, 2] });
    expect(xoResult(xo("xoxxoooxx"))).toBe("draw");
    expect(xoResult(xo("x........"))).toBeNull();
  });

  it("smart wins first, then blocks, then takes the middle", () => {
    expect(xoMove(xo("oo.xx...."), "o", "smart")).toBe(2);
    expect(xoMove(xo("xx......."), "o", "smart")).toBe(2);
    expect(xoMove(xo("x........"), "o", "smart")).toBe(4);
  });

  it("easy only ever plays a free cell", () => {
    const b = xo("xoxoxo...");
    for (let i = 0; i < 20; i++) expect([6, 7, 8]).toContain(xoMove(b, "x", "easy"));
  });
});

describe("Connect 4", () => {
  it("drops discs to the lowest free row and spots four in a row", () => {
    let g = emptyGrid(6, 7);
    expect(landing(g, 3)).toBe(5);
    for (const c of [0, 1, 2, 3]) g = drop(g, c, "x");
    expect(c4Result(g)).toMatchObject({ winner: "x" });
    let v = emptyGrid(6, 7);
    for (let i = 0; i < 6; i++) v = drop(v, 0, "o");
    expect(landing(v, 0)).toBe(-1);
  });

  it("smart takes a win, blocks a win, and otherwise plays the middle", () => {
    let g = emptyGrid(6, 7);
    for (const c of [0, 1, 2]) g = drop(g, c, "x");
    expect(c4Move(g, "o", "smart")).toBe(3);
    expect(c4Move(g, "x", "smart")).toBe(3);
    expect(c4Move(emptyGrid(6, 7), "o", "smart")).toBe(3);
  });
});
