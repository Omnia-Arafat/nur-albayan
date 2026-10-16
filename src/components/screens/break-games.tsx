"use client";

import { useEffect, useState } from "react";

import { useSound } from "@/components/app/sound";
import { useApp, useT } from "@/components/app/app-data";
import { Seg } from "@/components/book/controls";
import { Icon } from "@/components/book/icon";
import { Pill, pillVars } from "@/components/book/word";
import {
  c4Move,
  c4Result,
  type Cell,
  type Difficulty,
  drop,
  emptyGrid,
  type Grid,
  landing,
  type Player,
  xoMove,
  xoResult,
} from "@/modules/games/boards";

import { GameShell, NoWords, shuffled, useGameWords } from "./word-game";

/**
 * The breaks between lessons: tic-tac-toe, Connect 4 and the memory game. They are rest, not
 * practice, so they give no points. The board games play against the computer (easy or smart) or
 * against the teacher on the same screen.
 */
type Mode = "computer" | "teacher";
type BreakConfig = { modes?: Mode[]; difficulties?: Difficulty[]; rows?: number; cols?: number; pairs?: number };

/** On its own page a break has the games frame; inside a lesson it is just the board and its tools. */
function Frame({
  embedded,
  gameKey,
  from,
  tools,
  children,
}: {
  embedded?: boolean;
  gameKey: string;
  from: string;
  tools?: React.ReactNode;
  children: React.ReactNode;
}) {
  if (!embedded)
    return (
      <GameShell gameKey={gameKey} from={from} tools={tools}>
        {children}
      </GameShell>
    );
  return (
    <div className="nb-stack-lg">
      {tools && <div className="nb-row nb-center">{tools}</div>}
      {children}
    </div>
  );
}

/** Pause before the computer answers, so its move reads as a turn rather than a jump. */
const THINK_MS = 450;
const SIDE: Record<Player, string> = { x: "pink", o: "sky" };

function useBreak(key: string) {
  const { catalog } = useApp();
  const cfg = (catalog.games.find((g) => g.key === key)?.defaultConfig ?? {}) as BreakConfig;
  const modes = cfg.modes ?? ["computer", "teacher"];
  const levels = cfg.difficulties ?? ["easy", "smart"];
  const [mode, setMode] = useState<Mode>(modes[0]);
  const [level, setLevel] = useState<Difficulty>(levels[0]);
  return { cfg, modes, levels, mode, setMode, level, setLevel };
}

function BreakTools({ b }: { b: ReturnType<typeof useBreak> }) {
  const t = useT();
  return (
    <>
      <Seg
        label={t("break.mode")}
        value={b.mode}
        onChange={b.setMode}
        options={b.modes.map((m) => ({ value: m, label: t(`break.vs.${m}`) }))}
      />
      {b.mode === "computer" && (
        <Seg
          label={t("break.level")}
          value={b.level}
          onChange={b.setLevel}
          options={b.levels.map((l) => ({ value: l, label: t(`break.level.${l}`) }))}
        />
      )}
    </>
  );
}

/** Whose turn it is, or how the game ended, with the two sides' marks. */
function Status({
  turn,
  result,
  mode,
  mark,
  onAgain,
}: {
  turn: Player;
  result: { winner: Player } | "draw" | null;
  mode: Mode;
  mark: (p: Player) => React.ReactNode;
  onAgain: () => void;
}) {
  const t = useT();
  const play = useSound();
  const ended = result === "draw" ? "draw" : result ? result.winner : null;
  useEffect(() => {
    if (ended) play(ended === "draw" ? "draw" : ended === "x" ? "win" : "again");
  }, [ended, play]);
  const name = (p: Player) => (p === "x" ? t("break.you") : t(`break.side.${mode}`));
  const text =
    result === "draw"
      ? t("break.draw")
      : result
        ? result.winner === "x"
          ? t("break.youWin")
          : t("break.theyWin", { name: name(result.winner) })
        : turn === "x"
          ? t("break.yourTurn")
          : t("break.turnOf", { name: name(turn) });
  return (
    <div className="nb-break-status">
      <div className="nb-row nb-center">
        {(["x", "o"] as const).map((p) => (
          <span key={p} className={`nb-break-side${!result && turn === p ? " on" : ""}`} style={pillVars(SIDE[p])}>
            {mark(p)} {name(p)}
          </span>
        ))}
      </div>
      <p className={`nb-m0 nb-center nb-break-text${result ? " nb-anim-pop" : ""}`} role="status">
        {result && result !== "draw" && result.winner === "x" && <Icon name="crown" size={28} />} <b>{text}</b>
      </p>
      {result && (
        <button type="button" className="nb-btn nb-btn-ok nb-btn-big nb-self-center" onClick={onAgain}>
          {t("break.again")}
        </button>
      )}
    </div>
  );
}

/** Drawn marks (no letters or emoji): two crossed bars, or a ring. */
const XoMark = ({ p }: { p: Player }) => <span className={`nb-xo-mark ${p}`} aria-hidden="true" />;

export function TicTacToe({ from, embedded }: { from: string; embedded?: boolean }) {
  const t = useT();
  const b = useBreak("xo");
  const [board, setBoard] = useState<Cell[]>(Array(9).fill(null));
  const [turn, setTurn] = useState<Player>("x");
  const result = xoResult(board);
  const computerTurn = b.mode === "computer" && turn === "o" && !result;

  useEffect(() => {
    if (!computerTurn) return;
    const id = setTimeout(() => {
      const i = xoMove(board, "o", b.level);
      setBoard((cur) => cur.map((c, k) => (k === i ? "o" : c)));
      setTurn("x");
    }, THINK_MS);
    return () => clearTimeout(id);
  }, [computerTurn, board, b.level]);

  const play = (i: number) => {
    if (board[i] || result || computerTurn) return;
    setBoard(board.map((c, k) => (k === i ? turn : c)));
    setTurn(turn === "x" ? "o" : "x");
  };
  const again = () => {
    setBoard(Array(9).fill(null));
    setTurn("x");
  };
  const line = result && result !== "draw" ? result.line : [];
  return (
    <Frame embedded={embedded} gameKey="xo" from={from} tools={<BreakTools b={b} />}>
      <section className="nb-card nb-anim-rise nb-break-card">
        <Status turn={turn} result={result} mode={b.mode} mark={(p) => <XoMark p={p} />} onAgain={again} />
        <div className="nb-xo" role="grid" aria-label={t("break.board")}>
          {board.map((c, i) => (
            <button
              key={i}
              type="button"
              role="gridcell"
              className={`nb-xo-cell nb-tr-press${line.includes(i) ? " win" : ""}`}
              style={c ? pillVars(SIDE[c]) : undefined}
              disabled={Boolean(c) || Boolean(result) || computerTurn}
              aria-label={t(c ? `break.cell.${c === "x" ? "you" : "them"}` : "break.cell.empty", { n: t.num(i + 1) })}
              onClick={() => play(i)}
            >
              {c && (
                <span className="nb-anim-pop nb-flex">
                  <XoMark p={c} />
                </span>
              )}
            </button>
          ))}
        </div>
      </section>
    </Frame>
  );
}

const Disc = ({ p }: { p: Player }) => <span className="nb-disc" style={pillVars(SIDE[p])} aria-hidden="true" />;

export function ConnectFour({ from, embedded }: { from: string; embedded?: boolean }) {
  const t = useT();
  const b = useBreak("connect4");
  const fresh = () => emptyGrid(b.cfg.rows ?? 6, b.cfg.cols ?? 7);
  const [grid, setGrid] = useState<Grid>(fresh);
  const [turn, setTurn] = useState<Player>("x");
  const [last, setLast] = useState(-1);
  const result = c4Result(grid);
  const computerTurn = b.mode === "computer" && turn === "o" && !result;

  useEffect(() => {
    if (!computerTurn) return;
    const id = setTimeout(() => {
      const col = c4Move(grid, "o", b.level);
      setLast(landing(grid, col) * grid.cols + col);
      setGrid(drop(grid, col, "o"));
      setTurn("x");
    }, THINK_MS);
    return () => clearTimeout(id);
  }, [computerTurn, grid, b.level]);

  const play = (col: number) => {
    if (result || computerTurn || landing(grid, col) < 0) return;
    setLast(landing(grid, col) * grid.cols + col);
    setGrid(drop(grid, col, turn));
    setTurn(turn === "x" ? "o" : "x");
  };
  const again = () => {
    setGrid(fresh());
    setTurn("x");
    setLast(-1);
  };
  const line = result && result !== "draw" ? result.line : [];
  return (
    <Frame embedded={embedded} gameKey="connect4" from={from} tools={<BreakTools b={b} />}>
      <section className="nb-card nb-anim-rise nb-break-card">
        <Status turn={turn} result={result} mode={b.mode} mark={(p) => <Disc p={p} />} onAgain={again} />
        <div className="nb-c4" style={{ "--cols": grid.cols } as React.CSSProperties} dir="ltr">
          {Array.from({ length: grid.cols }, (_, col) => (
            <button
              key={col}
              type="button"
              className="nb-c4-col nb-tr-press"
              disabled={Boolean(result) || computerTurn || landing(grid, col) < 0}
              aria-label={t("break.column", { n: t.num(col + 1) })}
              onClick={() => play(col)}
            >
              {Array.from({ length: grid.rows }, (_, row) => {
                const i = row * grid.cols + col;
                const c = grid.cells[i];
                return (
                  <span key={row} className={`nb-c4-hole${line.includes(i) ? " win" : ""}`}>
                    {c && (
                      <span className={i === last ? "nb-anim-drop nb-flex" : "nb-flex"}>
                        <Disc p={c} />
                      </span>
                    )}
                  </span>
                );
              })}
            </button>
          ))}
        </div>
      </section>
    </Frame>
  );
}

/** Pairs of the page's own words, face down; find the two of each. */
export function MemoryMatch({ from, embedded }: { from: string; embedded?: boolean }) {
  const t = useT();
  const b = useBreak("memory");
  const { words, ready } = useGameWords(from);
  const [round, setRound] = useState(1);
  const chosen = shuffled(words, round).slice(0, b.cfg.pairs ?? 6);
  const deck = shuffled(
    chosen.flatMap((w) => [
      { w, k: `${w.id}:a` },
      { w, k: `${w.id}:b` },
    ]),
    round + 1,
  );
  const key = `${round}:${deck.map((d) => d.k).join(",")}`;
  const fresh = () => ({ key, up: [] as string[], found: [] as string[], moves: 0 });
  const [run, setRun] = useState(fresh);
  if (run.key !== key) setRun(fresh());
  const r = run.key === key ? run : fresh();

  // Two cards that don't match turn back over after a moment.
  useEffect(() => {
    if (r.up.length < 2) return;
    const id = setTimeout(() => setRun((cur) => ({ ...cur, up: [] })), THINK_MS * 2);
    return () => clearTimeout(id);
  }, [r.up]);

  if (!ready || !words.length)
    return (
      <Frame embedded={embedded} gameKey="memory" from={from}>
        <NoWords from={from} loading={!ready} />
      </Frame>
    );

  const flip = (card: (typeof deck)[number]) => {
    if (r.up.length >= 2 || r.up.includes(card.k) || r.found.includes(card.w.id)) return;
    const up = [...r.up, card.k];
    const pair = up.length === 2 && up[0].split(":")[0] === up[1].split(":")[0];
    setRun({
      ...r,
      up: pair ? [] : up,
      found: pair ? [...r.found, card.w.id] : r.found,
      moves: r.moves + (up.length === 2 ? 1 : 0),
    });
  };
  const won = chosen.length > 0 && r.found.length === chosen.length;
  return (
    <Frame embedded={embedded} gameKey="memory" from={from}>
      <section className="nb-card nb-anim-rise nb-break-card">
        <div className="nb-spread">
          <span className="nb-muted">
            {t("break.pairs", { n: t.num(r.found.length), total: t.num(chosen.length) })}
          </span>
          <span className="nb-muted">{t("break.moves", { n: t.num(r.moves) })}</span>
        </div>
        <div className="nb-memory">
          {deck.map((card, i) => {
            const shown = r.up.includes(card.k) || r.found.includes(card.w.id);
            return (
              <button
                key={card.k}
                type="button"
                className={`nb-memory-card nb-tr-press${shown ? " up" : ""}${r.found.includes(card.w.id) ? " found" : ""}`}
                aria-label={shown ? undefined : t("games.cellLabel", { n: t.num(i + 1) })}
                onClick={() => flip(card)}
              >
                {shown ? (
                  <span className="nb-anim-flip nb-flex">
                    <Pill
                      segments={card.w.segments}
                      script={card.w.script}
                      palette={r.found.includes(card.w.id) ? "lime" : "yellow"}
                      size={22}
                    />
                  </span>
                ) : (
                  <Icon name="star" size={26} tone="lavender" />
                )}
              </button>
            );
          })}
        </div>
        {won && (
          <div className="nb-break-status">
            <p className="nb-m0 nb-center nb-break-text nb-anim-pop" role="status">
              <Icon name="crown" size={28} /> <b>{t("break.memoryWin", { n: t.num(r.moves) })}</b>
            </p>
            <button
              type="button"
              className="nb-btn nb-btn-ok nb-btn-big nb-self-center"
              onClick={() => setRound(round + 2)}
            >
              {t("break.again")}
            </button>
          </div>
        )}
      </section>
    </Frame>
  );
}
