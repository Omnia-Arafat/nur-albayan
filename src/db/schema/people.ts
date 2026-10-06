import {
  boolean,
  integer,
  pgEnum,
  pgTable,
  primaryKey,
  text,
  timestamp,
  uuid,
} from "drizzle-orm/pg-core";

import { id, timestamps } from "./_columns";
import { translationsForKey } from "./_i18n";
import { assets } from "./content";
import { locales } from "./platform";

/** admin, teacher, student. What each can do is in role_permissions. */
export const roles = pgTable("roles", {
  key: text("key").primaryKey(),
  position: integer("position").notNull().default(0),
}).enableRLS();

export const rolesI18n = translationsForKey("roles_i18n", () => roles.key, {
  label: text("label").notNull(),
});

export const permissions = pgTable("permissions", {
  key: text("key").primaryKey(),
}).enableRLS();

export const permissionsI18n = translationsForKey("permissions_i18n", () => permissions.key, {
  description: text("description").notNull(),
});

export const rolePermissions = pgTable(
  "role_permissions",
  {
    roleKey: text("role_key")
      .notNull()
      .references(() => roles.key, { onDelete: "cascade", onUpdate: "cascade" }),
    permissionKey: text("permission_key")
      .notNull()
      .references(() => permissions.key, { onDelete: "cascade", onUpdate: "cascade" }),
  },
  (t) => [primaryKey({ columns: [t.roleKey, t.permissionKey] })],
).enableRLS();

export const profileStatus = pgEnum("profile_status", ["active", "disabled"]);

/**
 * A signed-in person. id = auth.users.id (foreign key added in the RLS migration,
 * because auth.users lives in Supabase's auth schema).
 * Nobody needs one to use the site: anonymous learners never get a row here.
 */
export const profiles = pgTable("profiles", {
  id: uuid("id").primaryKey(),
  displayName: text("display_name").notNull(),
  locale: text("locale").references(() => locales.code, { onUpdate: "cascade" }),
  roleKey: text("role_key")
    .notNull()
    .references(() => roles.key, { onUpdate: "cascade" }),
  status: profileStatus("status").notNull().default("active"),
  ...timestamps(),
}).enableRLS();

export const avatarKind = pgEnum("avatar_kind", ["emoji", "asset"]);

export const avatars = pgTable("avatars", {
  id: id(),
  kind: avatarKind("kind").notNull(),
  value: text("value"),
  assetId: uuid("asset_id").references(() => assets.id, { onDelete: "cascade" }),
  /** Locked until the learner earns this badge; null = always available. */
  unlockBadgeKey: text("unlock_badge_key"),
  position: integer("position").notNull().default(0),
}).enableRLS();

export const avatarColors = pgTable("avatar_colors", {
  id: id(),
  tokenKey: text("token_key").notNull().unique(),
  position: integer("position").notNull().default(0),
}).enableRLS();

/**
 * A learner known to the server. Anonymous learners live only on their device until
 * they sign up (profile_id) or a teacher adds them (username + PIN); the device's
 * progress is then uploaded and claimed.
 */
export const students = pgTable("students", {
  id: id(),
  profileId: uuid("profile_id")
    .unique()
    .references(() => profiles.id, { onDelete: "set null" }),
  displayName: text("display_name").notNull(),
  avatarId: uuid("avatar_id").references(() => avatars.id, { onDelete: "set null" }),
  avatarColorId: uuid("avatar_color_id").references(() => avatarColors.id, { onDelete: "set null" }),
  useFirstLetter: boolean("use_first_letter").notNull().default(false),
  username: text("username").unique(),
  pinHash: text("pin_hash"),
  createdByTeacherId: uuid("created_by_teacher_id").references(() => profiles.id, {
    onDelete: "set null",
  }),
  /** The device-local profile this student was claimed from. */
  deviceProfileId: text("device_profile_id").unique(),
  claimedAt: timestamp("claimed_at", { withTimezone: true }),
  ...timestamps(),
}).enableRLS();

export const classrooms = pgTable("classrooms", {
  id: id(),
  ownerTeacherId: uuid("owner_teacher_id")
    .notNull()
    .references(() => profiles.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  joinCode: text("join_code").notNull().unique(),
  archivedAt: timestamp("archived_at", { withTimezone: true }),
  ...timestamps(),
}).enableRLS();

export const classroomMembers = pgTable(
  "classroom_members",
  {
    classroomId: uuid("classroom_id")
      .notNull()
      .references(() => classrooms.id, { onDelete: "cascade" }),
    studentId: uuid("student_id")
      .notNull()
      .references(() => students.id, { onDelete: "cascade" }),
    joinedAt: timestamp("joined_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [primaryKey({ columns: [t.classroomId, t.studentId] })],
).enableRLS();
