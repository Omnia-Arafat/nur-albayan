import "dotenv/config";
import { defineConfig } from "drizzle-kit";

export default defineConfig({
  schema: "./src/db/schema/index.ts",
  out: "./db/migrations",
  dialect: "postgresql",
  // Migrations need a session connection; the transaction pooler in DATABASE_URL drops prepared statements.
  dbCredentials: { url: process.env.DATABASE_URL_DIRECT ?? process.env.DATABASE_URL ?? "" },
  strict: true,
});
