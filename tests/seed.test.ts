import { PGlite } from "@electric-sql/pglite";
import { sql } from "drizzle-orm";
import { drizzle } from "drizzle-orm/pglite";
import { migrate } from "drizzle-orm/pglite/migrator";
import { describe, expect, it } from "vitest";

import { loadSeed } from "@/db/seed/files";
import { runSeed } from "@/db/seed/run";

const seed = loadSeed();
const tokenKeys = new Set(seed.theme.tokens.map((t) => t.key));
const localeCodes = seed.locales.map((l) => l.code);

describe("seed files", () => {
  it("reference only tokens that exist", () => {
    const refs = [
      ...seed.semanticRoles.map((r) => r.tokenKey),
      ...seed.cardTypes.map((c) => c.frameTokenKey),
      ...seed.games.map((g) => g.fillTokenKey),
      ...seed.badges.map((b) => b.fillTokenKey),
      ...seed.avatars.colors.map((c) => c.tokenKey),
      ...seed.pillPalettes.flatMap((p) => p.fillTokenKeys.flatMap((k) => [`${k}.fill`, `${k}.line`])),
    ];
    expect(refs.filter((k) => !tokenKeys.has(k))).toEqual([]);
  });

  it("score every card type", () => {
    const scored = Object.keys(seed.scoringProfile.rules.cardTypes).sort();
    expect(scored).toEqual(seed.cardTypes.map((c) => c.key).sort());
  });

  it("translate every registry entry into every locale", () => {
    const entries = [...seed.semanticRoles, ...seed.cardTypes, ...seed.games, ...seed.levels, ...seed.badges, ...seed.roles.roles];
    const missing = entries.flatMap((e) => localeCodes.filter((l) => !e.i18n[l]).map((l) => `${e.key}:${l}`));
    expect(missing).toEqual([]);
  });

  it("have the same UI message keys in every locale", () => {
    const keysOf = (l: string) =>
      Object.entries(seed.uiMessages[l]).flatMap(([ns, msgs]) => Object.keys(msgs).map((k) => `${ns}.${k}`)).sort();
    for (const l of localeCodes) expect(keysOf(l)).toEqual(keysOf(localeCodes[0]));
  });

  it("give every setting a default inside its own limits", () => {
    for (const d of seed.settings) {
      if (d.type === "enum") expect(d.options, d.key).toContain(d.defaultValue);
      if (d.type === "integer") {
        expect(typeof d.defaultValue, d.key).toBe("number");
        if (d.min !== undefined) expect(d.defaultValue as number).toBeGreaterThanOrEqual(d.min);
        if (d.max !== undefined) expect(d.defaultValue as number).toBeLessThanOrEqual(d.max);
      }
    }
  });

  it("only grant permissions that exist to roles that exist", () => {
    const perms = new Set(seed.roles.permissions.map((p) => p.key));
    const roles = new Set(seed.roles.roles.map((r) => r.key));
    for (const [role, keys] of Object.entries(seed.roles.rolePermissions)) {
      expect(roles.has(role), role).toBe(true);
      expect(keys.filter((k) => !perms.has(k))).toEqual([]);
    }
  });
});

describe("migrations and seed", () => {
  it("apply to an empty database and seed twice without duplicates", async () => {
    const client = new PGlite();
    const db = drizzle(client);
    await migrate(db, { migrationsFolder: "db/migrations" });

    await runSeed(db, seed);
    const count = async (table: string) =>
      (await db.execute<{ n: number }>(sql.raw(`select count(*)::int as n from "${table}"`))).rows[0].n;
    const before = {
      tokens: await count("design_tokens"),
      messages: await count("ui_messages"),
      feedback: await count("feedback_messages"),
      games: await count("games"),
    };
    await runSeed(db, seed);
    expect({
      tokens: await count("design_tokens"),
      messages: await count("ui_messages"),
      feedback: await count("feedback_messages"),
      games: await count("games"),
    }).toEqual(before);
    expect(before.tokens).toBe(seed.theme.tokens.length);

    const rls = await db.execute<{ n: number }>(
      sql`select count(*)::int as n from pg_tables where schemaname = 'public' and not rowsecurity`,
    );
    expect(rls.rows[0].n).toBe(0);
    await client.close();
  }, 60_000);
});
