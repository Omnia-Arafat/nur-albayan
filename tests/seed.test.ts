import { existsSync } from "node:fs";

import { PGlite } from "@electric-sql/pglite";
import { sql } from "drizzle-orm";
import { drizzle } from "drizzle-orm/pglite";
import { migrate } from "drizzle-orm/pglite/migrator";
import { describe, expect, it } from "vitest";

import { loadContent, runContentSeed } from "@/db/seed/content";
import { loadSeed } from "@/db/seed/files";
import { runSeed } from "@/db/seed/run";

const seed = loadSeed();
// Book content is built from seed/book/ by `pnpm book:build`.
const hasContent = existsSync("seed/content/book.json");
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

describe.skipIf(!hasContent)("book content", () => {
  const content = hasContent ? loadContent() : { book: { stages: [] }, lessons: [] } as unknown as ReturnType<typeof loadContent>;
  const roles = new Set(seed.semanticRoles.map((r) => r.key));
  const cardTypes = new Set(seed.cardTypes.map((c) => c.key));
  const games = new Set(seed.games.map((g) => g.key));
  const items = content.lessons.flatMap((l) => l.sections.flatMap((s) => s.items.map((i) => ({ lesson: l.slug, ...i }))));

  it("uses only known roles, card types and games", () => {
    expect(items.flatMap((i) => i.segments.filter((s) => !roles.has(s.role)).map((s) => `${i.lesson}:${s.role}`))).toEqual([]);
    expect(items.filter((i) => !cardTypes.has(i.cardType)).map((i) => i.lesson)).toEqual([]);
    expect(content.lessons.flatMap((l) => Object.keys(l.games).filter((g) => !games.has(g)))).toEqual([]);
  });

  it("puts every lesson in a known stage and topic, once per page", () => {
    const stages = new Set(content.book.stages.map((s) => s.slug));
    expect(content.lessons.filter((l) => !stages.has(l.stage)).map((l) => l.slug)).toEqual([]);
    const stageOfTopic = new Map(content.book.topics.map((t) => [t.slug, t.stage]));
    expect(content.lessons.filter((l) => stageOfTopic.get(l.topic ?? l.stage) !== l.stage).map((l) => l.slug)).toEqual([]);
    const pages = content.lessons.map((l) => l.bookPage);
    expect(new Set(pages).size).toBe(pages.length);
  });

  it("names a picture only with a storage-safe slug", () => {
    expect(items.filter((i) => i.image && !/^[a-z0-9-]+$/.test(i.image)).map((i) => `${i.lesson}:${i.image}`)).toEqual([]);
  });

  it("keeps markup out of the text", () => {
    expect(items.filter((i) => i.segments.some((s) => /[<>]/.test(s.text))).map((i) => i.lesson)).toEqual([]);
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

    if (!hasContent) return client.close();
    const content = loadContent();
    await runContentSeed(db, content);
    await runContentSeed(db, content);
    const itemTotal = content.lessons.reduce((n, l) => n + l.sections.reduce((m, s) => m + s.items.length, 0), 0);
    expect(await count("lessons")).toBe(content.lessons.length);
    expect(await count("items")).toBe(itemTotal);
    expect(await count("units")).toBe(content.book.topics.length);
    const pictures = new Set(
      content.lessons.flatMap((l) => l.sections.flatMap((s) => s.items.map((i) => i.image).filter(Boolean))),
    );
    expect(await count("assets")).toBe(pictures.size);
    await client.close();
  }, 120_000);
});
