import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@/generated/prisma/client";

/**
 * Server-only Prisma client. DATABASE_URL is read from the server environment
 * and never exposed to the browser (it has no NEXT_PUBLIC_ prefix, and this
 * module is only imported from server code).
 */
function createClient() {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error("DATABASE_URL is not set. Copy .env.example to .env and configure it.");
  }
  return new PrismaClient({ adapter: new PrismaPg({ connectionString }) });
}

// Reuse one client across hot reloads in development.
const globalForPrisma = globalThis as unknown as { prisma?: ReturnType<typeof createClient> };

export function getPrisma() {
  globalForPrisma.prisma ??= createClient();
  return globalForPrisma.prisma;
}
