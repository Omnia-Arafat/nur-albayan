-- Custom migration: things drizzle-kit does not generate.

-- 1. profiles.id is the Supabase auth user id. Only link it where the auth schema exists
--    (Supabase), so the same migrations also run on plain Postgres in tests.
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_namespace WHERE nspname = 'auth')
     AND EXISTS (SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
                 WHERE n.nspname = 'auth' AND c.relname = 'users') THEN
    ALTER TABLE "profiles"
      ADD CONSTRAINT "profiles_id_auth_users_fk"
      FOREIGN KEY ("id") REFERENCES auth.users ("id") ON DELETE CASCADE;
  END IF;
END $$;
--> statement-breakpoint

-- 2. Per-lesson scoring profile (kept out of the drizzle schema to avoid a module cycle).
ALTER TABLE "lessons"
  ADD CONSTRAINT "lessons_scoring_profile_id_fk"
  FOREIGN KEY ("scoring_profile_id") REFERENCES "scoring_profiles" ("id") ON DELETE SET NULL;
--> statement-breakpoint

-- 3. At most one default row where a table has an is_default flag.
CREATE UNIQUE INDEX "themes_one_default_per_mode" ON "themes" ("mode") WHERE "is_default";
--> statement-breakpoint
CREATE UNIQUE INDEX "scoring_profiles_one_default" ON "scoring_profiles" ((true)) WHERE "is_default";
--> statement-breakpoint
CREATE UNIQUE INDEX "locales_one_default" ON "locales" ((true)) WHERE "is_default";
--> statement-breakpoint
CREATE UNIQUE INDEX "pill_palettes_one_default" ON "pill_palettes" ((true)) WHERE "is_default";
--> statement-breakpoint
CREATE UNIQUE INDEX "fonts_one_default_per_role" ON "fonts" ("role") WHERE "is_default";
--> statement-breakpoint

-- 4. Keep updated_at current on every table that has one.
CREATE OR REPLACE FUNCTION "set_updated_at"() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  NEW."updated_at" = now();
  RETURN NEW;
END $$;
--> statement-breakpoint
DO $$
DECLARE t record;
BEGIN
  FOR t IN
    SELECT c.table_name FROM information_schema.columns c
    WHERE c.table_schema = 'public' AND c.column_name = 'updated_at'
  LOOP
    EXECUTE format(
      'CREATE TRIGGER %I BEFORE UPDATE ON %I FOR EACH ROW EXECUTE FUNCTION "set_updated_at"()',
      t.table_name || '_set_updated_at', t.table_name
    );
  END LOOP;
END $$;
--> statement-breakpoint

-- 5. Row Level Security is enabled on every table (by the schema) with no policies.
--    That denies Supabase's anon and authenticated roles any direct table access:
--    the browser only talks to /api/v1, which connects as the database owner and
--    enforces roles in code. Policies for direct access (e.g. Realtime) are added
--    per table when a feature needs them.
