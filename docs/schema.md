# Database schema

Postgres on Supabase, defined in `src/db/schema/*.ts` (Drizzle) and migrated from `db/migrations/`.
Plan and reasoning: [architecture.md](./architecture.md) §4.

## Rules the schema follows

- **No display text on entities.** Every human-readable field lives in a `*_i18n` table keyed by `(entity, locale)`. Adding a language is rows in `locales`, `ui_messages` and the `*_i18n` tables.
- **No HTML in content.** A word is `items` + ordered `item_segments`, each segment tagged with a teaching role (`target`, `contrast`, `base`, `secondary`, `rule`). Roles point at design tokens in `semantic_roles`, so the book's red/blue/black code is data.
- **No numbers in code.** Points, floor, star thresholds, repeat policy and mastery streak are a versioned row in `scoring_profiles` (shape: `src/modules/scoring/profile.ts`). Sessions keep the profile they were scored with.
- **Registries are tables.** Card types, games, roles, permissions, badges, levels, avatars and setting definitions are rows; enums are used only where a value selects a code path (section renderer, attempt surface).
- **Attempts are the source of truth.** `attempts` is append-only and idempotent (`client_event_id`), so offline devices can upload safely; `lesson_records`, `mistake_bank`, XP and streaks are derived from it.
- **No account required.** Anonymous learners stay on their device. `students` rows exist only once a learner signs up or a teacher adds them, and `device_profile_id` links the claimed local profile.
- **RLS on every table, no policies.** Supabase's `anon` and `authenticated` roles cannot read tables directly; the app's `/api/v1` connects as the owner and enforces permissions from `role_permissions`.

## Tables by module

| Module | Tables |
|---|---|
| Platform | `locales`, `ui_messages`, `setting_definitions`, `settings` |
| Theme | `themes`, `design_tokens`, `fonts`, `semantic_roles(_i18n)`, `pill_palettes` |
| Content | `assets(_i18n)`, `books(_i18n)`, `stages(_i18n)`, `units(_i18n)`, `lessons(_i18n)`, `lesson_sections(_i18n)`, `card_types(_i18n)`, `items(_i18n)`, `item_segments`, `rules(_i18n)`, `riddles(_i18n)`, `content_revisions` |
| Scoring and games | `scoring_profiles`, `games(_i18n)`, `lesson_game_overrides`, `feedback_messages` |
| People | `roles(_i18n)`, `permissions(_i18n)`, `role_permissions`, `profiles`, `avatars`, `avatar_colors`, `students`, `classrooms`, `classroom_members` |
| Progress | `sessions`, `attempts`, `lesson_records`, `mistake_bank`, `xp_ledger`, `levels(_i18n)`, `badges(_i18n)`, `student_badges`, `streaks` |

## Curriculum shape

```
books ─< stages ─< units ─< lessons (one printed page)
                               ├─< lesson_sections (kind = renderer) ─< items ─< item_segments
                               ├─< rules
                               ├─< riddles
                               └─< lesson_game_overrides >─ games
```

## Settings resolution

`setting_definitions` declares each setting (type, options, limits, default, which scopes may set it).
A value is resolved most specific first: device → student → classroom → teacher → platform → definition default.

## Seed

`seed/*.json` holds the defaults: the book's tokens and fonts, teaching roles, pill palettes, card types,
the default scoring profile (the rules of nur-albayan-pages), games, cheers, roles and permissions,
avatars, levels, badges, setting definitions, and the 525 UI strings from nur-albayan-pages in Arabic
and English (namespace `legacy`, to be moved into feature namespaces as screens are rebuilt).

The seed is idempotent and never overwrites values an admin has changed. Run it with `pnpm db:seed`.

## Book content

`pnpm import:pages <path to nur-albayan-pages>` converts the pages repo's lessons into
`seed/content/` (one JSON file per page, plus `book.json` with the stages and an `IMPORT_REPORT.md`).
Each word's coloured spans become role-tagged segments, the pill theme becomes a row band, and
pages whose words are built from smaller arrays are read by running their inline script in a sandbox.
All lessons are imported as `draft` for review against the printed book.

`pnpm db:seed:content` loads it. A lesson whose slug already exists is skipped, so editors' changes are kept.
`seed/content/` is git-ignored while the repository is public.
