import { timestamp, uuid } from "drizzle-orm/pg-core";

/** Primary key used by every entity table. */
export const id = () => uuid("id").primaryKey().defaultRandom();

/** created_at / updated_at pair. updated_at is bumped by the trigger in the RLS migration. */
export const timestamps = () => ({
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});
