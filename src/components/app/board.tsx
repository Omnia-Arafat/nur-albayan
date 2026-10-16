"use client";

import { useEffect, useState } from "react";

import { useT } from "@/components/app/app-data";
import { Icon } from "@/components/book/icon";
import { Meter } from "@/components/book/parts";
import { pillVars, Word } from "@/components/book/word";

/**
 * The classroom board: a second window (on a projector or a big screen) that shows the word being read
 * in a teacher's session, large enough for the whole class. The two windows talk on this device only,
 * so it works offline and nothing about the session leaves the teacher's computer.
 */
const CHANNEL = "nur-albayan.board";

export type BoardState = {
  student: string;
  n: number;
  total: number;
  card: { segments: { text: string; role: string }[]; script: "naskh" | "uthmani"; palette: string } | null;
  accuracy: number | null;
};

/** Sends the session's state to any open board (and answers a board that just opened). */
export function useBoardSender(state: BoardState | null) {
  useEffect(() => {
    if (!state || typeof BroadcastChannel === "undefined") return;
    const ch = new BroadcastChannel(CHANNEL);
    ch.postMessage(state);
    ch.onmessage = (e) => e.data === "hello" && ch.postMessage(state);
    return () => ch.close();
  }, [state]);
}

export function Board() {
  const t = useT();
  const [s, setS] = useState<BoardState | null>(null);
  useEffect(() => {
    if (typeof BroadcastChannel === "undefined") return;
    const ch = new BroadcastChannel(CHANNEL);
    ch.onmessage = (e: MessageEvent<BoardState | string>) => typeof e.data === "object" && setS(e.data);
    ch.postMessage("hello");
    return () => ch.close();
  }, []);
  if (!s)
    return (
      <main className="nb-board nb-board-wait">
        <Icon name="book" size={72} tone="lavender" />
        <p className="nb-h2 nb-center">{t("board.waiting")}</p>
      </main>
    );
  return (
    <main className="nb-board">
      <div className="nb-spread nb-board-top">
        <b>{s.student}</b>
        <span>{t("lesson.cardOf", { n: Math.min(s.n, s.total), total: s.total })}</span>
      </div>
      <Meter value={s.total ? (s.n - (s.card ? 1 : 0)) / s.total : 0} />
      {s.card ? (
        <div
          key={`${s.n}`}
          className="nb-board-word nb-anim-pop"
          style={{
            ...pillVars(s.card.palette),
            fontFamily: s.card.script === "uthmani" ? "var(--nb-font-quran)" : undefined,
          }}
        >
          <Word segments={s.card.segments} />
        </div>
      ) : (
        <div className="nb-board-done nb-anim-pop">
          <Icon name="trophy" size={96} tone="yellow" />
          {s.accuracy != null && <b>{t.pct(s.accuracy)}</b>}
        </div>
      )}
    </main>
  );
}

/** Opens the board in its own window (or brings it forward). */
export const openBoard = (href: string) => window.open(href, "nur-albayan-board", "popup");
