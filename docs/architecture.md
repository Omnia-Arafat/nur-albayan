# Nur Al-Bayan Digital: Architecture Plan

Status: **approved** (2026-10-06). All §12 decisions answered. Roles are admin, teacher, student; no account required. Nothing is built yet. Target repo: `Omnia-Arafat/nur-albayan` (empty).

Inputs: [gamification-concept.md](./gamification-concept.md) (scoring and games from `nur-albayan-pages`), [design-system.md](./design-system.md) (the printed book's look), the book scan, and the 91 lesson pages already structured in `nur-albayan-pages/pages/*.html` plus `rules/*.json`.

---

## 1. Requirements, restated

| # | Requirement | What it means in practice |
|---|---|---|
| R1 | Digitize the whole book | Every printed page (alphabet to rasm tables and stories) becomes a lesson made of structured data, not images or HTML strings |
| R2 | Gamified and fun | Keep every mechanic in concept.md (card types, points, stars, game breaks, 7 Wordwall modes, ladder, mistake bank, mastery) and add persistent rewards (XP levels, badges, streaks, daily goals) |
| R3 | Never break the book's rules | Curriculum order, the red/blue/black teaching color code, Uthmani script on Quran pages, tashkeel always present, adult-in-the-loop grading |
| R4 | Never break the design system | Cream paper, pastel pills with same-hue outlines, ribbon tags, page structure; all from tokens |
| R5 | Next.js, full stack, API based | One Next.js app with a versioned REST API that the UI itself consumes (and a future mobile app could too) |
| R6 | Multi-language | Arabic (RTL) and English (LTR) at launch; adding a language is data, not code |
| R8 | **Open to everyone, no account needed** | The whole site (every lesson, game, score, star, mistake bank) works without signing up and without a teacher. Accounts are optional extras: a teacher account for classrooms, a student account to keep progress across devices |
| R7 | **Nothing hardcoded** | Design tokens, content, scoring numbers, game settings, UI copy, feedback messages, badges, avatars, thresholds all live in the database, editable from an admin panel |

**How R7 is enforced.** Code contains *engines and components* only: the scoring engine, the game renderers, the pill component. Every number, color, string and word comes from data. The only place defaults exist is the **seed** (versioned JSON in `/seed`), which loads into the database once; after that the database is the source of truth. A lint rule and a CI check block hex colors, literal Arabic or English UI strings, and magic scoring numbers in `src/`.

---

## 2. Architecture

### 2.1 Shape: a modular monolith

```
                ┌──────────────────────── Next.js 15 (App Router, TypeScript) ───────────────────────┐
Browser / PWA ──┤  UI (React Server + Client Components)                                              │
                │        │  fetches only through                                                      │
                │        ▼                                                                            │
                │  /api/v1/*  Route Handlers  ── Zod contracts ── OpenAPI spec (generated)            │
                │        │                                                                            │
                │        ▼                                                                            │
                │  Domain modules (pure TS, no framework code)                                        │
                │   content · scoring · games · progress · mistakes · gamification · i18n · theme     │
                │        │                                                                            │
                │        ▼                                                                            │
                │  Data access (Drizzle ORM)  +  cache (Next cache tags / Vercel KV)                  │
                └────────┼────────────────────────────────────────────────────────────────────────────┘
                         ▼
                 Supabase: Postgres · Auth · Storage (images, audio, fonts) · RLS · Realtime
```

- **Modular monolith, not microservices.** One deployable, clear module boundaries (`src/modules/<name>/{domain,service,repo,api}`). Cheap to run, easy to split later.
- **API first.** All reads and writes go through `/api/v1`. Server Components call the same service layer directly for first paint, so there is one code path for logic. Every request and response is a Zod schema, from which the OpenAPI document and the TypeScript client are generated.
- **Pure domain engines.** Scoring, mastery, stars and repeat policy are pure functions `(config, events) → result`, unit-tested without a database, and run the same on server and client (the client runs them for instant feedback; the server re-computes and is authoritative).

### 2.2 Stack

| Layer | Choice | Why |
|---|---|---|
| Framework | Next.js 15, App Router, TypeScript strict | Requested; RSC for fast content pages, Route Handlers for the API |
| Styling | Tailwind CSS v4 bound to CSS variables | Tailwind classes read `var(--nb-*)`, so every color and radius is a token from the database |
| UI primitives | Radix UI (accessible dialogs, tabs, toggles) | Keyboard and screen-reader baseline from concept.md |
| Motion and fun | Framer Motion, canvas-confetti, Howler.js (sound) | Celebrations, card flips, ladder climb; respects reduced-motion and sound settings |
| Client state | Zustand (live lesson session), TanStack Query (server data) | Session state is fast and local; server data is cached and synced |
| i18n | next-intl, messages loaded from the database | `/ar/...`, `/en/...` routes, `dir` per locale |
| ORM | Drizzle ORM + drizzle-kit migrations | Schema as code, typed queries, plain SQL migrations Supabase understands |
| Validation | Zod | Shared contracts for API, forms and config JSON |
| Offline | Serwist (service worker) + IndexedDB outbox | Lessons cached, attempts queued offline and synced (see §8) |
| Tests | Vitest (engines), Playwright (flows, RTL), axe (a11y) | |
| Hosting | Vercel + Supabase | |

---

## 3. Database: Supabase (Postgres)

**Recommendation: Supabase**, used as managed Postgres plus Auth and Storage.

Why it fits this product:
1. **The data is relational.** Book → unit → lesson → section → item, students → attempts → lesson records, classrooms → members. Postgres handles this naturally; JSONB covers the flexible parts (game config, scoring rules).
2. **Row Level Security** expresses the roles directly in the database: a teacher sees only their own classrooms' students, a student only their own progress, and only the admin can change content, tokens and scoring.
3. **Auth is included**: email, magic link, Google; children don't need emails (see §7).
4. **Storage** for picture-word photos, story illustrations, audio, and the Uthmani font, served from a CDN.
5. **Realtime** later enables a live classroom scoreboard or a teacher grading from a phone while the child sees the board.
6. No lock-in: it is plain Postgres. Drizzle migrations would run on any Postgres (Neon, RDS) if we ever move.

Alternatives considered: Firebase (document store fits the relational curriculum and reporting poorly), Neon + Auth.js (more pieces to wire for the same result), MongoDB (weak for progress reporting and joins).

Access rule: the browser never talks to Supabase tables directly except Auth. All data goes through `/api/v1`, which keeps the API the single contract. RLS stays on anyway as defense in depth.

---

## 4. Data model (outline)

Grouped by module. `*_i18n` tables hold translations keyed by `(id, locale)`. All tables have `id uuid`, `created_at`, `updated_at`.

### 4.1 Platform and i18n
- `locales` (code, name, dir `rtl|ltr`, is_default, enabled)
- `ui_messages` (namespace, key, locale, value) — every UI string, cheer and error message
- `settings` (scope `platform|org|classroom|teacher|student`, scope_id, key, value jsonb) — resolved by cascade, most specific wins

### 4.2 Design system (theme)
- `themes` (slug, name, mode `light|dark`, is_default) — "Book cream" light, a designed dark theme
- `design_tokens` (theme_id, group `color|font|radius|space|shadow|motion`, key, value) — e.g. `color.paper = #FEFBDA`, `color.target = #ED425B`
- `fonts` (family, role `quran|naskh|display`, storage_path, weights)
- `semantic_roles` (key `target|contrast|base|secondary|rule`, token_key, description) — **the book's teaching color grammar as data**: content says "this letter is the target", the role maps to a token
- `pill_palettes` (name, ordered list of pill token keys, rows_per_color) — the row-rhythm cycles (yellow → sky → pink → green)

At request time the theme is compiled to a `:root{--nb-...}` stylesheet, cached and invalidated by tag when an admin edits a token.

### 4.3 Curriculum and content
- `books` (slug, edition, cover_asset_id)
- `stages` (book_id, order) + `stages_i18n` (title) — the 9 stages
- `units` (stage_id, order) + i18n
- `lessons` (unit_id, book_page, order, layout_type, status `draft|review|published`, version) + `lessons_i18n` (title, subtitle, teacher_note)
- `lesson_sections` (lesson_id, order, kind `picture_grid|letter_tiles|segmented_rows|word_rows|sentences|story|rule_table|rule_definition`, config jsonb e.g. columns, palette)
- `items` (section_id, order, card_type_id, script `naskh|uthmani`, image_asset_id, audio_asset_id, row_band)
- `item_segments` (item_id, order, text, semantic_role, is_cell_boundary) — **a word is a list of segments, not HTML**. `«حِـ» base + «ي» target + «نَ» base`. Segmented pills and letter cells are rendered from this.
- `rules` (lesson_id, order) + `rules_i18n` (title, description) + `rule_examples` (rule_id, segments jsonb)
- `riddles` (lesson_id nullable, order) + i18n (question, answers, correct)
- `assets` (kind `image|audio|font|scan`, storage_path, alt_i18n)
- `content_revisions` (entity, entity_id, diff, author, at) — audit trail for editors

### 4.4 Scoring and games (config)
- `card_types` (key `normal|golden|speed|danger`, icon, token_key) + i18n (label)
- `scoring_profiles` (name, version, is_default, rules jsonb) — e.g.
  `{ "cardTypes": {"golden": {"correct":10,"wrong":-2}, "speed": {"correct":5,"lateCorrect":2,"timerSec":10}, ...}, "floor":0, "noPenaltyWrong":0, "surfaces": {"wordwall":{"correct":5}, "ladder":{"rung":2,"peak":5}, "remediation":{"correct":2,"mastered":5}}, "stars":[{"min":0.9,"stars":3},{"min":0.7,"stars":2},{"min":0,"stars":1}], "repeatPolicy":"best", "mastery":{"consecutiveCorrect":2}, "instantRepeat":3 }`
  Profiles are versioned; each attempt stores the profile version it was scored with, so history never changes when numbers change.
- `games` (key `xo|connect4|memory|riddles|boxes|curtain|wheel|cards|ladder|tiles|honeycomb`, kind `break|wordwall`, enabled, default_config jsonb) + i18n
- `lesson_game_overrides` (lesson_id, game_key, config jsonb) — e.g. a page that enables riddles
- `feedback_messages` (kind `correct|wrong|peak|badge|...`, locale, text, sound_asset_id, weight) — the random cheers

### 4.5 People and roles
- `roles` (key `admin|teacher|student`) + `permissions` + `role_permissions` — roles and what they can do are data, so a role can be tuned without code
- `profiles` (user_id → auth.users, display_name, locale, role_id, status `active|disabled`)
- `classrooms` (owner_teacher_id, name, join_code) + `classroom_members` (classroom_id, student_id)
- `students` (profile_id nullable, device_id nullable, claimed_at nullable, display_name, avatar_id, avatar_color_token, use_first_letter, created_by_teacher_id, login `username`, pin_hash) — a student exists without any account (local or device-only); login is optional, by self sign-up or a teacher-created username and PIN
- `avatars` (emoji or asset, unlock_rule nullable), `avatar_colors` (token_key) — the avatar and color pickers from the pages repo, as data

### 4.6 Progress, mistakes, gamification
- `sessions` (student_id, lesson_id, started_at, finished_at, scoring_profile_version, settings_snapshot jsonb)
- `attempts` (session_id, item_id, surface `card|wordwall|ladder|review|remediation`, result `correct|wrong`, timed_out, points, graded_by, client_event_id unique) — **append-only event log**, idempotent for offline sync
- `lesson_records` (student_id, lesson_id, best, latest, cumulative, accuracy, stars, attempts_count, last_at) — derived from attempts
- `mistake_bank` (student_id, item_id, lesson_id, miss_count, correct_streak, mastered_at)
- `xp_ledger` (student_id, source, amount, ref) and `levels` (threshold, i18n name)
- `badges` (key, criteria jsonb, icon) + i18n, `student_badges`
- `streaks` (student_id, current, longest, last_day), `daily_goals` (config via settings)

---

## 5. Book content pipeline

The PDF is a scan (no text layer), and OCR on fully voweled Arabic is not reliable enough to trust for tashkeel. So:

1. **Import what already exists.** `nur-albayan-pages` has pages 6 to 95 as structured cards (`{w, theme, t}`) with color spans (`c-red`, `c-blue`, `c-black`) and `rules/*.json`. A one-time importer parses each span into `item_segments` (`c-red → target`, `c-blue → contrast`, `c-black → base`, `c-purple → secondary`), `theme → row_band`, `t → card_type`. This covers about 1,900 cards.
2. **Fill the gaps from the scan.** Pages 1 to 5 (alphabet, picture-word grids), the stories and the rule tables are entered in the admin editor with the page scan shown side by side.
3. **Review against the book.** Every lesson starts as `draft`. The editor shows the scan next to the rendered lesson; a reviewer checks tashkeel, colors and order, then publishes. Lessons are versioned.
4. **Assets.** Picture-word photos are replaced with licensed or original images (the scan quality is poor). Distributor branding (OsraWay, Cryp2Day) is dropped.
5. **Validation at save.** Zod rules: every word segment is fully voweled, every item has exactly one target role where the section requires it, Quran items use the Uthmani script, page order is unique.

---

## 6. Engines

- **Scoring engine** (`modules/scoring`): `score(profile, attempt) → points`, `summarize(profile, attempts) → {score, accuracy, stars}`, `applyRepeatPolicy(...)`. Fixes the concept.md inconsistencies by making every surface's points explicit in the profile (and, if the user agrees, making the ladder peak and Wordwall points count toward the record).
- **Mastery engine** (`modules/mistakes`): miss → bank; N consecutive correct → mastered (N from config); review modes loop, single pass, instant repeat.
- **Game engine** (`modules/games`): a registry; each game is a React component plus a config schema. The lesson player asks the registry what to show and when (break positions are config, e.g. `[0.33, 0.66, 1.0]`).
- **Gamification engine** (`modules/gamification`): evaluates badge criteria (jsonb rules such as `{"type":"lessonsCompleted","count":10}`), XP, levels, streaks after each finished session.
- **Theme engine** (`modules/theme`): tokens → CSS variables; semantic role → token.

## 7. Roles, access and dashboards

Three roles: **admin, teacher, student**. Permissions are rows in `role_permissions`, enforced by API guards and RLS.

**No account is required (R8).** Anyone who opens the site is an anonymous learner with the full experience: lessons, games, points, stars, badges, the mistake bank and remediation. Their progress is saved on the device (IndexedDB), like the pages repo does today, and several learners can share one device with local profiles (name and avatar).

Accounts are optional and only add things:
- **Student account** (self sign-up, or username and PIN created by a teacher): progress syncs across devices. On sign-up, the device's local progress is claimed into the account, so nothing is lost.
- **Teacher account**: classrooms, following students, reports, classroom settings. A teacher can also run a session for an anonymous learner on their own device.
- **Admin**: content, tokens, scoring and platform settings.

**Who grades.** Whoever is at the screen grades: the learner themself, a parent, or a teacher. Every attempt records `graded_by` (`self` or `teacher`), and all of them count toward the score. A teacher's views can filter to "teacher-graded only" when they want an assessment. The book's principle stays visible in the UI: the guide reminds learners to read aloud to an adult when possible.

### 7.1 What comes from `nur-albayan-pages`

The pages repo has no separate admin area. Its "dashboard" is the student roster modal plus the teacher settings dialog and the student report (`shared/roster-manager.js`, `roster-views.js`, `settings-dialog.js`, `student-report.js`, `student-backup.js`, `index-progress-view.js`). Its essential features, mapped to the new roles:

| Feature in the pages repo | New home |
|---|---|
| Roster: list students, add (name, avatar emoji, color, or first-letter avatar), edit, delete, set active student, guest mode | Teacher dashboard → Students |
| Student profile: completed lessons with stars, accuracy, points, delete one lesson's progress | Teacher → Student detail; Student → My progress |
| Mistake bank per student: list by lesson, mark one word mastered, clear all, launch remediation | Teacher → Student detail → Mistakes |
| Printable report with doughnut chart (correct vs incorrect) | Teacher → Reports (print / PDF) |
| JSON export and import (backup between devices) | Not needed for syncing (the server holds the data); kept as admin export/import |
| Teacher settings: sound and volume, game breaks, game mode and AI difficulty, speed timer, shuffle, no-penalty, manual advance, remediation drill mode, repeat policy, font, text size, theme | Teacher → Settings (per teacher and per classroom), defaults set by the admin |
| Index progress map (stars and points per lesson for the active student) | Student home and teacher's student view |

### 7.2 Dashboards

**Admin**
- Users: create and disable teachers, see all students and classrooms.
- Curriculum: the content editor (stages, units, lessons, sections, items as segments, rules, teacher notes, riddles) with the book scan side by side; draft, review, publish, version history.
- Design system: edit tokens, semantic roles, pill palettes and fonts, with live preview on a sample page.
- Scoring and games: edit and version scoring profiles, card types, game registry and per-lesson game overrides, feedback messages.
- Gamification: badges, levels, avatars, daily goal defaults.
- Languages: locales, UI strings, missing-translations report.
- Platform defaults for every teacher setting; data export and import.
- Overview: active students, lessons completed, most-missed words across the platform.

**Teacher**
- Classrooms: create, add students (username and PIN), join code, move students.
- Run a session: pick a student, open a lesson, grade card by card (the live player); optional "board" view on a second screen via Realtime.
- Student detail: progress map, lesson records, mistake bank (mark mastered, clear, launch remediation), delete a lesson's progress.
- Classroom overview: who is where in the book, stars per lesson, most-missed words in the class, streaks.
- Reports: printable per student and per classroom.
- Settings: everything from the pages repo's settings dialog, per classroom.

**Student**
- Home: the progress map of the book (stars and points per lesson), XP level, streak, daily goal, badges.
- Practice: open lessons the teacher unlocked, play Wordwall modes and game breaks, review own mistakes.
- Profile: avatar and color (from unlocked options).

## 8. Offline and anonymous storage

Because no account is required, the device is the first store: anonymous progress lives in IndexedDB and works with no network at all. If the learner later signs in, the local events are uploaded once and merged.


The current app is offline-first, and Quran classes often have weak internet. Plan: published lessons, tokens and messages are cached by the service worker; a live session runs fully on the client; attempts go to an IndexedDB outbox and sync with `client_event_id` so retries never double-count. Server recomputes records from attempts.

## 9. i18n

- Locale-prefixed routes (`/ar`, `/en`), `dir` and fonts from the `locales` table.
- UI copy from `ui_messages`; content meta (titles, rule descriptions, teacher notes) from `*_i18n` tables. The Arabic drill text itself is the content and is not translated; English gets transliteration or meaning only where the editor adds it.
- Missing translation falls back to the default locale and is listed in an admin "missing strings" report.
- Arabic-Indic digits per locale via `Intl.NumberFormat`.

## 10. Repository layout

```
nur-albayan/
  src/
    app/[locale]/(learn|teach|admin)/...   pages
    app/api/v1/...                        route handlers
    modules/<content|scoring|games|progress|mistakes|gamification|theme|i18n|auth>/
    components/book/   Pill, SegmentedPill, RibbonTag, StoryBox, RuleTable, PageFrame
    components/games/  one folder per game
    lib/               db, cache, auth, api client (generated)
  db/schema/*.ts       Drizzle schema
  db/migrations/
  seed/                tokens, scoring profile, games, messages, avatars, badges (JSON)
  scripts/import-pages-repo.ts
  tests/
```

## 11. Roadmap

| Phase | Delivers |
|---|---|
| 0. Foundations | Repo, Next.js, Tailwind, Drizzle, Supabase project, CI, lint rule against hardcoding |
| 1. Design system | Token tables and seed, theme engine, book components (pill, segmented pill, ribbon, story box, rule table) in a component gallery; reviewed against scans |
| 2. Schema and content | Full schema and RLS, importer from the pages repo, admin content editor with scan side by side |
| 3. Lesson player | Card flow, adult grading, scoring engine, summary with stars, mistake bank, review modes |
| 4. Games | Breaks (XO, Connect 4, Memory, Riddles) and the 7 Wordwall modes, all config driven |
| 5. Dashboards | Auth; admin dashboard (users, scoring, tokens, languages); teacher dashboard (classrooms, students, mistake bank, reports, settings); student home |
| 6. Gamification+ | XP, levels, badges, streaks, daily goals, optional classroom leaderboard |
| 7. Offline and polish | PWA, outbox sync, a11y audit, performance, English completeness |
| 8. Remaining pages | Pages 1 to 5, stories and tables entered and reviewed; full book published |

Each phase ends with a PR and a demo.

## 12. Decisions needed from you

1. ✅ **Decided: yes.** **Database:** Supabase as described? (recommended)
2. ✅ **Follows from R8 (2026-10-06):** offline-capable, since anonymous progress lives on the device anyway; sync when signed in.
3. ✅ **Decided (2026-10-06):** accounts are optional. A student can use everything anonymously, sign up themself, or get a username and PIN from a teacher.
4. ✅ **Decided: yes.** **Languages at launch:** Arabic and English (recommended), or more?
5. ✅ **Decided: yes.** **Content source:** import the 91 pages already in `nur-albayan-pages` and review them against the book (recommended), or re-enter everything from the scans?
6. ✅ **Decided: yes.** **Scoring gaps:** make Wordwall and ladder points count toward the lesson record, and turn game breaks on by default? (recommended yes, as profile defaults you can change)
7. ✅ **Decided (2026-10-06):** the user has the publisher's permission.
8. ✅ **Revised (2026-10-06):** self-graded practice counts toward the score, since no teacher is required. Each attempt records who graded it, and teachers can filter to teacher-graded only.
