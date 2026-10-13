import { notFound } from "next/navigation";

import { ConnectFour, MemoryMatch, TicTacToe } from "@/components/screens/break-games";
import { Ladder } from "@/components/screens/ladder";
import { WordWall } from "@/components/screens/word-wall";
import { PLAYABLE, WALL_GAMES } from "@/modules/games/screens";

/** The screen for each playable game, by its key in seed/games.json (see modules/games/screens). */
const SCREENS: Record<string, (p: { from: string }) => React.ReactNode> = {
  ladder: Ladder,
  xo: TicTacToe,
  connect4: ConnectFour,
  memory: MemoryMatch,
  ...Object.fromEntries(WALL_GAMES.map((g) => [g, ({ from }: { from: string }) => <WordWall game={g} from={from} />])),
};

export default async function Page(props: PageProps<"/[locale]/games/[game]">) {
  const [{ game }, q] = await Promise.all([props.params, props.searchParams]);
  const Screen = SCREENS[game];
  if (!Screen || !PLAYABLE.has(game)) notFound();
  const from = Array.isArray(q.from) ? q.from[0] : q.from;
  // An unknown or missing source falls back to "" and the screen shows its empty state with a way back.
  return <Screen from={from === "bank" || (from && /^\d+$/.test(from)) ? from : ""} />;
}
