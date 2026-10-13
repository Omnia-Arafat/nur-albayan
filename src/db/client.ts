import "server-only";

import type { PgDatabase, PgQueryResultHKT } from "drizzle-orm/pg-core";

import * as schema from "./schema";

export type Db = PgDatabase<PgQueryResultHKT, typeof schema>;

// Supabase in production (postgres-js). For local work without Supabase, set
// DATABASE_URL=pglite:.data/pglite and run `pnpm db:local` once to create and seed it.
const url = process.env.DATABASE_URL;
if (!url) throw new Error("DATABASE_URL is not set (use pglite:.data/pglite for a local database)");

async function connect(): Promise<Db> {
  if (url!.startsWith("pglite:")) {
    const { PGlite } = await import("@electric-sql/pglite");
    const { drizzle } = await import("drizzle-orm/pglite");
    return drizzle(new PGlite(url!.slice("pglite:".length)), { schema }) as unknown as Db;
  }
  const { default: postgres } = await import("postgres");
  const { drizzle } = await import("drizzle-orm/postgres-js");
  // Supabase's session pooler allows 15 clients in total across every server instance, so each instance keeps
  // only a few and lets idle ones go. prepare: false keeps the transaction pooler usable as well.
  const max = Number(process.env.DATABASE_POOL_MAX ?? 3);
  return drizzle(postgres(url!, { prepare: false, max, idle_timeout: 20 }), { schema }) as unknown as Db;
}

// One connection per server process, kept across hot reloads in development.
const g = globalThis as unknown as { nbDb?: Promise<Db> };
export const getDb = () => (g.nbDb ??= connect());
