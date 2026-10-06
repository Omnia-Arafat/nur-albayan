CREATE TYPE "public"."setting_scope" AS ENUM('platform', 'classroom', 'teacher', 'student', 'device');--> statement-breakpoint
CREATE TYPE "public"."setting_type" AS ENUM('boolean', 'integer', 'enum', 'string', 'json');--> statement-breakpoint
CREATE TYPE "public"."text_direction" AS ENUM('rtl', 'ltr');--> statement-breakpoint
CREATE TYPE "public"."font_role" AS ENUM('display', 'naskh', 'quran', 'ui');--> statement-breakpoint
CREATE TYPE "public"."theme_mode" AS ENUM('light', 'dark');--> statement-breakpoint
CREATE TYPE "public"."token_group" AS ENUM('color', 'font', 'font_size', 'font_weight', 'radius', 'space', 'shadow', 'motion', 'border');--> statement-breakpoint
CREATE TYPE "public"."asset_kind" AS ENUM('image', 'audio', 'font', 'scan', 'other');--> statement-breakpoint
CREATE TYPE "public"."content_status" AS ENUM('draft', 'review', 'published', 'archived');--> statement-breakpoint
CREATE TYPE "public"."script_kind" AS ENUM('naskh', 'uthmani');--> statement-breakpoint
CREATE TYPE "public"."section_kind" AS ENUM('letter_tiles', 'picture_grid', 'segmented_rows', 'word_rows', 'sentences', 'story', 'rule_table', 'rule_definition');--> statement-breakpoint
CREATE TYPE "public"."game_kind" AS ENUM('break', 'wordwall');--> statement-breakpoint
CREATE TYPE "public"."avatar_kind" AS ENUM('emoji', 'asset');--> statement-breakpoint
CREATE TYPE "public"."profile_status" AS ENUM('active', 'disabled');--> statement-breakpoint
CREATE TYPE "public"."attempt_result" AS ENUM('correct', 'wrong');--> statement-breakpoint
CREATE TYPE "public"."attempt_surface" AS ENUM('card', 'wordwall', 'ladder', 'review', 'remediation');--> statement-breakpoint
CREATE TYPE "public"."grader_kind" AS ENUM('self', 'teacher');--> statement-breakpoint
CREATE TYPE "public"."xp_source" AS ENUM('lesson', 'game', 'review', 'remediation', 'badge', 'streak', 'daily_goal');--> statement-breakpoint
CREATE TABLE "locales" (
	"code" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"dir" text_direction NOT NULL,
	"numbering_system" text NOT NULL,
	"is_default" boolean DEFAULT false NOT NULL,
	"enabled" boolean DEFAULT true NOT NULL,
	"position" integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
ALTER TABLE "locales" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "setting_definitions" (
	"key" text PRIMARY KEY NOT NULL,
	"type" "setting_type" NOT NULL,
	"options" jsonb,
	"min" integer,
	"max" integer,
	"step" integer,
	"default_value" jsonb NOT NULL,
	"allowed_scopes" "setting_scope"[] NOT NULL,
	"group" text NOT NULL,
	"position" integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
ALTER TABLE "setting_definitions" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "settings" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"scope" "setting_scope" NOT NULL,
	"scope_id" uuid,
	"key" text NOT NULL,
	"value" jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "settings_scope_scope_id_key_unique" UNIQUE NULLS NOT DISTINCT("scope","scope_id","key")
);
--> statement-breakpoint
ALTER TABLE "settings" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "ui_messages" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"namespace" text NOT NULL,
	"key" text NOT NULL,
	"locale" text NOT NULL,
	"value" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "ui_messages_namespace_key_locale_unique" UNIQUE("namespace","key","locale")
);
--> statement-breakpoint
ALTER TABLE "ui_messages" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "design_tokens" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"theme_id" uuid NOT NULL,
	"group" "token_group" NOT NULL,
	"key" text NOT NULL,
	"value" text NOT NULL,
	"description" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "design_tokens_theme_id_key_unique" UNIQUE("theme_id","key")
);
--> statement-breakpoint
ALTER TABLE "design_tokens" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "fonts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"role" "font_role" NOT NULL,
	"family" text NOT NULL,
	"fallbacks" text NOT NULL,
	"css_url" text,
	"asset_path" text,
	"weights" integer[] NOT NULL,
	"is_default" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "fonts" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "pill_palettes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"slug" text NOT NULL,
	"fill_token_keys" text[] NOT NULL,
	"rows_per_color" integer NOT NULL,
	"is_default" boolean DEFAULT false NOT NULL,
	CONSTRAINT "pill_palettes_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
ALTER TABLE "pill_palettes" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "semantic_roles" (
	"key" text PRIMARY KEY NOT NULL,
	"token_key" text NOT NULL,
	"position" integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
ALTER TABLE "semantic_roles" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "semantic_roles_i18n" (
	"entity_key" text NOT NULL,
	"locale" text NOT NULL,
	"label" text NOT NULL,
	"description" text,
	CONSTRAINT "semantic_roles_i18n_entity_key_locale_pk" PRIMARY KEY("entity_key","locale")
);
--> statement-breakpoint
ALTER TABLE "semantic_roles_i18n" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "themes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"slug" text NOT NULL,
	"name" text NOT NULL,
	"mode" "theme_mode" NOT NULL,
	"is_default" boolean DEFAULT false NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"published_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "themes_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
ALTER TABLE "themes" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "assets" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"kind" "asset_kind" NOT NULL,
	"storage_path" text NOT NULL,
	"mime_type" text NOT NULL,
	"width" integer,
	"height" integer,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "assets_storage_path_unique" UNIQUE("storage_path")
);
--> statement-breakpoint
ALTER TABLE "assets" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "assets_i18n" (
	"entity_id" uuid NOT NULL,
	"locale" text NOT NULL,
	"alt" text NOT NULL,
	CONSTRAINT "assets_i18n_entity_id_locale_pk" PRIMARY KEY("entity_id","locale")
);
--> statement-breakpoint
ALTER TABLE "assets_i18n" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "books" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"slug" text NOT NULL,
	"edition" text,
	"cover_asset_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "books_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
ALTER TABLE "books" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "books_i18n" (
	"entity_id" uuid NOT NULL,
	"locale" text NOT NULL,
	"title" text NOT NULL,
	"subtitle" text,
	CONSTRAINT "books_i18n_entity_id_locale_pk" PRIMARY KEY("entity_id","locale")
);
--> statement-breakpoint
ALTER TABLE "books_i18n" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "card_types" (
	"key" text PRIMARY KEY NOT NULL,
	"icon_key" text NOT NULL,
	"frame_token_key" text NOT NULL,
	"position" integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
ALTER TABLE "card_types" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "card_types_i18n" (
	"entity_key" text NOT NULL,
	"locale" text NOT NULL,
	"label" text NOT NULL,
	CONSTRAINT "card_types_i18n_entity_key_locale_pk" PRIMARY KEY("entity_key","locale")
);
--> statement-breakpoint
ALTER TABLE "card_types_i18n" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "content_revisions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"entity_table" text NOT NULL,
	"entity_id" text NOT NULL,
	"diff" jsonb NOT NULL,
	"author_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "content_revisions" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "item_segments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"item_id" uuid NOT NULL,
	"position" integer NOT NULL,
	"text" text NOT NULL,
	"role_key" text NOT NULL,
	"cell_break_after" boolean DEFAULT false NOT NULL,
	CONSTRAINT "item_segments_item_id_position_unique" UNIQUE("item_id","position")
);
--> statement-breakpoint
ALTER TABLE "item_segments" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "items" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"section_id" uuid NOT NULL,
	"position" integer NOT NULL,
	"card_type_key" text NOT NULL,
	"script" "script_kind" DEFAULT 'naskh' NOT NULL,
	"row_band" integer DEFAULT 0 NOT NULL,
	"is_drillable" boolean DEFAULT true NOT NULL,
	"image_asset_id" uuid,
	"audio_asset_id" uuid,
	"search_text" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "items_section_id_position_unique" UNIQUE("section_id","position")
);
--> statement-breakpoint
ALTER TABLE "items" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "items_i18n" (
	"entity_id" uuid NOT NULL,
	"locale" text NOT NULL,
	"meaning" text,
	"transliteration" text,
	CONSTRAINT "items_i18n_entity_id_locale_pk" PRIMARY KEY("entity_id","locale")
);
--> statement-breakpoint
ALTER TABLE "items_i18n" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "lesson_sections" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"lesson_id" uuid NOT NULL,
	"position" integer NOT NULL,
	"kind" "section_kind" NOT NULL,
	"pill_palette_id" uuid,
	"config" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "lesson_sections_lesson_id_position_unique" UNIQUE("lesson_id","position")
);
--> statement-breakpoint
ALTER TABLE "lesson_sections" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "lesson_sections_i18n" (
	"entity_id" uuid NOT NULL,
	"locale" text NOT NULL,
	"label" text,
	"title" text,
	CONSTRAINT "lesson_sections_i18n_entity_id_locale_pk" PRIMARY KEY("entity_id","locale")
);
--> statement-breakpoint
ALTER TABLE "lesson_sections_i18n" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "lessons" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"unit_id" uuid NOT NULL,
	"slug" text NOT NULL,
	"book_page" integer NOT NULL,
	"position" integer NOT NULL,
	"status" "content_status" DEFAULT 'draft' NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"scan_asset_id" uuid,
	"scoring_profile_id" uuid,
	"published_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "lessons_slug_unique" UNIQUE("slug"),
	CONSTRAINT "lessons_unit_id_position_unique" UNIQUE("unit_id","position")
);
--> statement-breakpoint
ALTER TABLE "lessons" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "lessons_i18n" (
	"entity_id" uuid NOT NULL,
	"locale" text NOT NULL,
	"title" text NOT NULL,
	"subtitle" text,
	"teacher_note" text,
	"unit_tag" text,
	"lesson_tag" text,
	"observe_tag" text,
	CONSTRAINT "lessons_i18n_entity_id_locale_pk" PRIMARY KEY("entity_id","locale")
);
--> statement-breakpoint
ALTER TABLE "lessons_i18n" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "riddles" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"lesson_id" uuid,
	"position" integer NOT NULL,
	"answer_index" integer NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "riddles" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "riddles_i18n" (
	"entity_id" uuid NOT NULL,
	"locale" text NOT NULL,
	"question" text NOT NULL,
	"options" jsonb NOT NULL,
	CONSTRAINT "riddles_i18n_entity_id_locale_pk" PRIMARY KEY("entity_id","locale")
);
--> statement-breakpoint
ALTER TABLE "riddles_i18n" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "rules" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"lesson_id" uuid NOT NULL,
	"position" integer NOT NULL,
	"example" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "rules_lesson_id_position_unique" UNIQUE("lesson_id","position")
);
--> statement-breakpoint
ALTER TABLE "rules" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "rules_i18n" (
	"entity_id" uuid NOT NULL,
	"locale" text NOT NULL,
	"title" text NOT NULL,
	"description" text NOT NULL,
	CONSTRAINT "rules_i18n_entity_id_locale_pk" PRIMARY KEY("entity_id","locale")
);
--> statement-breakpoint
ALTER TABLE "rules_i18n" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "stages" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"book_id" uuid NOT NULL,
	"position" integer NOT NULL,
	"tag_token_key" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "stages_book_id_position_unique" UNIQUE("book_id","position")
);
--> statement-breakpoint
ALTER TABLE "stages" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "stages_i18n" (
	"entity_id" uuid NOT NULL,
	"locale" text NOT NULL,
	"title" text NOT NULL,
	"description" text,
	CONSTRAINT "stages_i18n_entity_id_locale_pk" PRIMARY KEY("entity_id","locale")
);
--> statement-breakpoint
ALTER TABLE "stages_i18n" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "units" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"stage_id" uuid NOT NULL,
	"position" integer NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "units_stage_id_position_unique" UNIQUE("stage_id","position")
);
--> statement-breakpoint
ALTER TABLE "units" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "units_i18n" (
	"entity_id" uuid NOT NULL,
	"locale" text NOT NULL,
	"title" text NOT NULL,
	CONSTRAINT "units_i18n_entity_id_locale_pk" PRIMARY KEY("entity_id","locale")
);
--> statement-breakpoint
ALTER TABLE "units_i18n" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "feedback_messages" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"kind" text NOT NULL,
	"locale" text NOT NULL,
	"text" text NOT NULL,
	"weight" integer DEFAULT 1 NOT NULL,
	"sound_asset_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "feedback_messages" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "games" (
	"key" text PRIMARY KEY NOT NULL,
	"kind" "game_kind" NOT NULL,
	"enabled" boolean DEFAULT true NOT NULL,
	"position" integer DEFAULT 0 NOT NULL,
	"icon_key" text NOT NULL,
	"fill_token_key" text NOT NULL,
	"default_config" jsonb DEFAULT '{}'::jsonb NOT NULL
);
--> statement-breakpoint
ALTER TABLE "games" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "games_i18n" (
	"entity_key" text NOT NULL,
	"locale" text NOT NULL,
	"name" text NOT NULL,
	"description" text,
	CONSTRAINT "games_i18n_entity_key_locale_pk" PRIMARY KEY("entity_key","locale")
);
--> statement-breakpoint
ALTER TABLE "games_i18n" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "lesson_game_overrides" (
	"lesson_id" uuid NOT NULL,
	"game_key" text NOT NULL,
	"enabled" boolean,
	"config" jsonb DEFAULT '{}'::jsonb NOT NULL,
	CONSTRAINT "lesson_game_overrides_lesson_id_game_key_pk" PRIMARY KEY("lesson_id","game_key")
);
--> statement-breakpoint
ALTER TABLE "lesson_game_overrides" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "scoring_profiles" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"slug" text NOT NULL,
	"version" integer NOT NULL,
	"is_default" boolean DEFAULT false NOT NULL,
	"rules" jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "scoring_profiles_slug_version_unique" UNIQUE("slug","version")
);
--> statement-breakpoint
ALTER TABLE "scoring_profiles" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "avatar_colors" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"token_key" text NOT NULL,
	"position" integer DEFAULT 0 NOT NULL,
	CONSTRAINT "avatar_colors_token_key_unique" UNIQUE("token_key")
);
--> statement-breakpoint
ALTER TABLE "avatar_colors" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "avatars" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"kind" "avatar_kind" NOT NULL,
	"value" text,
	"asset_id" uuid,
	"unlock_badge_key" text,
	"position" integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
ALTER TABLE "avatars" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "classroom_members" (
	"classroom_id" uuid NOT NULL,
	"student_id" uuid NOT NULL,
	"joined_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "classroom_members_classroom_id_student_id_pk" PRIMARY KEY("classroom_id","student_id")
);
--> statement-breakpoint
ALTER TABLE "classroom_members" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "classrooms" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"owner_teacher_id" uuid NOT NULL,
	"name" text NOT NULL,
	"join_code" text NOT NULL,
	"archived_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "classrooms_join_code_unique" UNIQUE("join_code")
);
--> statement-breakpoint
ALTER TABLE "classrooms" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "permissions" (
	"key" text PRIMARY KEY NOT NULL
);
--> statement-breakpoint
ALTER TABLE "permissions" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "permissions_i18n" (
	"entity_key" text NOT NULL,
	"locale" text NOT NULL,
	"description" text NOT NULL,
	CONSTRAINT "permissions_i18n_entity_key_locale_pk" PRIMARY KEY("entity_key","locale")
);
--> statement-breakpoint
ALTER TABLE "permissions_i18n" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "profiles" (
	"id" uuid PRIMARY KEY NOT NULL,
	"display_name" text NOT NULL,
	"locale" text,
	"role_key" text NOT NULL,
	"status" "profile_status" DEFAULT 'active' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "profiles" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "role_permissions" (
	"role_key" text NOT NULL,
	"permission_key" text NOT NULL,
	CONSTRAINT "role_permissions_role_key_permission_key_pk" PRIMARY KEY("role_key","permission_key")
);
--> statement-breakpoint
ALTER TABLE "role_permissions" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "roles" (
	"key" text PRIMARY KEY NOT NULL,
	"position" integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
ALTER TABLE "roles" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "roles_i18n" (
	"entity_key" text NOT NULL,
	"locale" text NOT NULL,
	"label" text NOT NULL,
	CONSTRAINT "roles_i18n_entity_key_locale_pk" PRIMARY KEY("entity_key","locale")
);
--> statement-breakpoint
ALTER TABLE "roles_i18n" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "students" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"profile_id" uuid,
	"display_name" text NOT NULL,
	"avatar_id" uuid,
	"avatar_color_id" uuid,
	"use_first_letter" boolean DEFAULT false NOT NULL,
	"username" text,
	"pin_hash" text,
	"created_by_teacher_id" uuid,
	"device_profile_id" text,
	"claimed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "students_profile_id_unique" UNIQUE("profile_id"),
	CONSTRAINT "students_username_unique" UNIQUE("username"),
	CONSTRAINT "students_device_profile_id_unique" UNIQUE("device_profile_id")
);
--> statement-breakpoint
ALTER TABLE "students" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "attempts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"session_id" uuid NOT NULL,
	"item_id" uuid NOT NULL,
	"surface" "attempt_surface" NOT NULL,
	"game_key" text,
	"result" "attempt_result" NOT NULL,
	"timed_out" boolean DEFAULT false NOT NULL,
	"points" integer NOT NULL,
	"graded_by" "grader_kind" NOT NULL,
	"grader_profile_id" uuid,
	"client_event_id" text NOT NULL,
	"occurred_at" timestamp with time zone NOT NULL,
	CONSTRAINT "attempts_client_event_id_unique" UNIQUE("client_event_id")
);
--> statement-breakpoint
ALTER TABLE "attempts" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "badges" (
	"key" text PRIMARY KEY NOT NULL,
	"criteria" jsonb NOT NULL,
	"icon_key" text NOT NULL,
	"fill_token_key" text NOT NULL,
	"position" integer DEFAULT 0 NOT NULL,
	"enabled" boolean DEFAULT true NOT NULL
);
--> statement-breakpoint
ALTER TABLE "badges" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "badges_i18n" (
	"entity_key" text NOT NULL,
	"locale" text NOT NULL,
	"name" text NOT NULL,
	"description" text NOT NULL,
	CONSTRAINT "badges_i18n_entity_key_locale_pk" PRIMARY KEY("entity_key","locale")
);
--> statement-breakpoint
ALTER TABLE "badges_i18n" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "lesson_records" (
	"student_id" uuid NOT NULL,
	"lesson_id" uuid NOT NULL,
	"best_score" integer DEFAULT 0 NOT NULL,
	"latest_score" integer DEFAULT 0 NOT NULL,
	"cumulative_score" integer DEFAULT 0 NOT NULL,
	"accuracy" numeric(5, 4) DEFAULT '0' NOT NULL,
	"stars" smallint DEFAULT 0 NOT NULL,
	"completed_count" integer DEFAULT 0 NOT NULL,
	"last_studied_at" timestamp with time zone,
	CONSTRAINT "lesson_records_student_id_lesson_id_pk" PRIMARY KEY("student_id","lesson_id")
);
--> statement-breakpoint
ALTER TABLE "lesson_records" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "levels" (
	"key" text PRIMARY KEY NOT NULL,
	"position" integer NOT NULL,
	"xp_threshold" integer NOT NULL,
	"icon_key" text NOT NULL,
	CONSTRAINT "levels_position_unique" UNIQUE("position")
);
--> statement-breakpoint
ALTER TABLE "levels" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "levels_i18n" (
	"entity_key" text NOT NULL,
	"locale" text NOT NULL,
	"name" text NOT NULL,
	CONSTRAINT "levels_i18n_entity_key_locale_pk" PRIMARY KEY("entity_key","locale")
);
--> statement-breakpoint
ALTER TABLE "levels_i18n" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "mistake_bank" (
	"student_id" uuid NOT NULL,
	"item_id" uuid NOT NULL,
	"lesson_id" uuid NOT NULL,
	"miss_count" integer DEFAULT 0 NOT NULL,
	"correct_streak" integer DEFAULT 0 NOT NULL,
	"last_missed_at" timestamp with time zone,
	"mastered_at" timestamp with time zone,
	CONSTRAINT "mistake_bank_student_id_item_id_pk" PRIMARY KEY("student_id","item_id")
);
--> statement-breakpoint
ALTER TABLE "mistake_bank" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "sessions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"student_id" uuid NOT NULL,
	"lesson_id" uuid NOT NULL,
	"scoring_profile_id" uuid NOT NULL,
	"settings_snapshot" jsonb NOT NULL,
	"client_session_id" text NOT NULL,
	"started_at" timestamp with time zone NOT NULL,
	"finished_at" timestamp with time zone,
	CONSTRAINT "sessions_client_session_id_unique" UNIQUE("client_session_id")
);
--> statement-breakpoint
ALTER TABLE "sessions" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "streaks" (
	"student_id" uuid PRIMARY KEY NOT NULL,
	"current" integer DEFAULT 0 NOT NULL,
	"longest" integer DEFAULT 0 NOT NULL,
	"last_active_day" date
);
--> statement-breakpoint
ALTER TABLE "streaks" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "student_badges" (
	"student_id" uuid NOT NULL,
	"badge_key" text NOT NULL,
	"awarded_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "student_badges_student_id_badge_key_pk" PRIMARY KEY("student_id","badge_key")
);
--> statement-breakpoint
ALTER TABLE "student_badges" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "xp_ledger" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"student_id" uuid NOT NULL,
	"source" "xp_source" NOT NULL,
	"amount" integer NOT NULL,
	"ref_id" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "xp_ledger" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "settings" ADD CONSTRAINT "settings_key_setting_definitions_key_fk" FOREIGN KEY ("key") REFERENCES "public"."setting_definitions"("key") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "ui_messages" ADD CONSTRAINT "ui_messages_locale_locales_code_fk" FOREIGN KEY ("locale") REFERENCES "public"."locales"("code") ON DELETE no action ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "design_tokens" ADD CONSTRAINT "design_tokens_theme_id_themes_id_fk" FOREIGN KEY ("theme_id") REFERENCES "public"."themes"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "semantic_roles_i18n" ADD CONSTRAINT "semantic_roles_i18n_entity_key_semantic_roles_key_fk" FOREIGN KEY ("entity_key") REFERENCES "public"."semantic_roles"("key") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "semantic_roles_i18n" ADD CONSTRAINT "semantic_roles_i18n_locale_locales_code_fk" FOREIGN KEY ("locale") REFERENCES "public"."locales"("code") ON DELETE no action ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "assets_i18n" ADD CONSTRAINT "assets_i18n_entity_id_assets_id_fk" FOREIGN KEY ("entity_id") REFERENCES "public"."assets"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "assets_i18n" ADD CONSTRAINT "assets_i18n_locale_locales_code_fk" FOREIGN KEY ("locale") REFERENCES "public"."locales"("code") ON DELETE no action ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "books" ADD CONSTRAINT "books_cover_asset_id_assets_id_fk" FOREIGN KEY ("cover_asset_id") REFERENCES "public"."assets"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "books_i18n" ADD CONSTRAINT "books_i18n_entity_id_books_id_fk" FOREIGN KEY ("entity_id") REFERENCES "public"."books"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "books_i18n" ADD CONSTRAINT "books_i18n_locale_locales_code_fk" FOREIGN KEY ("locale") REFERENCES "public"."locales"("code") ON DELETE no action ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "card_types_i18n" ADD CONSTRAINT "card_types_i18n_entity_key_card_types_key_fk" FOREIGN KEY ("entity_key") REFERENCES "public"."card_types"("key") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "card_types_i18n" ADD CONSTRAINT "card_types_i18n_locale_locales_code_fk" FOREIGN KEY ("locale") REFERENCES "public"."locales"("code") ON DELETE no action ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "item_segments" ADD CONSTRAINT "item_segments_item_id_items_id_fk" FOREIGN KEY ("item_id") REFERENCES "public"."items"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "item_segments" ADD CONSTRAINT "item_segments_role_key_semantic_roles_key_fk" FOREIGN KEY ("role_key") REFERENCES "public"."semantic_roles"("key") ON DELETE no action ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "items" ADD CONSTRAINT "items_section_id_lesson_sections_id_fk" FOREIGN KEY ("section_id") REFERENCES "public"."lesson_sections"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "items" ADD CONSTRAINT "items_card_type_key_card_types_key_fk" FOREIGN KEY ("card_type_key") REFERENCES "public"."card_types"("key") ON DELETE no action ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "items" ADD CONSTRAINT "items_image_asset_id_assets_id_fk" FOREIGN KEY ("image_asset_id") REFERENCES "public"."assets"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "items" ADD CONSTRAINT "items_audio_asset_id_assets_id_fk" FOREIGN KEY ("audio_asset_id") REFERENCES "public"."assets"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "items_i18n" ADD CONSTRAINT "items_i18n_entity_id_items_id_fk" FOREIGN KEY ("entity_id") REFERENCES "public"."items"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "items_i18n" ADD CONSTRAINT "items_i18n_locale_locales_code_fk" FOREIGN KEY ("locale") REFERENCES "public"."locales"("code") ON DELETE no action ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "lesson_sections" ADD CONSTRAINT "lesson_sections_lesson_id_lessons_id_fk" FOREIGN KEY ("lesson_id") REFERENCES "public"."lessons"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "lesson_sections" ADD CONSTRAINT "lesson_sections_pill_palette_id_pill_palettes_id_fk" FOREIGN KEY ("pill_palette_id") REFERENCES "public"."pill_palettes"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "lesson_sections_i18n" ADD CONSTRAINT "lesson_sections_i18n_entity_id_lesson_sections_id_fk" FOREIGN KEY ("entity_id") REFERENCES "public"."lesson_sections"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "lesson_sections_i18n" ADD CONSTRAINT "lesson_sections_i18n_locale_locales_code_fk" FOREIGN KEY ("locale") REFERENCES "public"."locales"("code") ON DELETE no action ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "lessons" ADD CONSTRAINT "lessons_unit_id_units_id_fk" FOREIGN KEY ("unit_id") REFERENCES "public"."units"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "lessons" ADD CONSTRAINT "lessons_scan_asset_id_assets_id_fk" FOREIGN KEY ("scan_asset_id") REFERENCES "public"."assets"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "lessons_i18n" ADD CONSTRAINT "lessons_i18n_entity_id_lessons_id_fk" FOREIGN KEY ("entity_id") REFERENCES "public"."lessons"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "lessons_i18n" ADD CONSTRAINT "lessons_i18n_locale_locales_code_fk" FOREIGN KEY ("locale") REFERENCES "public"."locales"("code") ON DELETE no action ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "riddles" ADD CONSTRAINT "riddles_lesson_id_lessons_id_fk" FOREIGN KEY ("lesson_id") REFERENCES "public"."lessons"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "riddles_i18n" ADD CONSTRAINT "riddles_i18n_entity_id_riddles_id_fk" FOREIGN KEY ("entity_id") REFERENCES "public"."riddles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "riddles_i18n" ADD CONSTRAINT "riddles_i18n_locale_locales_code_fk" FOREIGN KEY ("locale") REFERENCES "public"."locales"("code") ON DELETE no action ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "rules" ADD CONSTRAINT "rules_lesson_id_lessons_id_fk" FOREIGN KEY ("lesson_id") REFERENCES "public"."lessons"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "rules_i18n" ADD CONSTRAINT "rules_i18n_entity_id_rules_id_fk" FOREIGN KEY ("entity_id") REFERENCES "public"."rules"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "rules_i18n" ADD CONSTRAINT "rules_i18n_locale_locales_code_fk" FOREIGN KEY ("locale") REFERENCES "public"."locales"("code") ON DELETE no action ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "stages" ADD CONSTRAINT "stages_book_id_books_id_fk" FOREIGN KEY ("book_id") REFERENCES "public"."books"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "stages_i18n" ADD CONSTRAINT "stages_i18n_entity_id_stages_id_fk" FOREIGN KEY ("entity_id") REFERENCES "public"."stages"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "stages_i18n" ADD CONSTRAINT "stages_i18n_locale_locales_code_fk" FOREIGN KEY ("locale") REFERENCES "public"."locales"("code") ON DELETE no action ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "units" ADD CONSTRAINT "units_stage_id_stages_id_fk" FOREIGN KEY ("stage_id") REFERENCES "public"."stages"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "units_i18n" ADD CONSTRAINT "units_i18n_entity_id_units_id_fk" FOREIGN KEY ("entity_id") REFERENCES "public"."units"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "units_i18n" ADD CONSTRAINT "units_i18n_locale_locales_code_fk" FOREIGN KEY ("locale") REFERENCES "public"."locales"("code") ON DELETE no action ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "feedback_messages" ADD CONSTRAINT "feedback_messages_locale_locales_code_fk" FOREIGN KEY ("locale") REFERENCES "public"."locales"("code") ON DELETE no action ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "feedback_messages" ADD CONSTRAINT "feedback_messages_sound_asset_id_assets_id_fk" FOREIGN KEY ("sound_asset_id") REFERENCES "public"."assets"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "games_i18n" ADD CONSTRAINT "games_i18n_entity_key_games_key_fk" FOREIGN KEY ("entity_key") REFERENCES "public"."games"("key") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "games_i18n" ADD CONSTRAINT "games_i18n_locale_locales_code_fk" FOREIGN KEY ("locale") REFERENCES "public"."locales"("code") ON DELETE no action ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "lesson_game_overrides" ADD CONSTRAINT "lesson_game_overrides_lesson_id_lessons_id_fk" FOREIGN KEY ("lesson_id") REFERENCES "public"."lessons"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "lesson_game_overrides" ADD CONSTRAINT "lesson_game_overrides_game_key_games_key_fk" FOREIGN KEY ("game_key") REFERENCES "public"."games"("key") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "avatars" ADD CONSTRAINT "avatars_asset_id_assets_id_fk" FOREIGN KEY ("asset_id") REFERENCES "public"."assets"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "classroom_members" ADD CONSTRAINT "classroom_members_classroom_id_classrooms_id_fk" FOREIGN KEY ("classroom_id") REFERENCES "public"."classrooms"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "classroom_members" ADD CONSTRAINT "classroom_members_student_id_students_id_fk" FOREIGN KEY ("student_id") REFERENCES "public"."students"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "classrooms" ADD CONSTRAINT "classrooms_owner_teacher_id_profiles_id_fk" FOREIGN KEY ("owner_teacher_id") REFERENCES "public"."profiles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "permissions_i18n" ADD CONSTRAINT "permissions_i18n_entity_key_permissions_key_fk" FOREIGN KEY ("entity_key") REFERENCES "public"."permissions"("key") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "permissions_i18n" ADD CONSTRAINT "permissions_i18n_locale_locales_code_fk" FOREIGN KEY ("locale") REFERENCES "public"."locales"("code") ON DELETE no action ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "profiles" ADD CONSTRAINT "profiles_locale_locales_code_fk" FOREIGN KEY ("locale") REFERENCES "public"."locales"("code") ON DELETE no action ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "profiles" ADD CONSTRAINT "profiles_role_key_roles_key_fk" FOREIGN KEY ("role_key") REFERENCES "public"."roles"("key") ON DELETE no action ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "role_permissions" ADD CONSTRAINT "role_permissions_role_key_roles_key_fk" FOREIGN KEY ("role_key") REFERENCES "public"."roles"("key") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "role_permissions" ADD CONSTRAINT "role_permissions_permission_key_permissions_key_fk" FOREIGN KEY ("permission_key") REFERENCES "public"."permissions"("key") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "roles_i18n" ADD CONSTRAINT "roles_i18n_entity_key_roles_key_fk" FOREIGN KEY ("entity_key") REFERENCES "public"."roles"("key") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "roles_i18n" ADD CONSTRAINT "roles_i18n_locale_locales_code_fk" FOREIGN KEY ("locale") REFERENCES "public"."locales"("code") ON DELETE no action ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "students" ADD CONSTRAINT "students_profile_id_profiles_id_fk" FOREIGN KEY ("profile_id") REFERENCES "public"."profiles"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "students" ADD CONSTRAINT "students_avatar_id_avatars_id_fk" FOREIGN KEY ("avatar_id") REFERENCES "public"."avatars"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "students" ADD CONSTRAINT "students_avatar_color_id_avatar_colors_id_fk" FOREIGN KEY ("avatar_color_id") REFERENCES "public"."avatar_colors"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "students" ADD CONSTRAINT "students_created_by_teacher_id_profiles_id_fk" FOREIGN KEY ("created_by_teacher_id") REFERENCES "public"."profiles"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "attempts" ADD CONSTRAINT "attempts_session_id_sessions_id_fk" FOREIGN KEY ("session_id") REFERENCES "public"."sessions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "attempts" ADD CONSTRAINT "attempts_item_id_items_id_fk" FOREIGN KEY ("item_id") REFERENCES "public"."items"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "attempts" ADD CONSTRAINT "attempts_grader_profile_id_profiles_id_fk" FOREIGN KEY ("grader_profile_id") REFERENCES "public"."profiles"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "badges_i18n" ADD CONSTRAINT "badges_i18n_entity_key_badges_key_fk" FOREIGN KEY ("entity_key") REFERENCES "public"."badges"("key") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "badges_i18n" ADD CONSTRAINT "badges_i18n_locale_locales_code_fk" FOREIGN KEY ("locale") REFERENCES "public"."locales"("code") ON DELETE no action ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "lesson_records" ADD CONSTRAINT "lesson_records_student_id_students_id_fk" FOREIGN KEY ("student_id") REFERENCES "public"."students"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "lesson_records" ADD CONSTRAINT "lesson_records_lesson_id_lessons_id_fk" FOREIGN KEY ("lesson_id") REFERENCES "public"."lessons"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "levels_i18n" ADD CONSTRAINT "levels_i18n_entity_key_levels_key_fk" FOREIGN KEY ("entity_key") REFERENCES "public"."levels"("key") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "levels_i18n" ADD CONSTRAINT "levels_i18n_locale_locales_code_fk" FOREIGN KEY ("locale") REFERENCES "public"."locales"("code") ON DELETE no action ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "mistake_bank" ADD CONSTRAINT "mistake_bank_student_id_students_id_fk" FOREIGN KEY ("student_id") REFERENCES "public"."students"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "mistake_bank" ADD CONSTRAINT "mistake_bank_item_id_items_id_fk" FOREIGN KEY ("item_id") REFERENCES "public"."items"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "mistake_bank" ADD CONSTRAINT "mistake_bank_lesson_id_lessons_id_fk" FOREIGN KEY ("lesson_id") REFERENCES "public"."lessons"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_student_id_students_id_fk" FOREIGN KEY ("student_id") REFERENCES "public"."students"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_lesson_id_lessons_id_fk" FOREIGN KEY ("lesson_id") REFERENCES "public"."lessons"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_scoring_profile_id_scoring_profiles_id_fk" FOREIGN KEY ("scoring_profile_id") REFERENCES "public"."scoring_profiles"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "streaks" ADD CONSTRAINT "streaks_student_id_students_id_fk" FOREIGN KEY ("student_id") REFERENCES "public"."students"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "student_badges" ADD CONSTRAINT "student_badges_student_id_students_id_fk" FOREIGN KEY ("student_id") REFERENCES "public"."students"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "student_badges" ADD CONSTRAINT "student_badges_badge_key_badges_key_fk" FOREIGN KEY ("badge_key") REFERENCES "public"."badges"("key") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "xp_ledger" ADD CONSTRAINT "xp_ledger_student_id_students_id_fk" FOREIGN KEY ("student_id") REFERENCES "public"."students"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "lessons_book_page_index" ON "lessons" USING btree ("book_page");--> statement-breakpoint
CREATE INDEX "attempts_session_id_index" ON "attempts" USING btree ("session_id");--> statement-breakpoint
CREATE INDEX "sessions_student_id_lesson_id_index" ON "sessions" USING btree ("student_id","lesson_id");--> statement-breakpoint
CREATE INDEX "xp_ledger_student_id_index" ON "xp_ledger" USING btree ("student_id");