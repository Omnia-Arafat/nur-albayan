/** Word-wall games that share one board (components/screens/word-wall.tsx). */
export const WALL_GAMES = ["boxes", "curtain", "tiles", "honeycomb", "cards", "wheel"] as const;
export type WallGame = (typeof WALL_GAMES)[number];

/** Game keys (seed/games.json) that have a screen; any other game shows as coming soon. */
export const PLAYABLE: ReadonlySet<string> = new Set(["ladder", "xo", "connect4", "memory", ...WALL_GAMES]);
