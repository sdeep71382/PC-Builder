import { PrismaClient } from "@prisma/client";

declare global {
  // eslint-disable-next-line no-var
  var prismaGlobal: PrismaClient;
}

if (process.env.NODE_ENV !== "production") {
  if (!global.prismaGlobal) {
    global.prismaGlobal = new PrismaClient();
  }
}

// Vite can preserve the global across hot reloads while Prisma's generated
// client changes. Recreate it when a new schema delegate is required.
const cached = global.prismaGlobal;
const prisma = cached && typeof cached.buildSession === "object" && typeof cached.orderAttribution === "object"
  ? cached
  : new PrismaClient();

if (process.env.NODE_ENV !== "production") {
  global.prismaGlobal = prisma;
}

export default prisma;
