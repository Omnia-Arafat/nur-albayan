"use client";

import { useApp, useT } from "@/components/app/app-data";
import { Icon } from "@/components/book/icon";
import { pillVars } from "@/components/book/word";
import { PLAYABLE, WALL_GAMES, type WallGame } from "@/modules/games/screens";

import { ConnectFour, MemoryMatch, TicTacToe } from "./break-games";
import { Ladder } from "./ladder";
import { GameEmbedded, paletteOf } from "./word-game";
import { WordWall } from "./word-wall";

/** Every playable game by its key in seed/games.json, fed with one page's words. */
const SCREENS: Record<string, (p: { from: string }) => React.ReactNode> = {
  ladder: Ladder,
  xo: (p) => <TicTacToe {...p} embedded />,
  connect4: (p) => <ConnectFour {...p} embedded />,
  memory: (p) => <MemoryMatch {...p} embedded />,
  ...Object.fromEntries(
    WALL_GAMES.map((g: WallGame) => [g, ({ from }: { from: string }) => <WordWall game={g} from={from} />]),
  ),
};

/** The games inside a lesson: one strip with every game, and the chosen one playing this page's words below it. */
export function LessonGames({
  page,
  game,
  onGame,
}: {
  page: number;
  game: string | null;
  onGame: (key: string) => void;
}) {
  const { catalog } = useApp();
  const t = useT();
  // Word games first, then the breaks, each in the order the platform set.
  const games = catalog.games
    .filter((g) => PLAYABLE.has(g.key) && SCREENS[g.key])
    .sort((a, b) => Number(a.kind === "break") - Number(b.kind === "break") || a.position - b.position);
  const chosen = games.find((g) => g.key === game) ?? games[0];
  if (!chosen) return null;
  const Screen = SCREENS[chosen.key];
  return (
    <section className="nb-card nb-anim-rise nb-lesson-games" aria-label={t("lesson.gamesFor", { page })}>
      <nav className="nb-strip nb-game-strip" aria-label={t("lesson.wordGames")}>
        {games.map((g) => {
          const pal = paletteOf(g.fillTokenKey);
          return (
            <button
              key={g.key}
              type="button"
              className="nb-unit nb-game-chip nb-tr-state nb-tr-press"
              style={pillVars(pal)}
              aria-pressed={g.key === chosen.key}
              onClick={() => onGame(g.key)}
            >
              <Icon name={g.iconKey} size={24} tone={pal} />
              {g.name}
            </button>
          );
        })}
      </nav>
      <GameEmbedded.Provider value={true}>
        <Screen key={`${chosen.key}:${page}`} from={String(page)} />
      </GameEmbedded.Provider>
    </section>
  );
}
