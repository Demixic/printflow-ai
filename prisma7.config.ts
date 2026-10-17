import { existsSync } from "node:fs";
import { defineConfig } from "prisma/config";

// The Prisma CLI does not read .env files on its own. Load them with Node's
// built-in loader (no dotenv dependency); variables already set in the shell win.
for (const file of [".env.local", ".env"]) {
  if (existsSync(file)) process.loadEnvFile(file);
}

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
    seed: "tsx prisma/seed.ts",
  },
  datasource: {
    // Optional for `prisma generate`; required by migrate / seed / studio.
    // Migrations need a direct (non-pooled) connection: Prisma Migrate takes
    // advisory locks, which a transaction-mode pooler such as PgBouncer
    // doesn't support. Vercel's Neon integration provides DATABASE_URL_UNPOOLED.
    url: process.env.DATABASE_URL_UNPOOLED || process.env.DATABASE_URL,
  },
});
