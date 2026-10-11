ALTER TABLE "avatars" ALTER COLUMN "kind" SET DATA TYPE text;--> statement-breakpoint
DELETE FROM "avatars" WHERE "kind" = 'emoji';--> statement-breakpoint
DROP TYPE "public"."avatar_kind";--> statement-breakpoint
CREATE TYPE "public"."avatar_kind" AS ENUM('letter', 'icon', 'asset');--> statement-breakpoint
ALTER TABLE "avatars" ALTER COLUMN "kind" SET DATA TYPE "public"."avatar_kind" USING "kind"::"public"."avatar_kind";