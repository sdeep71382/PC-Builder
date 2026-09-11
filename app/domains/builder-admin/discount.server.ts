import { PrismaClient } from "@prisma/client";
import type { BuilderDiscount } from "./types";
import { validateDiscountInput, type DiscountInput } from "./discount-validation";

const prisma = new PrismaClient();

export async function getBuilderDiscount(
  shopId: string,
  builderId: string
): Promise<BuilderDiscount | null> {
  const discount = await prisma.builderDiscount.findFirst({
    where: { shopId, builderId },
  });
  return discount ? toDiscount(discount) : null;
}

export async function upsertBuilderDiscount(
  shopId: string,
  builderId: string,
  input: DiscountInput
): Promise<BuilderDiscount> {
  const builder = await prisma.builder.findFirst({ where: { id: builderId, shopId } });
  if (!builder) {
    throw new Error("Builder not found.");
  }

  const error = validateDiscountInput(input);
  if (error) {
    throw new Error(error.message);
  }

  const discount = await prisma.builderDiscount.upsert({
    where: { builderId },
    update: {
      enabled: input.enabled,
      thresholdAmount: input.thresholdAmount,
      discountPercentage: input.discountPercentage,
      label: input.label?.trim() || null,
    },
    create: {
      shopId,
      builderId,
      enabled: input.enabled,
      thresholdAmount: input.thresholdAmount,
      discountPercentage: input.discountPercentage,
      label: input.label?.trim() || null,
    },
  });
  return toDiscount(discount);
}

export async function removeBuilderDiscount(shopId: string, builderId: string): Promise<void> {
  const existing = await prisma.builderDiscount.findFirst({ where: { shopId, builderId } });
  if (!existing) return;
  await prisma.builderDiscount.delete({ where: { id: existing.id } });
}

function toDiscount(discount: {
  id: string;
  shopId: string;
  builderId: string;
  enabled: boolean;
  thresholdAmount: unknown;
  discountPercentage: unknown;
  label: string | null;
  createdAt: Date;
  updatedAt: Date;
}): BuilderDiscount {
  return {
    ...discount,
    thresholdAmount: String(discount.thresholdAmount),
    discountPercentage: String(discount.discountPercentage),
  };
}
