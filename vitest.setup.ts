import "@testing-library/jest-dom";
import { afterAll } from "vitest";

afterAll(async () => {
  const { default: prisma } = await import("./app/db.server");
  if (typeof prisma.$disconnect === "function") await prisma.$disconnect();
});
