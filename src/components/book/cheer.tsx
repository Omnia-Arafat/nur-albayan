"use client";

import { Icon } from "@/components/book/icon";
import { pillVars } from "@/components/book/word";

/** A small repeatable pseudo-random number in [0, 1) from a seed, so a burst looks the same on every render. */
const rand = (seed: number) => {
  const x = Math.sin(seed * 9301 + 49297) * 233280;
  return x - Math.floor(x);
};

export type CheerShot = {
  /** Grows with every grade, so each one plays its animation afresh. */
  n: number;
  result: "correct" | "wrong";
  /** The cheer word (from the feedback messages) and the points it won. */
  text: string;
  points?: string;
  /** A run of right reads: pieces rain over the whole screen as well. */
  big?: boolean;
};

/**
 * The celebration over a card read right: the cheer word and points pop up, and stars and pill-coloured
 * pieces of the book's palette burst out of the card; a run of right reads also rains them over the screen.
 * A card that needs another try gets only a calm word. Everything is a named motion (seed/motion.json),
 * so reduced motion leaves just the word.
 */
export function Cheer({ shot, palette }: { shot: CheerShot | null; palette: string[] }) {
  if (!shot) return null;
  const right = shot.result === "correct";
  const pal = (k: number) => palette[k % palette.length] ?? "yellow";
  const burst = right ? 18 : 0;
  const shower = right && shot.big ? 36 : 0;
  return (
    <>
      <div key={`w${shot.n}`} className="nb-cheer" aria-hidden="true">
        <span className={`nb-cheer-word nb-anim-cheer${right ? "" : " nb-cheer-calm"}`}>
          {right && <Icon name="star" size={30} />}
          {shot.text}
          {shot.points && (
            <b className="nb-cheer-points" dir="ltr">
              {shot.points}
            </b>
          )}
        </span>
      </div>
      {burst > 0 && (
        <div key={`b${shot.n}`} className="nb-burst" aria-hidden="true">
          {Array.from({ length: burst }, (_, k) => {
            const angle = (k / burst) * Math.PI * 2 + rand(shot.n + k) * 0.5;
            const reach = 110 + rand(shot.n * 7 + k) * 120;
            return (
              <span
                key={k}
                className={`nb-piece nb-anim-burst${k % 3 === 0 ? " nb-piece-star" : ""}`}
                style={
                  {
                    ...pillVars(pal(k + shot.n)),
                    "--dx": `${Math.round(Math.cos(angle) * reach)}px`,
                    "--dy": `${Math.round(Math.sin(angle) * reach)}px`,
                    "--r": `${Math.round((rand(k + 3) - 0.5) * 540)}deg`,
                    animationDelay: `${Math.round(rand(k + shot.n) * 120)}ms`,
                  } as React.CSSProperties
                }
              >
                {k % 3 === 0 && <Icon name="star" size={26} tone={pal(k + shot.n)} />}
              </span>
            );
          })}
        </div>
      )}
      {shower > 0 && (
        <div key={`s${shot.n}`} className="nb-shower" aria-hidden="true">
          {Array.from({ length: shower }, (_, k) => (
            <span
              key={k}
              className={`nb-piece nb-anim-shower${k % 4 === 0 ? " nb-piece-star" : ""}`}
              style={
                {
                  ...pillVars(pal(k)),
                  insetInlineStart: `${Math.round(rand(k * 13 + shot.n) * 96)}%`,
                  "--dx": `${Math.round((rand(k + 11) - 0.5) * 160)}px`,
                  "--r": `${Math.round((rand(k + 5) - 0.5) * 900)}deg`,
                  animationDelay: `${Math.round(rand(k * 3 + shot.n) * 700)}ms`,
                } as React.CSSProperties
              }
            >
              {k % 4 === 0 && <Icon name="star" size={28} tone={pal(k)} />}
            </span>
          ))}
        </div>
      )}
    </>
  );
}
