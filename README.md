# Nur Al-Bayan

The *Nur Al-Bayan* reading and Quran book as a gamified, multi-language web app.
Every page of the book becomes a lesson with points, stars, games and a mistake bank,
on the book's own design system. Anyone can use it without an account; teacher and
student accounts are optional.

- Plan: [docs/architecture.md](docs/architecture.md)
- Database: [docs/schema.md](docs/schema.md)
- Book design system: [docs/design-system.md](docs/design-system.md)
- Game rules carried over from nur-albayan-pages: [docs/gamification-concept.md](docs/gamification-concept.md)

## Stack

Next.js (App Router, TypeScript), Tailwind CSS on design-token variables, Drizzle ORM,
Supabase (Postgres, Auth, Storage), Zod, Vitest.

## Nothing hardcoded

Colours, fonts, copy, content, scoring numbers, games, badges and settings live in the
database, seeded from `seed/`. `pnpm check:hardcoded` fails the build if colours or Arabic
text appear in `src/`.

## Getting started

```bash
pnpm install
cp .env.example .env        # fill DATABASE_URL with your Supabase connection string
pnpm db:migrate             # create the tables
pnpm db:seed                # load the defaults
pnpm dev
```

## Checks

```bash
pnpm lint && pnpm typecheck && pnpm check:hardcoded && pnpm test && pnpm build
```

`pnpm test` applies the migrations and the seed to an in-memory Postgres (PGlite),
so no database is needed to run it.
