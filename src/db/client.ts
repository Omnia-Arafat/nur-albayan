import "server-only";

import type { PgDatabase, PgQueryResultHKT } from "drizzle-orm/pg-core";

import * as schema from "./schema";

export type Db = PgDatabase<PgQueryResultHKT, typeof schema>;

// Supabase in production (node-postgres). For local work without Supabase, set
// DATABASE_URL=pglite:.data/pglite and run `pnpm db:local` once to create and seed it.
const url = process.env.DATABASE_URL;
if (!url) throw new Error("DATABASE_URL is not set (use pglite:.data/pglite for a local database)");

async function connect(): Promise<Db> {
  if (url!.startsWith("pglite:")) {
    const { PGlite } = await import("@electric-sql/pglite");
    const { drizzle } = await import("drizzle-orm/pglite");
    return drizzle(new PGlite(url!.slice("pglite:".length)), { schema }) as unknown as Db;
  }
  const { Pool } = await import("pg");
  const { drizzle } = await import("drizzle-orm/node-postgres");
  const { attachDatabasePool } = await import("@vercel/functions");
  // Supabase's session pooler allows 15 clients in total across every server instance. A suspended Vercel
  // instance never runs its idle timers, so attachDatabasePool closes idle clients before it suspends;
  // without it, instances from earlier deploys hold every slot and new requests fail (EMAXCONNSESSION).
  const pool = new Pool({
    connectionString: url,
    max: Number(process.env.DATABASE_POOL_MAX ?? 3),
    idleTimeoutMillis: 5000,
  });
  attachDatabasePool(pool);
  return drizzle(pool, { schema }) as unknown as Db;
}

// One connection per server process, kept across hot reloads in development.
const g = globalThis as unknown as { nbDb?: Promise<Db> };
export const getDb = () => (g.nbDb ??= connect());
