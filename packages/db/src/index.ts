import { PrismaClient } from "@prisma/client";

export { withDbRetry } from "./retry";

// Standard Next.js-safe singleton pattern so dev-mode hot reload doesn't
// spawn a new PrismaClient (and a new connection pool) on every edit.
const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: process.env.NODE_ENV === "development" ? ["warn", "error"] : ["error"],
  });

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}

export * from "@prisma/client";
